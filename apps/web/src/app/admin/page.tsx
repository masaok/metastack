import { DECKS } from "@metastack/content";

import { AdminOverview } from "@/components/admin/admin-overview";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadCards } from "@/lib/server/cards";
import { loadSiteOverview } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const user = await requireAdmin();
  const [site, cards] = await Promise.all([loadSiteOverview(), loadCards()]);

  return (
    <AdminOverview
      user={user}
      site={site}
      bank={cards.length}
      deckOptions={DECKS.map((deck) => ({ slug: deck.slug, title: deck.title }))}
      // Request time. The page is dynamic, so each load gets a fresh clock.
      // eslint-disable-next-line react-hooks/purity
      now={Date.now()}
    />
  );
}
