import { DECKS } from "@metastack/content";

import { DashboardProgress } from "@/components/dashboard/dashboard-progress";
import { SyncAfterLogin } from "@/components/dashboard/sync-after-login";
import { getSession } from "@/lib/auth/session";
import { loadCards } from "@/lib/server/cards";
import { loadProgress } from "@/lib/server/progress";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const user = await getSession();
  const [progress, cards] = await Promise.all([user ? loadProgress(user.id) : null, loadCards()]);

  return (
    <>
      <SyncAfterLogin />
      <DashboardProgress
        user={user}
        cards={cards.map((card) => ({
          id: card.id,
          deck: card.deck,
          prompt: card.prompt.replace(/\s+/g, " ").trim(),
        }))}
        states={(progress?.cardStates ?? []).map((state) => ({
          cardId: state.cardId,
          state: state.state,
          due: state.due,
          lapses: state.lapses,
        }))}
        reviews={(progress?.reviews ?? []).map((review) => ({
          cardId: review.cardId,
          rating: review.rating,
          previousState: review.previousState,
          reviewedAt: review.reviewedAt,
        }))}
        newLimit={progress?.settings.newLimit ?? DEFAULT_SETTINGS.newLimit}
        decks={DECKS.map((deck) => ({ slug: deck.slug, title: deck.title }))}
        // Request time. The page is dynamic, so each load gets a fresh clock.
        // eslint-disable-next-line react-hooks/purity
        now={Date.now()}
      />
    </>
  );
}
