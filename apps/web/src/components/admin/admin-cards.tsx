"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Card } from "@metastack/content";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { SessionUser } from "@/lib/sync";

export type AdminCardRow = Pick<
  Card,
  "id" | "deck" | "type" | "difficulty" | "prompt" | "updated" | "reviewed"
>;

export function AdminCards({
  user,
  cards,
  deckOptions,
}: {
  user: SessionUser;
  cards: AdminCardRow[];
  deckOptions: Array<{ slug: string; title: string }>;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (card) =>
        card.id.includes(q) || card.prompt.toLowerCase().includes(q) || card.deck.includes(q),
    );
  }, [cards, query]);
  const drafts = cards.filter((card) => !card.reviewed).length;

  return (
    <DashboardShell user={user} deckOptions={deckOptions} active="/admin/cards">
      <section className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-rule bg-paper px-4 py-3">
          <h1 className="font-display text-base font-semibold">Cards</h1>
          <p className="text-sm text-ink-3">
            {cards.length - drafts} published · {drafts} {drafts === 1 ? "draft" : "drafts"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-rule bg-paper px-4 py-2">
          <label className="sr-only" htmlFor="card-search">
            Search cards
          </label>
          <input
            id="card-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cards"
            className="h-8 w-full rounded-md border border-rule bg-bg px-3 text-sm outline-none placeholder:text-ink-3 focus:border-rule-strong sm:w-56"
          />
          <p className="text-xs text-ink-3">
            {visible.length}/{cards.length}
          </p>
          <ButtonLink href="/admin/cards/new" size="sm" className="ml-auto">
            <Plus className="h-4 w-4" aria-hidden /> New card
          </ButtonLink>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-paper text-xs text-ink-3">
              <tr className="border-b border-rule">
                <th className="px-4 py-2 font-medium">Card</th>
                <th className="px-3 py-2 font-medium">Deck</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((card) => (
                <tr key={card.id} className="border-b border-rule hover:bg-paper">
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={`/admin/cards/${card.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {card.prompt.trim()}
                    </Link>
                    <p className="font-mono text-xs text-ink-3">#{card.id}</p>
                  </td>
                  <td className="px-3 py-3 align-top text-ink-2">{card.deck}</td>
                  <td className="px-3 py-3 align-top whitespace-nowrap text-ink-2">
                    {card.type} · {card.difficulty}/3
                  </td>
                  <td className="px-3 py-3 align-top">
                    {card.reviewed ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs whitespace-nowrap text-ink-2">
                    {card.updated}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-sm text-ink-3">
              {cards.length === 0 ? "No cards yet." : "No cards match this search."}
            </p>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
