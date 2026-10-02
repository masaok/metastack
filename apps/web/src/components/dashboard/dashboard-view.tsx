"use client";

import {
  BookOpen,
  GalleryVerticalEnd,
  Layers,
  LayoutGrid,
  LogIn,
  Play,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Logo } from "@/components/logo";
import type { DashboardRow } from "@/lib/dashboard/rows";
import type { SessionUser } from "@/lib/sync";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/study", label: "Study", icon: Play },
  { href: "/decks", label: "Decks", icon: Layers },
  { href: "/cards", label: "Cards", icon: GalleryVerticalEnd },
  { href: "/blog", label: "Blog", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

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
    <div className="flex h-full min-h-0 bg-bg text-ink">
      <aside className="flex h-full w-14 shrink-0 flex-col border-r border-rule bg-paper sm:w-60">
        <div className="flex shrink-0 items-center gap-2 border-b border-rule px-3 py-3">
          <Logo className="h-7 w-7 shrink-0" />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate font-display text-sm font-semibold">MetaStack</p>
            <p className="truncate text-xs text-ink-3">{user ? user.login : "Signed out"}</p>
          </div>
        </div>
        <nav
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
          aria-label="Dashboard"
        >
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/dashboard";
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink",
                      active && "bg-paper-2 font-medium text-ink",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden truncate sm:inline">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 hidden px-2 text-xs font-medium tracking-wide text-ink-3 uppercase sm:block">
            Decks
          </p>
          <ul className="mt-1 hidden space-y-0.5 sm:block">
            {deckOptions.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/study/${item.slug}`}
                  className="block truncate rounded-md px-2 py-1.5 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="shrink-0 border-t border-rule p-2">
          {user ? (
            <div className="flex items-center gap-2 px-1 py-1">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-full border border-rule"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-2 text-xs font-medium">
                  {user.login.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="hidden min-w-0 flex-1 sm:block">
                <p className="truncate text-sm">{user.login}</p>
                {user.admin ? <p className="text-xs text-red">Admin</p> : null}
                <a href="/api/auth/logout" className="text-xs text-ink-3 hover:text-ink">
                  Sign out
                </a>
              </div>
            </div>
          ) : (
            <a
              href="/api/auth/github"
              className="flex items-center justify-center gap-2 rounded-md bg-ink px-2 py-2 text-sm text-bg hover:opacity-90 sm:justify-start"
            >
              <LogIn className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
              <span className="sr-only sm:not-sr-only">Sign in with GitHub</span>
            </a>
          )}
        </div>
      </aside>

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
    </div>
  );
}
