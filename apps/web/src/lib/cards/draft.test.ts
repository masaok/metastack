import assert from "node:assert/strict";

import { parseCardInput } from "./draft";

const today = "2026-10-02";
const input = {
  id: "cache-aside-pattern",
  deck: "fundamentals",
  type: "concept",
  difficulty: 1,
  tags: ["caching"],
  prompt: "What is the cache-aside pattern?",
  keyPoints: ["Read the cache first", "Fill it on a miss", "Invalidate on write"],
  followUps: [],
  references: [{ title: "Docs", url: "https://example.com/" }],
  reviewed: false,
  body: "  The application owns the cache and fills it on a miss.  ",
};

const saved = parseCardInput(input, today);
assert.ok(saved.ok);
assert.equal(saved.card.body, input.body.trim());
assert.equal(saved.card.reviewed, false);

// The date is the day of the save, whatever the client sent.
const dated = parseCardInput({ ...input, updated: "1999-01-01" }, today);
assert.ok(dated.ok);
assert.equal(dated.card.updated, today);

// Schema failures and a short body are reported together.
const bad = parseCardInput({ ...input, id: "Not Kebab", tags: ["nope"], body: "short" }, today);
assert.ok(!bad.ok);
assert.ok(bad.issues.some((issue) => issue.startsWith("id:")));
assert.ok(bad.issues.some((issue) => issue.startsWith("tags.0:")));
assert.ok(bad.issues.some((issue) => issue.startsWith("body:")));

// The cross-field rules of the card schema apply.
const noStages = parseCardInput({ ...input, type: "design" }, today);
assert.ok(!noStages.ok);
assert.ok(noStages.issues.some((issue) => issue.startsWith("stages:")));
const shortEli5 = parseCardInput({ ...input, eli5: ["only one"] }, today);
assert.ok(!shortEli5.ok);

for (const junk of [null, "text", [input]]) {
  const result = parseCardInput(junk, today);
  assert.ok(!result.ok);
}

console.log("card draft ok");
