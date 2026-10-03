import assert from "node:assert/strict";

import type { Card } from "@metastack/content";

import {
  buildExercise,
  DISTRACTOR_COUNT,
  eligibleKinds,
  EXERCISE_KINDS,
  scorePick,
} from "./exercise";

function card(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    deck: "fundamentals",
    type: "concept",
    difficulty: 1,
    tags: ["caching"],
    prompt: `What is ${id}?`,
    keyPoints: [`${id} point one`, `${id} point two`, `${id} point three`],
    eli5: [`${id} plain one`, `${id} plain two`, `${id} plain three`],
    followUps: [],
    references: [{ title: "Docs", url: "https://example.com/" }],
    updated: "2026-10-02",
    reviewed: true,
    body: "A long enough model answer body for the test.",
    ...overrides,
  };
}

const target = card("target");
const bank = [target, card("neighbour"), card("unrelated", { tags: ["geo"] })];

// A card with plain-language lines and related cards supports every kind.
assert.deepEqual(eligibleKinds(target, bank), [...EXERCISE_KINDS]);

// Without plain-language lines there is nothing to cue or match with.
const bare = card("bare", { eli5: undefined });
assert.deepEqual(eligibleKinds(bare, [bare, ...bank]), ["slots", "pick"]);

// Repeated plain-language lines cannot be matched, but still work as cues.
const repeated = card("repeated", { eli5: ["same", "same", "other"] });
assert.deepEqual(eligibleKinds(repeated, [repeated, ...bank]), ["slots", "cues", "pick"]);

// Only cards that share a tag lend points, so a card alone in its tags has no pick.
assert.deepEqual(eligibleKinds(target, [target, card("unrelated", { tags: ["geo"] })]), [
  "slots",
  "cues",
  "match",
]);

// The random source chooses the kind across the whole range, including its upper edge.
const kindAt = (value: number) => buildExercise(target, bank, () => value).kind;
assert.deepEqual([0, 0.25, 0.5, 0.75].map(kindAt), [...EXERCISE_KINDS]);
assert.equal(kindAt(0.999), "pick");
assert.equal(kindAt(1), "pick");
assert.equal(buildExercise(bare, [bare], () => 0.9).kind, "slots");

const cues = buildExercise(target, bank, () => 0.25);
assert.ok(cues.kind === "cues");
assert.deepEqual(cues.cues, target.eli5);

// A match asks every line exactly once.
const match = buildExercise(target, bank, () => 0.5);
assert.ok(match.kind === "match");
assert.deepEqual(match.lines, target.eli5);
assert.deepEqual([...match.order].sort(), [0, 1, 2]);

// A pick holds every key point once, plus points from related cards only.
const pick = buildExercise(target, bank, () => 0.75);
assert.ok(pick.kind === "pick");
assert.equal(pick.options.length, target.keyPoints.length + DISTRACTOR_COUNT);
assert.deepEqual(
  pick.options.flatMap((option) => (option.point === null ? [] : [option.point])).sort(),
  [0, 1, 2],
);
for (const option of pick.options) {
  if (option.point === null) assert.match(option.text, /^neighbour /);
  else assert.equal(option.text, target.keyPoints[option.point]);
}

// Scoring credits correct picks and lets each borrowed point cancel one of them.
const options = [
  { text: "a", point: 0 },
  { text: "x", point: null },
  { text: "b", point: 1 },
  { text: "y", point: null },
  { text: "c", point: 2 },
];
assert.deepEqual(scorePick(options, new Set([0, 2, 4])), [0, 1, 2]);
assert.deepEqual(scorePick(options, new Set([4, 0])), [0, 2]);
assert.deepEqual(scorePick(options, new Set([0, 1, 2, 4])), [0, 1]);
assert.deepEqual(scorePick(options, new Set([0, 1, 3])), []);
assert.deepEqual(scorePick(options, new Set([0, 1, 2, 3, 4])), [0]);
assert.deepEqual(scorePick(options, new Set()), []);

console.log("exercise.test.ts passed");
