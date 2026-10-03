import { DECKS, getDeck } from "@metastack/content";

import { DashboardCards } from "@/components/dashboard/dashboard-cards";
import { getSession } from "@/lib/auth/session";
import { buildDashboardRows } from "@/lib/dashboard/rows";
import { loadCards } from "@/lib/server/cards";
import { loadProgress } from "@/lib/server/progress";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My cards",
  robots: { index: false, follow: false },
};

export default async function DashboardCardsPage() {
  const user = await getSession();
  const [progress, cards] = await Promise.all([user ? loadProgress(user.id) : null, loadCards()]);
  const rows = buildDashboardRows(
    cards.map((card) => ({
      id: card.id,
      deck: card.deck,
      deckTitle: getDeck(card.deck)?.title ?? card.deck,
      prompt: card.prompt,
      type: card.type,
      difficulty: card.difficulty,
    })),
    progress?.cardStates ?? [],
    progress?.reviews ?? [],
    // Request time. The page is dynamic, so each load gets a fresh clock.
    // eslint-disable-next-line react-hooks/purity
    Date.now(),
  );

  return (
    <DashboardCards
      rows={rows}
      user={user}
      deckOptions={DECKS.map((deck) => ({ slug: deck.slug, title: deck.title }))}
    />
  );
}
