import { DECKS } from "@metastack/content";

import { AdminUsers } from "@/components/admin/admin-users";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadSiteOverview } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Users · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage() {
  const user = await requireAdmin();
  const site = await loadSiteOverview();

  return (
    <AdminUsers
      user={user}
      site={site}
      deckOptions={DECKS.map((deck) => ({ slug: deck.slug, title: deck.title }))}
      // Request time. The page is dynamic, so each load gets a fresh clock.
      // eslint-disable-next-line react-hooks/purity
      now={Date.now()}
    />
  );
}
