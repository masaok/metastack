import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { Card } from "@metastack/content";
import { seedCards } from "@metastack/content/seed";

import { hasDatabaseUrl } from "@/lib/auth/env";
import { selectCards, upsertCards } from "@/lib/cards/store";

import { ensureSchema } from "./neon";

/** How long a read of the cards table is reused before the next request refreshes it. */
const REVALIDATE_SECONDS = 300;

async function readCards(): Promise<Card[]> {
  const sql = await ensureSchema();
  const stored = await selectCards(sql);
  if (stored.length > 0) return stored;
  // A new database starts with the cards that ship in the repository.
  await upsertCards(sql, seedCards);
  return selectCards(sql);
}

const readCardsCached = unstable_cache(readCards, ["cards"], {
  tags: ["cards"],
  revalidate: REVALIDATE_SECONDS,
});

/**
 * Every reviewed card, in content order. The database is the source. With no
 * database configured (a fork, or CI, which must not reach a live service) the
 * seed is served as is.
 */
export const loadCards = cache(async (): Promise<readonly Card[]> => {
  return hasDatabaseUrl() ? readCardsCached() : seedCards;
});

export async function loadCard(id: string): Promise<Card | undefined> {
  return (await loadCards()).find((card) => card.id === id);
}
