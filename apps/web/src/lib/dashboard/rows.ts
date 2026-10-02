import type { LearningState, Rating } from "@metastack/srs";

export interface DashboardCard {
  id: string;
  deck: string;
  deckTitle: string;
  prompt: string;
  type: string;
  difficulty: number;
}

export interface DashboardState {
  cardId: string;
  state: LearningState;
  reps: number;
  lapses: number;
  due: string;
  lastReview?: string;
}

export interface DashboardReview {
  cardId: string;
  rating: Rating;
  reviewedAt: string;
}

export interface DashboardRow {
  id: string;
  prompt: string;
  deck: string;
  deckTitle: string;
  type: string;
  difficulty: number;
  state: LearningState | "new";
  reps: number;
  lapses: number;
  due: string | null;
  dueLabel: string;
  lastReview: string | null;
  lastReviewLabel: string;
  rating: Rating | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, now: number, future: "in" | "ago"): string {
  const delta = new Date(iso).getTime() - now;
  const abs = Math.abs(delta);
  const past = delta < 0;
  let count: number;
  let unit: string;
  if (abs < HOUR) {
    count = Math.max(1, Math.round(abs / MINUTE));
    unit = "minute";
  } else if (abs < DAY) {
    count = Math.max(1, Math.round(abs / HOUR));
    unit = "hour";
  } else {
    count = Math.max(1, Math.round(abs / DAY));
    unit = "day";
  }
  const word = `${count} ${unit}${count === 1 ? "" : "s"}`;
  if (past) return `${word} ago`;
  if (future === "in") return abs < MINUTE ? "due now" : `in ${word}`;
  return word;
}

function latestRating(reviews: readonly DashboardReview[], cardId: string): Rating | null {
  let best: DashboardReview | null = null;
  for (const review of reviews) {
    if (review.cardId !== cardId) continue;
    if (!best || review.reviewedAt > best.reviewedAt) best = review;
  }
  return best?.rating ?? null;
}

export function buildDashboardRows(
  cards: readonly DashboardCard[],
  states: readonly DashboardState[],
  reviews: readonly DashboardReview[],
  now: number,
): DashboardRow[] {
  const byId = new Map(states.map((state) => [state.cardId, state]));
  const rows = cards.map((card): DashboardRow => {
    const state = byId.get(card.id);
    const lastReview = state?.lastReview ?? null;
    return {
      id: card.id,
      prompt: card.prompt.replace(/\s+/g, " ").trim(),
      deck: card.deck,
      deckTitle: card.deckTitle,
      type: card.type,
      difficulty: card.difficulty,
      state: state?.state ?? "new",
      reps: state?.reps ?? 0,
      lapses: state?.lapses ?? 0,
      due: state?.due ?? null,
      dueLabel: state ? relativeTime(state.due, now, "in") : "Not scheduled",
      lastReview,
      lastReviewLabel: lastReview ? relativeTime(lastReview, now, "ago") : "Not studied",
      rating: latestRating(reviews, card.id),
    };
  });
  rows.sort((a, b) => {
    if (a.lastReview && b.lastReview && a.lastReview !== b.lastReview) {
      return a.lastReview < b.lastReview ? 1 : -1;
    }
    if (a.lastReview && !b.lastReview) return -1;
    if (!a.lastReview && b.lastReview) return 1;
    if (a.deckTitle !== b.deckTitle) return a.deckTitle < b.deckTitle ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return rows;
}
