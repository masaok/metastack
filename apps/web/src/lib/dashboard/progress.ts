import type { LearningState, Rating } from "@metastack/srs";

export interface ProgressCard {
  id: string;
  deck: string;
  prompt: string;
}

export interface ProgressState {
  cardId: string;
  state: LearningState;
  due: string;
  lapses: number;
}

export interface ProgressReview {
  cardId: string;
  rating: Rating;
  previousState: LearningState;
  reviewedAt: string;
}

/** Where a set of cards stands. `learned` cards have left the learning steps. */
export interface ProgressCounts {
  total: number;
  learned: number;
  learning: number;
  notStarted: number;
  due: number;
}

export interface DeckProgress extends ProgressCounts {
  slug: string;
  title: string;
}

export interface DayCount {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  count: number;
}

export interface WeakCard {
  id: string;
  prompt: string;
  lapses: number;
  lastRating: Rating | null;
}

export interface ProgressSummary {
  totals: ProgressCounts;
  decks: DeckProgress[];
  /** Reviews on each of the last `ACTIVITY_DAYS` local days, oldest first, today last. */
  activity: DayCount[];
  /** Cards coming due on each of the next `FORECAST_DAYS` local days. Today includes everything overdue. */
  forecast: DayCount[];
  ratings: Record<Rating, number>;
  reviews: number;
  reviewsThisWeek: number;
  /** Consecutive days with a review, ending today or yesterday. */
  streak: number;
  /** Share of reviews of an already seen card that were not rated Again, 0 to 1. Null with none. */
  recall: number | null;
  /** Study days needed to meet every unseen card at the daily new-card limit. */
  daysOfNewCards: number;
  weakest: WeakCard[];
}

export const ACTIVITY_DAYS = 30;
export const FORECAST_DAYS = 14;
const WEAKEST = 5;

/** Local calendar day of a moment, YYYY-MM-DD. */
export function localDay(at: number | string | Date): string {
  const d = new Date(at);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** The local day `offset` days from the day of `now`. Uses the calendar, so DST days work. */
function dayAt(now: number, offset: number): string {
  const d = new Date(now);
  return localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset));
}

function emptyCounts(): ProgressCounts {
  return { total: 0, learned: 0, learning: 0, notStarted: 0, due: 0 };
}

export function buildProgress(
  cards: readonly ProgressCard[],
  states: readonly ProgressState[],
  reviews: readonly ProgressReview[],
  decks: ReadonlyArray<{ slug: string; title: string }>,
  newLimit: number,
  now: number,
): ProgressSummary {
  // Progress for a card that is no longer in the bank is ignored throughout.
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const stateById = new Map(
    states.filter((state) => cardById.has(state.cardId)).map((state) => [state.cardId, state]),
  );
  const kept = reviews.filter((review) => cardById.has(review.cardId));

  const totals = emptyCounts();
  const byDeck = new Map(decks.map((deck) => [deck.slug, { ...deck, ...emptyCounts() }]));
  const today = dayAt(now, 0);
  const forecastDays = Array.from({ length: FORECAST_DAYS }, (_, i) => dayAt(now, i));
  const forecast = new Map(forecastDays.map((day) => [day, 0]));

  for (const card of cards) {
    const state = stateById.get(card.id);
    const started = state !== undefined && state.state !== "new";
    const bucket = !started ? "notStarted" : state.state === "review" ? "learned" : "learning";
    const due = started && new Date(state.due).getTime() <= now;
    for (const counts of [totals, byDeck.get(card.deck)]) {
      if (!counts) continue;
      counts.total += 1;
      counts[bucket] += 1;
      if (due) counts.due += 1;
    }
    if (started) {
      const day = localDay(state.due);
      const slot = day < today ? today : day;
      if (forecast.has(slot)) forecast.set(slot, forecast.get(slot)! + 1);
    }
  }

  const activityDays = Array.from({ length: ACTIVITY_DAYS }, (_, i) =>
    dayAt(now, i - (ACTIVITY_DAYS - 1)),
  );
  const activity = new Map(activityDays.map((day) => [day, 0]));
  const studiedDays = new Set<string>();
  const ratings: Record<Rating, number> = { again: 0, hard: 0, good: 0, easy: 0 };
  const lastRating = new Map<string, ProgressReview>();
  const weekStart = dayAt(now, -6);
  let reviewsThisWeek = 0;
  let seenAgain = 0;
  let seenTotal = 0;

  for (const review of kept) {
    const day = localDay(review.reviewedAt);
    studiedDays.add(day);
    if (activity.has(day)) activity.set(day, activity.get(day)! + 1);
    if (day >= weekStart && day <= today) reviewsThisWeek += 1;
    ratings[review.rating] += 1;
    if (review.previousState !== "new") {
      seenTotal += 1;
      if (review.rating === "again") seenAgain += 1;
    }
    const last = lastRating.get(review.cardId);
    if (!last || review.reviewedAt > last.reviewedAt) lastRating.set(review.cardId, review);
  }

  // A streak survives until the end of the day after the last review.
  let streak = 0;
  for (
    let offset = studiedDays.has(today) ? 0 : -1;
    studiedDays.has(dayAt(now, offset));
    offset--
  ) {
    streak += 1;
  }

  const weakest = [...stateById.values()]
    .map((state): WeakCard => ({
      id: state.cardId,
      prompt: cardById.get(state.cardId)!.prompt,
      lapses: state.lapses,
      lastRating: lastRating.get(state.cardId)?.rating ?? null,
    }))
    .filter((card) => card.lapses > 0 || card.lastRating === "again" || card.lastRating === "hard")
    .sort(
      (a, b) =>
        b.lapses - a.lapses ||
        Number(b.lastRating === "again") - Number(a.lastRating === "again") ||
        (a.id < b.id ? -1 : 1),
    )
    .slice(0, WEAKEST);

  return {
    totals,
    decks: [...byDeck.values()],
    activity: activityDays.map((day) => ({ day, count: activity.get(day)! })),
    forecast: forecastDays.map((day) => ({ day, count: forecast.get(day)! })),
    ratings,
    reviews: kept.length,
    reviewsThisWeek,
    streak,
    recall: seenTotal > 0 ? (seenTotal - seenAgain) / seenTotal : null,
    daysOfNewCards: Math.ceil(totals.notStarted / Math.max(1, newLimit)),
    weakest,
  };
}

/**
 * A round axis maximum at or above `value`, never below 4. It is an even
 * multiple of a power of ten, so the halfway tick of a count is a whole number.
 */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 4, 6, 8, 10].find((step) => value <= step * power)! * power;
}
