import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { cards, getCard } from "@metastack/content";

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return cards.map((card) => ({ id: card.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const card = getCard(id);
  if (!card) return {};
  return {
    title: card.id,
    description: card.prompt.trim().slice(0, 160),
  };
}

/** The session UI lives in the study layout so moving between cards stays one mount. */
export default async function StudyCardPage({ params }: Props) {
  const { id } = await params;
  if (!getCard(id)) notFound();
  return null;
}
