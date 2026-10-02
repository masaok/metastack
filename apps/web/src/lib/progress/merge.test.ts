import assert from "node:assert/strict";

import type { CardState, ReviewRecord } from "@metastack/srs";

import type { ExportFile } from "../db";
import { mergeProgress } from "./merge";

const state = (id: string, lastReview?: string, reps = 1): CardState => ({
  cardId: id,
  due: "2026-10-03T00:00:00.000Z",
  stability: 1,
  difficulty: 5,
  elapsedDays: 0,
  scheduledDays: 1,
  learningSteps: 0,
  reps,
  lapses: 0,
  state: "review",
  lastReview,
});

const review = (id: string, at: string): ReviewRecord => ({
  cardId: id,
  rating: "good",
  previousState: "new",
  reviewedAt: at,
  scheduledDays: 1,
});

const file = (cardStates: CardState[], reviews: ReviewRecord[]): ExportFile => ({
  app: "metastack",
  version: 1,
  exportedAt: "2026-10-02T00:00:00.000Z",
  cardStates,
  reviews,
  settings: { newLimit: 10 },
});

const a = file(
  [state("url-shortener", "2026-10-01T00:00:00.000Z", 2)],
  [review("url-shortener", "2026-10-01T00:00:00.000Z")],
);
const b = file(
  [
    state("url-shortener", "2026-10-02T00:00:00.000Z", 3),
    state("consistent-hashing", "2026-10-02T00:00:00.000Z"),
  ],
  [
    review("url-shortener", "2026-10-01T00:00:00.000Z"),
    review("consistent-hashing", "2026-10-02T00:00:00.000Z"),
  ],
);

const merged = mergeProgress(a, b);
assert.equal(merged.cardStates.length, 2);
assert.equal(merged.cardStates.find((s) => s.cardId === "url-shortener")?.reps, 3);
assert.equal(merged.reviews.length, 2);

const empty = mergeProgress(a, file([], []));
assert.equal(empty.cardStates.length, 1);
assert.equal(empty.reviews.length, 1);

console.log("merge.test: last-write-wins and review union hold");
