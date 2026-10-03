import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadCard, loadCards } from "@/lib/server/cards";

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  return (await loadCards()).map((card) => ({ id: card.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const card = await loadCard(id);
  if (!card) return {};
  return {
    title: card.id,
    description: card.prompt.trim().slice(0, 160),
  };
}

/** The session UI lives in the study layout so moving between cards stays one mount. */
export default async function StudyCardPage({ params }: Props) {
  const { id } = await params;
  if (!(await loadCard(id))) notFound();
  return null;
}
