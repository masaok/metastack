"use client";

import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { relativeTime } from "@/lib/dashboard/rows";
import type { SiteOverview } from "@/lib/site";
import type { SessionUser } from "@/lib/sync";

const RATING_ORDER = ["again", "hard", "good", "easy"] as const;

export function AdminOverview({
  user,
  site,
  bank,
  deckOptions,
  now,
}: {
  user: SessionUser;
  site: SiteOverview;
  bank: number;
  deckOptions: Array<{ slug: string; title: string }>;
  now: number;
}) {
  const recent = site.accounts.slice(0, 5);
  const active = site.accounts.filter((account) => account.reviews > 0).length;
  const tiles = [
    { label: "Accounts", value: site.users, note: `${active} have studied` },
    { label: "Reviews", value: site.reviews, note: "all time" },
    { label: "Cards studied", value: site.cardsStudied, note: "across all accounts" },
    { label: "Card bank", value: bank, note: "published cards" },
  ];

  return (
    <DashboardShell user={user} deckOptions={deckOptions} active="/admin">
      <section className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-rule bg-paper px-4 py-3">
          <h1 className="font-display text-base font-semibold">Overview</h1>
          <p className="text-sm text-ink-3">Site totals</p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-4">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-rule bg-paper px-4 py-3">
                <dt className="text-xs font-medium tracking-wide text-ink-3 uppercase">
                  {tile.label}
                </dt>
                <dd className="mt-1 font-mono text-2xl text-ink">{tile.value}</dd>
                <dd className="text-xs text-ink-3">{tile.note}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-rule bg-paper">
              <h2 className="border-b border-rule px-4 py-2.5 text-sm font-medium">Ratings</h2>
              <ul className="space-y-2 px-4 py-3">
                {RATING_ORDER.map((rating) => {
                  const n = site.ratings[rating];
                  const share = site.reviews ? Math.round((n / site.reviews) * 100) : 0;
                  return (
                    <li key={rating} className="text-sm">
                      <div className="flex items-baseline justify-between">
                        <span className="capitalize">{rating}</span>
                        <span className="font-mono text-xs text-ink-3">
                          {n} · {share}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-rule">
                        <div className="h-full bg-ink/70" style={{ width: `${share}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-xl border border-rule bg-paper">
              <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
                <h2 className="text-sm font-medium">Newest accounts</h2>
                <Link
                  href="/admin/users"
                  className="text-xs text-ink-2 underline-offset-4 hover:underline"
                >
                  All users
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="px-4 py-6 text-sm text-ink-3">No accounts yet.</p>
              ) : (
                <ul className="divide-y divide-rule">
                  {recent.map((account) => (
                    <li
                      key={account.id}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{account.login}</p>
                        {account.name ? (
                          <p className="truncate text-xs text-ink-3">{account.name}</p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-xs text-ink-3">
                        {account.createdAt ? relativeTime(account.createdAt, now, "ago") : "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
