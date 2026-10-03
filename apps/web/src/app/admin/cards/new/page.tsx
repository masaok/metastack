import { DECKS } from "@metastack/content";

import { AdminCardEditor } from "@/components/admin/admin-card-editor";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New card · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminNewCardPage() {
  const user = await requireAdmin();
  return (
    <AdminCardEditor
      user={user}
      deckOptions={DECKS.map((deck) => ({ slug: deck.slug, title: deck.title }))}
    />
  );
}
