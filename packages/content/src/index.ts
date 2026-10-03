/**
 * @metastack/content — browser-safe entry point.
 *
 * The schema, the decks and pure helpers over a list of cards. The cards
 * themselves are read from the database by the web app; the copy that ships in
 * this repository is the seed, exported from `@metastack/content/seed`.
 */
import type { Card, DeckSlug, Tag } from "./schema";

export * from "./schema";
export * from "./decks";

export function cardsForDeck(cards: readonly Card[], deck: DeckSlug): Card[] {
  return cards.filter((c) => c.deck === deck);
}

/** Tags that are actually used by at least one card, with counts, most used first. */
export function tagCounts(cards: readonly Card[]): Array<{ tag: Tag; count: number }> {
  const counts = new Map<Tag, number>();
  for (const c of cards) for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
