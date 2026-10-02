import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { cards, getCard, getDeck } from "@metastack/content";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return cards.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const card = getCard(id);
  if (!card) return {};
  return {
    title: card.prompt.trim().slice(0, 80),
    description: card.keyPoints.slice(0, 2).join(" · "),
  };
}

export default async function CardPage({ params }: Props) {
  const { id } = await params;
  const card = getCard(id);
  if (!card) notFound();
  const deck = getDeck(card.deck)!;
  const sourcePath = `packages/content/cards/${card.deck}/${card.id}.md`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/cards"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All cards
      </Link>

      <article
        className="index-card header-only mt-5 px-6 pt-5 pb-8 sm:px-9"
        style={{ ["--rule-top" as string]: "68px" }}
      >
        <header className="flex flex-wrap items-center gap-2">
          <Badge tone="red">{deck.title}</Badge>
          <Badge>{card.type}</Badge>
          <Badge>difficulty {card.difficulty}/3</Badge>
          <span className="ml-auto font-mono text-xs text-ink-3">#{card.id}</span>
        </header>
        <h1 className="mt-6 font-display text-[1.6rem] leading-[1.3] font-semibold tracking-tight text-ink sm:text-[1.9rem]">
          {card.prompt.trim()}
        </h1>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink-2">Key points</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
            {card.keyPoints.map((kp) => (
              <li key={kp} className="leading-snug">
                {kp}
              </li>
            ))}
          </ol>
        </section>

        {card.stages && (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-ink-2">Stages</h2>
            <ol className="mt-3 space-y-3">
              {card.stages.map((stage, i) => (
                <li key={stage.name} className="rounded-xl border border-rule bg-paper-2 px-4 py-3">
                  <p className="text-sm font-medium text-ink">
                    <span className="mr-2 font-mono text-ink-3">{i + 1}</span>
                    {stage.name}
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-2">
                    {stage.keyPoints.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink-2">Model answer</h2>
          <div className="mt-3">
            <Markdown source={card.body} />
          </div>
        </section>

        {card.followUps.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-ink-2">Likely follow-ups</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              {card.followUps.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink-2">References</h2>
          <ul className="mt-2 space-y-1.5">
            {card.references.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-1.5 text-blue underline underline-offset-4"
                >
                  {r.title}
                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-10 flex flex-wrap items-center gap-3 border-t border-rule pt-6 text-sm text-ink-3">
          <span>
            Tags: {card.tags.join(", ")} · updated {card.updated}
          </span>
          <a
            href={`${GITHUB_URL}/edit/main/${sourcePath}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto underline underline-offset-4 hover:text-ink"
          >
            Edit on GitHub
          </a>
          <a
            href={`${GITHUB_URL}/issues/new?template=card-error.yml&title=${encodeURIComponent(`Card error: ${card.id}`)}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-ink"
          >
            Report a problem
          </a>
        </footer>
      </article>

      <div className="mt-8 flex gap-3">
        <ButtonLink href={`/study/${card.deck}`}>Drill the {deck.title} deck</ButtonLink>
      </div>
    </div>
  );
}
