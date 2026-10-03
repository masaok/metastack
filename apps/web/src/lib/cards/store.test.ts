import assert from "node:assert/strict";

import type { Card } from "@metastack/content";

import {
  cardExists,
  deleteCard,
  rowToCard,
  selectCards,
  upsertCards,
  type CardRow,
  type CardsSql,
} from "./store";

const row: CardRow = {
  id: "cache-aside-pattern",
  deck: "fundamentals",
  type: "concept",
  difficulty: 1,
  tags: ["caching", "latency"],
  prompt: "What is the cache-aside pattern?",
  key_points: ["Read the cache first", "Fill it on a miss", "Invalidate on write"],
  eli5: null,
  follow_ups: [],
  reference_links: [{ title: "Docs", url: "https://example.com/" }],
  stages: null,
  body: "The application owns the cache.",
  updated: "2026-10-02",
  reviewed: true,
};

async function main() {
  // A plain row becomes a card, and absent optional columns stay absent.
  const card = rowToCard(row);
  assert.ok(card);
  assert.equal(card.updated, "2026-10-02");
  assert.equal(card.body, row.body);
  assert.deepEqual(card.keyPoints, row.key_points);
  assert.equal("eli5" in card, false);
  assert.equal("stages" in card, false);

  // Optional columns come through when stored.
  const plain = ["Look first", "Then fill", "Then clear"];
  assert.deepEqual(rowToCard({ ...row, eli5: plain })?.eli5, plain);

  // A row that breaks the schema is skipped, not served.
  const errors: string[] = [];
  const original = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    assert.equal(rowToCard({ ...row, tags: ["not-a-tag"] }), null);
    assert.equal(rowToCard({ ...row, eli5: ["only one"] }), null);
    assert.equal(rowToCard({ ...row, type: "design" }), null);
    assert.equal(errors.length, 3);
    assert.match(errors[0]!, /cache-aside-pattern/);

    const reads: CardsSql = {
      query: async () => [row, { ...row, id: "broken", key_points: [] }],
    };
    const selected = await selectCards(reads);
    assert.deepEqual(
      selected.map((c) => c.id),
      ["cache-aside-pattern"],
    );
  } finally {
    console.error = original;
  }

  // Upsert sends every card in one statement and does nothing for an empty list.
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  const writes: CardsSql = {
    query: async (text, params) => {
      calls.push({ text, params });
      return [];
    },
  };
  await upsertCards(writes, []);
  assert.equal(calls.length, 0);
  await upsertCards(writes, [card]);
  assert.equal(calls.length, 1);
  // A stored card is kept unless the caller asks to replace it.
  assert.match(calls[0]!.text, /ON CONFLICT \(id\) DO NOTHING/);
  await upsertCards(writes, [card], { overwrite: true });
  assert.match(calls[1]!.text, /ON CONFLICT \(id\) DO UPDATE/);
  const sent = JSON.parse(calls[0]!.params![0] as string) as Card[];
  assert.deepEqual(sent, [card]);

  // Drafts are left out unless asked for.
  const texts: string[] = [];
  const spy: CardsSql = {
    query: async (text) => {
      texts.push(text);
      return [row];
    },
  };
  await selectCards(spy);
  await selectCards(spy, { drafts: true });
  assert.match(texts[0]!, /WHERE reviewed/);
  assert.doesNotMatch(texts[1]!, /WHERE reviewed/);

  assert.equal(await cardExists(spy, row.id), true);
  assert.equal(await cardExists({ query: async () => [] }, row.id), false);

  // Delete reports whether a row was removed.
  const deletes: Array<{ text: string; params?: unknown[] }> = [];
  const remover: CardsSql = {
    query: async (text, params) => {
      deletes.push({ text, params });
      return params?.[0] === row.id ? [{ id: row.id }] : [];
    },
  };
  assert.equal(await deleteCard(remover, row.id), true);
  assert.equal(await deleteCard(remover, "not-stored"), false);
  assert.match(deletes[0]!.text, /DELETE FROM cards WHERE id = \$1/);
  assert.deepEqual(deletes[0]!.params, [row.id]);

  console.log("card store ok");
}

void main();
