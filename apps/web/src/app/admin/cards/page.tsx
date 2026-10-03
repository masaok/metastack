import { DECKS } from "@metastack/content";

import { AdminCards } from "@/components/admin/admin-cards";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadAllCards } from "@/lib/server/cards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cards · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCardsPage() {
  const user = await requireAdmin();
  const cards = await loadAllCards();

  return (
    <AdminCards
      user={user}
      cards={cards.map((card) => ({
        id: card.id,
        deck: card.deck,
        type: card.type,
        difficulty: card.difficulty,
        prompt: card.prompt,
        updated: card.updated,
        reviewed: card.reviewed,
      }))}
      deckOptions={DECKS.map((deck) => ({ slug: deck.slug, title: deck.title }))}
    />
  );
}
