import { redirect } from "next/navigation";

import { cards, DECKS } from "@metastack/content";

import { AdminView } from "@/components/dashboard/admin-view";
import { getSession } from "@/lib/auth/session";
import { loadSiteOverview } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const user = await getSession();
  if (!user) redirect("/api/auth/github");
  if (!user.admin) redirect("/dashboard");
  const site = await loadSiteOverview();

  return (
    <AdminView
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
