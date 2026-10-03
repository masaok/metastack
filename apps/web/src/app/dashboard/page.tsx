import { cards, DECKS, getDeck } from "@metastack/content";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { SyncAfterLogin } from "@/components/dashboard/sync-after-login";
import { getSession } from "@/lib/auth/session";
import { buildDashboardRows } from "@/lib/dashboard/rows";
import { loadProgress } from "@/lib/server/progress";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const user = await getSession();
  const progress = user ? await loadProgress(user.id) : null;
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
    <>
      <SyncAfterLogin />
      <DashboardView
        rows={rows}
        user={user}
        deckOptions={DECKS.map((deck) => ({ slug: deck.slug, title: deck.title }))}
      />
    </>
  );
}
