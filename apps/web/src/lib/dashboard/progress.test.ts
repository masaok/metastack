import assert from "node:assert/strict";

import {
  ACTIVITY_DAYS,
  buildProgress,
  FORECAST_DAYS,
  localDay,
  niceMax,
  type ProgressCard,
  type ProgressReview,
  type ProgressState,
} from "./progress";

// Day buckets use the local calendar; pin the zone so the expected days are fixed.
process.env.TZ = "UTC";

const now = Date.parse("2026-10-03T12:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (offset: number) => new Date(now + offset).toISOString();

const decks = [
  { slug: "fundamentals", title: "Fundamentals" },
  { slug: "designs", title: "Classic designs" },
];
const cards: ProgressCard[] = [
  { id: "a", deck: "fundamentals", prompt: "A?" },
  { id: "b", deck: "fundamentals", prompt: "B?" },
  { id: "c", deck: "fundamentals", prompt: "C?" },
  { id: "d", deck: "designs", prompt: "D?" },
  { id: "e", deck: "designs", prompt: "E?" },
];
const states: ProgressState[] = [
  { cardId: "a", state: "review", due: at(3 * DAY), lapses: 0 },
  { cardId: "b", state: "review", due: at(-2 * DAY), lapses: 2 },
  { cardId: "c", state: "learning", due: at(-HOUR), lapses: 0 },
  { cardId: "d", state: "relearning", due: at(HOUR), lapses: 1 },
  { cardId: "e", state: "new", due: at(0), lapses: 0 },
  { cardId: "gone", state: "review", due: at(-DAY), lapses: 9 },
];
const reviews: ProgressReview[] = [
  { cardId: "a", rating: "good", previousState: "new", reviewedAt: at(-2 * DAY) },
  { cardId: "a", rating: "easy", previousState: "learning", reviewedAt: at(-DAY) },
  { cardId: "b", rating: "again", previousState: "review", reviewedAt: at(-DAY) },
  { cardId: "c", rating: "hard", previousState: "new", reviewedAt: at(-HOUR) },
  { cardId: "d", rating: "again", previousState: "review", reviewedAt: at(-40 * DAY) },
  { cardId: "gone", rating: "again", previousState: "review", reviewedAt: at(-HOUR) },
];

const summary = buildProgress(cards, states, reviews, decks, 2, now);

// Learned, in progress and not started always add up to the bank.
assert.deepEqual(summary.totals, { total: 5, learned: 2, learning: 2, notStarted: 1, due: 2 });
assert.deepEqual(
  summary.decks.map((d) => [d.slug, d.total, d.learned, d.learning, d.notStarted, d.due]),
  [
    ["fundamentals", 3, 2, 1, 0, 2],
    ["designs", 2, 0, 1, 1, 0],
  ],
);

// Activity covers the window, today last. Reviews of deleted cards do not count.
assert.equal(summary.activity.length, ACTIVITY_DAYS);
assert.equal(summary.activity.at(-1)?.day, "2026-10-03");
assert.deepEqual(
  summary.activity.slice(-3).map((d) => d.count),
  [1, 2, 1],
);
assert.equal(summary.reviews, 5);
assert.equal(summary.reviewsThisWeek, 4);
assert.equal(summary.streak, 3);
assert.deepEqual(summary.ratings, { again: 2, hard: 1, good: 1, easy: 1 });
// Three reviews were of a card seen before; two of those were Again.
assert.equal(summary.recall, 1 / 3);

// Overdue cards land on today. A stored "new" state is not scheduled.
assert.equal(summary.forecast.length, FORECAST_DAYS);
assert.equal(summary.forecast[0]?.day, "2026-10-03");
assert.equal(summary.forecast[0]?.count, 3);
assert.equal(summary.forecast[3]?.count, 1);
assert.equal(
  summary.forecast.reduce((sum, d) => sum + d.count, 0),
  4,
);

assert.equal(summary.daysOfNewCards, 1);
assert.deepEqual(
  summary.weakest.map((card) => [card.id, card.lapses, card.lastRating]),
  [
    ["b", 2, "again"],
    ["d", 1, "again"],
    ["c", 0, "hard"],
  ],
);

// Nothing studied yet.
const fresh = buildProgress(cards, [], [], decks, 10, now);
assert.deepEqual(fresh.totals, { total: 5, learned: 0, learning: 0, notStarted: 5, due: 0 });
assert.equal(fresh.streak, 0);
assert.equal(fresh.recall, null);
assert.equal(fresh.daysOfNewCards, 1);
assert.deepEqual(fresh.weakest, []);

// A streak still counts when the last review was yesterday, and ends after a missed day.
const yesterday = [{ ...reviews[0]!, reviewedAt: at(-DAY) }];
assert.equal(buildProgress(cards, states, yesterday, decks, 2, now).streak, 1);
const twoDaysAgo = [{ ...reviews[0]!, reviewedAt: at(-2 * DAY) }];
assert.equal(buildProgress(cards, states, twoDaysAgo, decks, 2, now).streak, 0);

assert.equal(localDay("2026-01-05T00:00:00.000Z"), "2026-01-05");
assert.deepEqual(
  [0, 3, 4, 5, 9, 10, 11, 37, 120, 800].map(niceMax),
  [4, 4, 4, 6, 10, 10, 20, 40, 200, 800],
);

console.log("dashboard progress ok");
