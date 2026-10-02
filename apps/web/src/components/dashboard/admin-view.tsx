"use client";

import { useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { relativeTime } from "@/lib/dashboard/rows";
import type { SiteOverview } from "@/lib/site";
import type { SessionUser } from "@/lib/sync";

export function AdminView({
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
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return site.accounts;
    return site.accounts.filter((account) => {
      return (
        account.login.toLowerCase().includes(q) ||
        (account.name?.toLowerCase().includes(q) ?? false) ||
        (account.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [site.accounts, query]);

  return (
    <DashboardShell user={user} deckOptions={deckOptions} active="/admin">
      <section className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-rule bg-paper px-4 py-3">
          <h1 className="font-display text-base font-semibold">Admin</h1>
          <p className="text-sm text-ink-3">
            {site.users} {site.users === 1 ? "account" : "accounts"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-rule bg-paper px-4 py-2">
          <label className="sr-only" htmlFor="account-search">
            Search accounts
          </label>
          <input
            id="account-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search accounts"
            className="h-8 w-full rounded-md border border-rule bg-bg px-3 text-sm outline-none placeholder:text-ink-3 focus:border-rule-strong sm:w-56"
          />
          <p className="text-xs text-ink-3">
            {bank} cards in the bank · {site.cardsStudied} studied · {site.reviews} reviews
          </p>
          <p className="ml-auto text-xs text-ink-3">
            {visible.length}/{site.accounts.length}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-paper text-xs text-ink-3">
              <tr className="border-b border-rule">
                <th className="px-4 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Cards</th>
                <th className="px-3 py-2 font-medium">Reviews</th>
                <th className="px-3 py-2 font-medium">Last review</th>
                <th className="px-4 py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((account) => (
                <tr key={account.id} className="border-b border-rule hover:bg-paper">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium">{account.login}</p>
                    {account.name ? <p className="text-xs text-ink-3">{account.name}</p> : null}
                  </td>
                  <td className="px-3 py-3 align-top text-ink-2">{account.email ?? "—"}</td>
                  <td className="px-3 py-3 align-top whitespace-nowrap">{account.cards}</td>
                  <td className="px-3 py-3 align-top whitespace-nowrap">{account.reviews}</td>
                  <td className="px-3 py-3 align-top whitespace-nowrap text-ink-2">
                    {account.lastReview
                      ? relativeTime(account.lastReview, now, "ago")
                      : "Not studied"}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-ink-2">
                    {account.createdAt ? relativeTime(account.createdAt, now, "ago") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-sm text-ink-3">
              {site.accounts.length === 0 ? "No accounts yet." : "No accounts match this search."}
            </p>
          ) : null}
          <p className="px-4 py-4 text-xs text-ink-3">
            Ratings: Again {site.ratings.again}, Hard {site.ratings.hard}, Good {site.ratings.good},
            Easy {site.ratings.easy}
          </p>
        </div>
      </section>
    </DashboardShell>
  );
}
