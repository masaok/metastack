/**
 * @metastack/srs
 *
 * A thin, pure wrapper around ts-fsrs. Everything here is a plain function over
 * plain, JSON-serialisable data so it can be unit tested without a browser and
 * persisted straight into IndexedDB.
 */
import {
  createEmptyCard,
  fsrs,
  Rating as FsrsRating,
  State as FsrsState,
  generatorParameters,
  type Card as FsrsCard,
  type FSRSParameters,
  type Grade,
} from "ts-fsrs";

export type Rating = "again" | "hard" | "good" | "easy";
export const RATINGS: readonly Rating[] = ["again", "hard", "good", "easy"] as const;

export type LearningState = "new" | "learning" | "review" | "relearning";

/**
 * One scheduling record per card id. Dates are ISO strings so the object can be
 * stored in IndexedDB and exported as JSON without conversion.
 */
export interface CardState {
  cardId: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: LearningState;
  lastReview?: string;
}

/** A record of a single review, suitable for stats and export. */
export interface ReviewRecord {
  cardId: string;
  rating: Rating;
  /** State of the card *before* this review. */
  previousState: LearningState;
  reviewedAt: string;
  scheduledDays: number;
}

export interface RateResult {
  state: CardState;
  review: ReviewRecord;
}

export type Clock = Date | number | string;

const ratingToGrade: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

const stateFromFsrs: Record<FsrsState, LearningState> = {
  [FsrsState.New]: "new",
  [FsrsState.Learning]: "learning",
  [FsrsState.Review]: "review",
  [FsrsState.Relearning]: "relearning",
};

const stateToFsrs: Record<LearningState, FsrsState> = {
  new: FsrsState.New,
  learning: FsrsState.Learning,
  review: FsrsState.Review,
  relearning: FsrsState.Relearning,
};

/** Default FSRS parameters tuned for interview prep: short decks, slightly higher retention. */
export const DEFAULT_PARAMETERS: FSRSParameters = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 180,
  enable_fuzz: false,
});

const scheduler = fsrs(DEFAULT_PARAMETERS);

function toDate(clock: Clock): Date {
  return clock instanceof Date ? clock : new Date(clock);
}

function fromFsrsCard(cardId: string, card: FsrsCard): CardState {
  const state: CardState = {
    cardId,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: stateFromFsrs[card.state],
  };
  if (card.last_review) state.lastReview = card.last_review.toISOString();
  return state;
}

function toFsrsCard(state: CardState): FsrsCard {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: stateToFsrs[state.state],
    last_review: state.lastReview ? new Date(state.lastReview) : undefined,
  };
}

/** A brand-new card that is due immediately. */
export function createCardState(cardId: string, now: Clock = new Date()): CardState {
  return fromFsrsCard(cardId, createEmptyCard(toDate(now)));
}

/** Apply a rating and return the next state plus a review record. Pure: the input is not mutated. */
export function rate(state: CardState, rating: Rating, now: Clock = new Date()): RateResult {
  const at = toDate(now);
  const result = scheduler.next(toFsrsCard(state), at, ratingToGrade[rating]);
  return {
    state: fromFsrsCard(state.cardId, result.card),
    review: {
      cardId: state.cardId,
      rating,
      previousState: state.state,
      reviewedAt: at.toISOString(),
      scheduledDays: result.card.scheduled_days,
    },
  };
}

/** For each rating, when the card would next be due. Useful for labelling rating buttons. */
export function previewDue(state: CardState, now: Clock = new Date()): Record<Rating, string> {
  const at = toDate(now);
  const preview = scheduler.repeat(toFsrsCard(state), at);
  return {
    again: preview[FsrsRating.Again].card.due.toISOString(),
    hard: preview[FsrsRating.Hard].card.due.toISOString(),
    good: preview[FsrsRating.Good].card.due.toISOString(),
    easy: preview[FsrsRating.Easy].card.due.toISOString(),
  };
}

export function isDue(state: CardState, now: Clock = new Date()): boolean {
  return new Date(state.due).getTime() <= toDate(now).getTime();
}

/** Cards that are due, most overdue first. New cards are excluded; they are introduced via `buildSession`. */
export function getDueCards(states: readonly CardState[], now: Clock = new Date()): CardState[] {
  return states
    .filter((s) => s.state !== "new" && isDue(s, now))
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}

/** Rubric thresholds from the build plan. `coverage` is in [0, 1]. */
export function ratingFromRubric(hit: number, total: number): Rating {
  if (total <= 0) return "good";
  const coverage = Math.min(Math.max(hit / total, 0), 1);
  if (coverage < 0.4) return "again";
  if (coverage < 0.7) return "hard";
  if (coverage < 0.95) return "good";
  return "easy";
}

/** Probability (0–1) that the card is still remembered right now. 1 for new cards. */
export function retrievability(state: CardState, now: Clock = new Date()): number {
  if (state.state === "new") return 1;
  return scheduler.get_retrievability(toFsrsCard(state), toDate(now), false);
}

export interface SessionOptions {
  /** Ids of every card eligible for this session (e.g. one deck, or all decks). */
  cardIds: readonly string[];
  /** Known scheduling states; cards without one are treated as new. */
  states: readonly CardState[];
  now?: Clock;
  /** Max new cards to introduce today. */
  newLimit?: number;
  /** How many new cards were already introduced today (across all decks). */
  newIntroducedToday?: number;
  /**
   * Reorders the due reviews and the new cards, each group on its own. Without
   * it, reviews run most overdue first and new cards run in content order.
   */
  shuffle?: (ids: string[]) => string[];
}

export interface Session {
  /** Ordered queue of card ids: due reviews first, then new cards. */
  queue: string[];
  dueCount: number;
  newCount: number;
}

/**
 * Build a study queue: every due review for the given cards, followed by up to
 * `newLimit - newIntroducedToday` cards that have never been studied.
 *
 * FSRS decides which cards are due, not the order they are shown in. Every due
 * card is in the queue, so shuffling the reviews changes no schedule.
 */
export function buildSession(options: SessionOptions): Session {
  const { cardIds, states, now = new Date(), newLimit = 10, newIntroducedToday = 0 } = options;
  const eligible = new Set(cardIds);
  const byId = new Map(states.filter((s) => eligible.has(s.cardId)).map((s) => [s.cardId, s]));

  const overdueFirst = getDueCards([...byId.values()], now).map((s) => s.cardId);
  const due = options.shuffle ? options.shuffle(overdueFirst) : overdueFirst;

  const newIds = cardIds.filter((id) => {
    const s = byId.get(id);
    return !s || s.state === "new";
  });
  const ordered = options.shuffle ? options.shuffle([...newIds]) : newIds;
  const remaining = Math.max(0, newLimit - newIntroducedToday);
  const fresh = ordered.slice(0, remaining);

  return { queue: [...due, ...fresh], dueCount: due.length, newCount: fresh.length };
}

export interface DeckCounts {
  total: number;
  due: number;
  new: number;
  learned: number;
}

/** Summary numbers for a deck picker. */
export function countDeck(
  cardIds: readonly string[],
  states: readonly CardState[],
  now: Clock = new Date(),
): DeckCounts {
  const eligible = new Set(cardIds);
  const relevant = states.filter((s) => eligible.has(s.cardId) && s.state !== "new");
  const learned = relevant.length;
  const due = getDueCards(relevant, now).length;
  return { total: cardIds.length, due, new: cardIds.length - learned, learned };
}

/** Human-friendly interval between `from` and `to`, e.g. "10m", "3d", "2mo". */
export function formatInterval(from: Clock, to: Clock): string {
  const ms = toDate(to).getTime() - toDate(from).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(days / 365)}y`;
}

/** Local calendar day key (YYYY-MM-DD) used to count "new cards introduced today". */
export function dayKey(clock: Clock = new Date()): string {
  const d = toDate(clock);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
