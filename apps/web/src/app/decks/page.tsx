import type { Metadata } from "next";

import { cardsForDeck, DECKS } from "@metastack/content";

import { DeckGrid } from "@/components/deck-grid";
import { ButtonLink } from "@/components/ui/button";
import { loadCards } from "@/lib/server/cards";

export const metadata: Metadata = {
  title: "Decks",
  description: "Pick a deck. Due and new counts come from your progress in this browser.",
};

export default async function DecksPage() {
  const cards = await loadCards();
  const decks = DECKS.map((d) => ({
    ...d,
    cardIds: cardsForDeck(cards, d.slug).map((card) => card.id),
  }));
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Decks
          </h1>
          <p className="mt-2 max-w-xl text-ink-2">
            Due counts update as you study. A mixed session pulls due cards from every deck first,
            then new ones up to your daily limit.
          </p>
        </div>
        <ButtonLink href="/study" size="lg">
          Study everything due
        </ButtonLink>
      </div>
      <div className="mt-10">
        <DeckGrid decks={decks} />
      </div>
    </div>
  );
}
