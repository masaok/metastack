"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { Deck } from "@metastack/content";
import { countDeck } from "@metastack/srs";

import { db } from "@/lib/db";

export function DeckGrid({ decks }: { decks: Array<Deck & { cardIds: string[] }> }) {
  const states = useLiveQuery(() => db().cardStates.toArray(), [], null);

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {decks.map((deck) => {
        const counts = states ? countDeck(deck.cardIds, states) : null;
        return (
          <article
            key={deck.slug}
            className="index-card flex min-h-[260px] flex-col px-6 pt-5 pb-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-ink">{deck.title}</h2>
              <span className="shrink-0 font-mono text-sm whitespace-nowrap text-ink-3">
                {deck.cardIds.length} cards
              </span>
            </div>
            <p className="mt-6 text-[0.95rem] leading-relaxed text-ink-2">{deck.description}</p>
            <dl className="mt-5 grid grid-cols-3 gap-2 font-mono text-sm">
              <Stat label="due" value={counts?.due} highlight={(counts?.due ?? 0) > 0} />
              <Stat label="new" value={counts?.new} />
              <Stat label="learned" value={counts?.learned} />
            </dl>
            <Link
              href={`/study/${deck.slug}`}
              className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-red-ink hover:underline"
            >
              {counts && counts.due > 0 ? `Review ${counts.due} due` : "Drill this deck"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        );
      })}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value?: number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-rule bg-paper-2 px-2.5 py-1.5">
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className={highlight ? "text-red-ink" : "text-ink"}>
        {value === undefined ? <span className="text-ink-3">–</span> : value}
      </dd>
    </div>
  );
}
