import assert from "node:assert/strict";

import { buildDashboardRows, relativeTime, type DashboardCard } from "./rows";

const now = Date.parse("2026-10-02T12:00:00.000Z");

const cards: DashboardCard[] = [
  {
    id: "caching",
    deck: "fundamentals",
    deckTitle: "Fundamentals",
    prompt: "When does a cache help?",
    type: "concept",
    difficulty: 1,
  },
  {
    id: "sharding",
    deck: "fundamentals",
    deckTitle: "Fundamentals",
    prompt: "How do you shard a key-value store?",
    type: "tradeoff",
    difficulty: 2,
  },
];

const rows = buildDashboardRows(
  cards,
  [
    {
      cardId: "sharding",
      state: "review",
      reps: 4,
      lapses: 1,
      due: "2026-10-05T12:00:00.000Z",
      lastReview: "2026-10-02T09:00:00.000Z",
    },
  ],
  [
    {
      cardId: "sharding",
      rating: "good",
      reviewedAt: "2026-10-01T09:00:00.000Z",
    },
    {
      cardId: "sharding",
      rating: "easy",
      reviewedAt: "2026-10-02T09:00:00.000Z",
    },
  ],
  now,
);

assert.equal(rows[0]?.id, "sharding");
assert.equal(rows[0]?.state, "review");
assert.equal(rows[0]?.rating, "easy");
assert.equal(rows[0]?.reps, 4);
assert.equal(rows[0]?.dueLabel, "in 3 days");
assert.equal(rows[0]?.lastReviewLabel, "3 hours ago");
assert.equal(rows[1]?.id, "caching");
assert.equal(rows[1]?.state, "new");
assert.equal(rows[1]?.rating, null);
assert.equal(rows[1]?.lastReviewLabel, "Not studied");
assert.equal(relativeTime("2026-10-02T12:00:30.000Z", now, "in"), "due now");

console.log("dashboard rows ok");
