import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DECKS, getDeck, isDeckSlug } from "@metastack/content";

type Props = { params: Promise<{ deck: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return DECKS.map((d) => ({ deck: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { deck } = await params;
  const d = getDeck(deck);
  return d ? { title: `Study ${d.title}`, description: d.description } : {};
}

/** The session UI lives in the study layout and moves to `/study/card/[id]`. */
export default async function StudyDeckPage({ params }: Props) {
  const { deck } = await params;
  if (!isDeckSlug(deck)) notFound();
  return null;
}
