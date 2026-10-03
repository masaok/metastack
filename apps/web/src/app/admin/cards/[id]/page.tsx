import { notFound } from "next/navigation";

import { DECKS } from "@metastack/content";

import { AdminCardEditor } from "@/components/admin/admin-card-editor";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadAllCards } from "@/lib/server/cards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit card · Admin",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function AdminEditCardPage({ params }: Props) {
  const user = await requireAdmin();
  const { id } = await params;
  const card = (await loadAllCards()).find((c) => c.id === id);
  if (!card) notFound();

  return (
    <AdminCardEditor
      // A different card is a different form; do not carry edits across.
      key={card.id}
      user={user}
      card={card}
      deckOptions={DECKS.map((deck) => ({ slug: deck.slug, title: deck.title }))}
    />
  );
}
