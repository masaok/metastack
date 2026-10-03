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
            className="index-card group flex min-h-[280px] flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]"
          >
            <div className="flex flex-1 flex-col px-6 pt-6 pb-6">
              <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-3 uppercase">
                <span className="text-red-ink">{deck.slug}</span>
                <span className="ml-auto font-mono font-normal normal-case">
                  {deck.cardIds.length} cards
                </span>
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-ink">{deck.title}</h2>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{deck.description}</p>
              <dl className="mt-auto grid grid-cols-3 gap-2 pt-5 font-mono text-sm">
                <Stat label="due" value={counts?.due} highlight={(counts?.due ?? 0) > 0} />
                <Stat label="new" value={counts?.new} />
                <Stat label="learned" value={counts?.learned} />
              </dl>
            </div>
            <Link
              href={`/study/${deck.slug}`}
              className="inline-flex items-center gap-1.5 border-t border-rule/60 bg-paper-2/70 px-6 py-3.5 text-sm font-medium text-red-ink hover:bg-paper-2"
            >
              {counts && counts.due > 0 ? `Review ${counts.due} due` : "Drill this deck"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </article>
        );
      })}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value?: number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-rule bg-paper-2/70 px-2.5 py-1.5">
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className={highlight ? "text-red-ink" : "text-ink"}>
        {value === undefined ? <span className="text-ink-3">–</span> : value}
      </dd>
    </div>
  );
}
