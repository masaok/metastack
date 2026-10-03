"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { DashboardRow } from "@/lib/dashboard/rows";
import type { SessionUser } from "@/lib/sync";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<DashboardRow["state"], string> = {
  new: "New",
  learning: "Learning",
  review: "Review",
  relearning: "Relearning",
};

const STATE_DOT: Record<DashboardRow["state"], string> = {
  new: "bg-ink-3",
  learning: "bg-amber",
  review: "bg-green",
  relearning: "bg-red",
};

const RATING_LABEL: Record<NonNullable<DashboardRow["rating"]>, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

export function DashboardView({
  rows,
  user,
  deckOptions,
}: {
  rows: DashboardRow[];
  user: SessionUser | null;
  deckOptions: Array<{ slug: string; title: string }>;
}) {
  const [query, setQuery] = useState("");
  const [deck, setDeck] = useState("all");
  const [state, setState] = useState("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (deck !== "all" && row.deck !== deck) return false;
      if (state !== "all" && row.state !== state) return false;
      if (!q) return true;
      return (
        row.id.includes(q) ||
        row.prompt.toLowerCase().includes(q) ||
        row.deckTitle.toLowerCase().includes(q)
      );
    });
  }, [rows, query, deck, state]);

  const studied = rows.filter((row) => row.state !== "new").length;

  return (
    <DashboardShell user={user} deckOptions={deckOptions} active="/dashboard">
      <section className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-rule bg-paper px-4 py-3">
          <h1 className="font-display text-base font-semibold">Cards</h1>
          <p className="text-sm text-ink-3">
            Studied {studied}/{rows.length}
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
          <label className="sr-only" htmlFor="deck-filter">
            Deck
          </label>
          <select
            id="deck-filter"
            value={deck}
            onChange={(event) => setDeck(event.target.value)}
            className="h-8 rounded-md border border-rule bg-bg px-2 text-sm"
          >
            <option value="all">All decks</option>
            {deckOptions.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.title}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="state-filter">
            State
          </label>
          <select
            id="state-filter"
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="h-8 rounded-md border border-rule bg-bg px-2 text-sm"
          >
            <option value="all">All states</option>
            <option value="new">New</option>
            <option value="learning">Learning</option>
            <option value="review">Review</option>
            <option value="relearning">Relearning</option>
          </select>
          <p className="ml-auto text-xs text-ink-3">
            {visible.length}/{rows.length}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-paper text-xs text-ink-3">
              <tr className="border-b border-rule">
                <th className="px-4 py-2 font-medium">Card</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Deck</th>
                <th className="px-3 py-2 font-medium">Prompt</th>
                <th className="px-3 py-2 font-medium">Last review</th>
                <th className="px-4 py-2 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-rule hover:bg-paper">
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={`/cards/${row.id}`}
                      className="font-mono text-xs text-ink hover:text-blue"
                    >
                      {row.id}
                    </Link>
                    <Link
                      href={`/study/card/${row.id}`}
                      aria-label={`Study ${row.id}`}
                      className="mt-1 block text-xs text-ink-3 hover:text-blue"
                    >
                      Study
                    </Link>
                  </td>
                  <td className="px-3 py-3 align-top whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", STATE_DOT[row.state])} />
                      <span>{STATE_LABEL[row.state]}</span>
                    </span>
                    <span className="mt-0.5 block pl-4 text-xs text-ink-3">
                      {row.reps} {row.reps === 1 ? "rep" : "reps"}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top whitespace-nowrap text-ink-2">
                    {row.deckTitle}
                  </td>
                  <td className="max-w-md px-3 py-3 align-top">
                    <p className="line-clamp-2">{row.prompt}</p>
                    <p className="mt-0.5 text-xs text-ink-3">{row.dueLabel}</p>
                  </td>
                  <td className="px-3 py-3 align-top whitespace-nowrap text-ink-2">
                    {row.lastReviewLabel}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-2">
                    {row.rating ? RATING_LABEL[row.rating] : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-sm text-ink-3">No cards match these filters.</p>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
