import type { Metadata } from "next";
import { cards, DECKS, tagCounts } from "@metastack/content";
import { CardBrowser, type CardSummary } from "@/components/card-browser";

export const metadata: Metadata = {
  title: "Cards",
  description: "Browse and search every card in the question bank.",
};

export default function CardsPage() {
  const summaries: CardSummary[] = cards.map((c) => ({
    id: c.id,
    deck: c.deck,
    type: c.type,
    difficulty: c.difficulty,
    tags: c.tags,
    prompt: c.prompt,
  }));
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Cards</h1>
      <p className="mt-2 max-w-xl text-ink-2">
        Every card has a stable URL you can share. Search matches prompts, ids and tags.
      </p>
      <div className="mt-10">
        <CardBrowser
          cards={summaries}
          tags={tagCounts()}
          decks={DECKS.map((d) => ({ slug: d.slug, title: d.title }))}
        />
      </div>
    </div>
  );
}
