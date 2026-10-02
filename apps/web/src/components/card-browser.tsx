"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { CardType, DeckSlug, Tag } from "@metastack/content";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CardSummary {
  id: string;
  deck: DeckSlug;
  type: CardType;
  difficulty: number;
  tags: Tag[];
  prompt: string;
}

export function CardBrowser({
  cards,
  tags,
  decks,
}: {
  cards: CardSummary[];
  tags: Array<{ tag: Tag; count: number }>;
  decks: Array<{ slug: DeckSlug; title: string }>;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<Tag | null>(null);
  const [deck, setDeck] = useState<DeckSlug | null>(null);
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const results = useMemo(() => {
    return cards.filter((c) => {
      if (deck && c.deck !== deck) return false;
      if (tag && !c.tags.includes(tag)) return false;
      if (deferred) {
        const hay = `${c.id} ${c.prompt} ${c.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(deferred)) return false;
      }
      return true;
    });
  }, [cards, deck, tag, deferred]);

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-6">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts and tags"
            className="h-10 w-full rounded-full border border-rule bg-paper pr-4 pl-9 text-sm text-ink placeholder:text-ink-3"
          />
        </label>
        <div>
          <p className="text-xs font-medium text-ink-3">Deck</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip active={deck === null} onClick={() => setDeck(null)}>
              All
            </Chip>
            {decks.map((d) => (
              <Chip key={d.slug} active={deck === d.slug} onClick={() => setDeck(d.slug)}>
                {d.title}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-ink-3">Tags</p>
            {tag && (
              <button
                type="button"
                onClick={() => setTag(null)}
                className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"
              >
                <X className="h-3 w-3" /> clear
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Chip
                key={t.tag}
                active={tag === t.tag}
                onClick={() => setTag(tag === t.tag ? null : t.tag)}
              >
                {t.tag} <span className="ml-1 font-mono text-[10px] opacity-70">{t.count}</span>
              </Chip>
            ))}
          </div>
        </div>
      </aside>

      <section aria-live="polite">
        <p className="text-sm text-ink-3">
          {results.length} of {cards.length} cards
        </p>
        {results.length === 0 ? (
          <div className="index-card plain mt-4 px-6 py-10 text-center text-ink-2">
            No cards match. Clear a filter or{" "}
            <a
              href="https://github.com/masaok/metastack/issues/new?template=new-card.yml"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              suggest one
            </a>
            .
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-rule rounded-[var(--radius-card)] border border-rule bg-paper">
            {results.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cards/${c.id}`}
                  className="flex flex-col gap-2 px-5 py-4 hover:bg-paper-2 sm:flex-row sm:items-start sm:gap-5"
                >
                  <div className="flex shrink-0 items-center gap-1.5 sm:w-36 sm:flex-col sm:items-start">
                    <Badge tone="red">{c.deck}</Badge>
                    <Badge>{c.type}</Badge>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug text-ink">{c.prompt.trim()}</p>
                    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                      <span className="font-mono">#{c.id}</span>
                      <span>
                        difficulty {"●".repeat(c.difficulty)}
                        {"○".repeat(3 - c.difficulty)}
                      </span>
                      <span>{c.tags.join(", ")}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        active
          ? "border-ink bg-ink text-bg"
          : "border-rule bg-paper text-ink-2 hover:border-rule-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
