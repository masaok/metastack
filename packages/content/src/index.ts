/**
 * @metastack/content — browser-safe entry point.
 *
 * Imports the JSON emitted by `pnpm compile`; never touches the filesystem so
 * it can be bundled into client components.
 */
import compiled from "../generated/cards.json" with { type: "json" };
import type { Card, DeckSlug, Tag } from "./schema";

export * from "./schema";
export * from "./decks";

export const cards: readonly Card[] = compiled as Card[];

const byId = new Map(cards.map((c) => [c.id, c]));

export function getCard(id: string): Card | undefined {
  return byId.get(id);
}

export function cardsForDeck(deck: DeckSlug): Card[] {
  return cards.filter((c) => c.deck === deck);
}

export function cardIdsForDeck(deck: DeckSlug): string[] {
  return cardsForDeck(deck).map((c) => c.id);
}

export function allCardIds(): string[] {
  return cards.map((c) => c.id);
}

/** Tags that are actually used by at least one card, with counts, most used first. */
export function tagCounts(): Array<{ tag: Tag; count: number }> {
  const counts = new Map<Tag, number>();
  for (const c of cards) for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
