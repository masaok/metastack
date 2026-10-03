"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Rating } from "@metastack/srs";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ButtonLink } from "@/components/ui/button";
import {
  buildProgress,
  niceMax,
  type DayCount,
  type ProgressCard,
  type ProgressCounts,
  type ProgressReview,
  type ProgressState,
} from "@/lib/dashboard/progress";
import { db, getSettings } from "@/lib/db";
import type { SessionUser } from "@/lib/sync";
import { cn } from "@/lib/utils";

const RATING_ORDER = ["again", "hard", "good", "easy"] as const satisfies readonly Rating[];
const RATING_LABEL: Record<Rating, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

/** One hue, darker where further along. Not started is the empty track. */
const STAGES = [
  { key: "learned", label: "Learned", swatch: "bg-blue" },
  { key: "learning", label: "In progress", swatch: "bg-blue-soft" },
  { key: "notStarted", label: "Not started", swatch: "bg-rule" },
] as const;

const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
/** `day` is a local YYYY-MM-DD; parse it as local time, not UTC. */
const dayLabel = (day: string) => dayFormat.format(new Date(`${day}T00:00:00`));

export function DashboardProgress({
  user,
  cards,
  states,
  reviews,
  newLimit,
  decks,
  now,
}: {
  user: SessionUser | null;
  cards: ProgressCard[];
  /** The account's synced progress. Empty when signed out. */
  states: ProgressState[];
  reviews: ProgressReview[];
  newLimit: number;
  decks: Array<{ slug: string; title: string }>;
  now: number;
}) {
  const signedIn = user !== null;
  // Signed out, progress lives only in this browser. Either way the result is
  // undefined until the browser has mounted, so days are cut in the reader's time zone.
  const local = useLiveQuery(async () => {
    if (signedIn) return null;
    const [cardStates, stored, settings] = await Promise.all([
      db().cardStates.toArray(),
      db().reviews.toArray(),
      getSettings(),
    ]);
    return { states: cardStates, reviews: stored, newLimit: settings.newLimit };
  }, [signedIn]);

  const summary = useMemo(() => {
    if (local === undefined) return null;
    const source = local ?? { states, reviews, newLimit };
    return buildProgress(cards, source.states, source.reviews, decks, source.newLimit, now);
  }, [local, cards, states, reviews, newLimit, decks, now]);

  return (
    <DashboardShell user={user} deckOptions={decks} active="/dashboard">
      <section className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-rule bg-paper px-4 py-3">
          <h1 className="font-display text-base font-semibold">Progress</h1>
          <p className="text-sm text-ink-3">
            {signedIn ? "From your account" : "From this browser"}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-4">
          {summary ? (
            <ProgressBody summary={summary} newLimit={local?.newLimit ?? newLimit} />
          ) : (
            <div className="h-64 animate-pulse rounded-xl border border-rule bg-paper" />
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

function ProgressBody({
  summary,
  newLimit,
}: {
  summary: ReturnType<typeof buildProgress>;
  newLimit: number;
}) {
  const { totals } = summary;
  const started = totals.learned + totals.learning;
  const percent = totals.total ? Math.round((totals.learned / totals.total) * 100) : 0;

  const tiles = [
    {
      label: "Due now",
      value: totals.due,
      note: totals.due === 0 ? "nothing waiting" : "reviews waiting",
    },
    {
      label: "Not started",
      value: totals.notStarted,
      note:
        totals.notStarted === 0
          ? "you have met every card"
          : `about ${summary.daysOfNewCards} study ${summary.daysOfNewCards === 1 ? "day" : "days"} at ${newLimit} new a day`,
    },
    {
      label: "Reviews this week",
      value: summary.reviewsThisWeek,
      note: `${summary.reviews} all time`,
    },
    {
      label: "Day streak",
      value: summary.streak,
      note: summary.streak === 0 ? "study today to start one" : "days in a row",
    },
    {
      label: "Recall",
      value: summary.recall === null ? "—" : `${Math.round(summary.recall * 100)}%`,
      note: "reviews of seen cards not rated Again",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <section className="rounded-xl border border-rule bg-paper px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">Cards learned</p>
            <p className="mt-1 text-5xl font-semibold tracking-tight text-ink">
              {totals.learned}
              <span className="text-2xl font-medium text-ink-3"> of {totals.total}</span>
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {percent}% learned · {started} of {totals.total} started · {totals.notStarted} to go
            </p>
          </div>
          <ButtonLink href="/study">
            {totals.due > 0
              ? `Study ${totals.due} due`
              : started === 0
                ? "Start studying"
                : "Study"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>
        <StageBar counts={totals} className="mt-5 h-3" />
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
          {STAGES.map((stage) => (
            <li key={stage.key} className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-sm", stage.swatch)} aria-hidden />
              {stage.label}
              <span className="font-mono text-xs text-ink">{totals[stage.key]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-3">
          A card is learned once it leaves its first learning steps and is on a review schedule. In
          progress covers cards still in those steps and cards being relearned after a miss.
        </p>
      </section>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-rule bg-paper px-4 py-3">
            <dt className="text-xs font-medium tracking-wide text-ink-3 uppercase">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink">{tile.value}</dd>
            <dd className="text-xs text-ink-3">{tile.note}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border border-rule bg-paper">
        <h2 className="border-b border-rule px-4 py-2.5 text-sm font-medium">By deck</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="text-xs text-ink-3">
              <tr className="border-b border-rule">
                <th className="px-4 py-2 font-medium">Deck</th>
                <th className="w-2/5 px-3 py-2 font-medium">Progress</th>
                <th className="px-3 py-2 text-right font-medium">Learned</th>
                <th className="px-3 py-2 text-right font-medium">In progress</th>
                <th className="px-3 py-2 text-right font-medium">Not started</th>
                <th className="px-4 py-2 text-right font-medium">Due now</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {summary.decks.map((deck) => (
                <tr key={deck.slug} className="border-b border-rule last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/study/${deck.slug}`} className="font-medium hover:text-blue">
                      {deck.title}
                    </Link>
                    <p className="text-xs text-ink-3">{deck.total} cards</p>
                  </td>
                  <td className="px-3 py-3">
                    <StageBar counts={deck} className="h-2" />
                  </td>
                  <td className="px-3 py-3 text-right">{deck.learned}</td>
                  <td className="px-3 py-3 text-right">{deck.learning}</td>
                  <td className="px-3 py-3 text-right">{deck.notStarted}</td>
                  <td className="px-4 py-3 text-right">{deck.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ColumnChart
          title="Reviews, last 30 days"
          unit="review"
          days={summary.activity}
          empty="No reviews in the last 30 days."
        />
        <ColumnChart
          title="Coming due, next 14 days"
          unit="card"
          days={summary.forecast}
          firstLabel="Today"
          empty="Nothing is scheduled yet."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-rule bg-paper">
          <h2 className="border-b border-rule px-4 py-2.5 text-sm font-medium">How you rated</h2>
          {summary.reviews === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-3">No reviews yet.</p>
          ) : (
            <ul className="space-y-2 px-4 py-3">
              {RATING_ORDER.map((rating) => {
                const n = summary.ratings[rating];
                const share = Math.round((n / summary.reviews) * 100);
                return (
                  <li key={rating} className="text-sm">
                    <div className="flex items-baseline justify-between">
                      <span>{RATING_LABEL[rating]}</span>
                      <span className="font-mono text-xs text-ink-3">
                        {n} · {share}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-rule/60">
                      <div className="h-full rounded-full bg-blue" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-rule bg-paper">
          <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
            <h2 className="text-sm font-medium">Cards to work on</h2>
            <Link href="/dashboard/cards" className="text-xs text-ink-3 hover:text-ink">
              All my cards
            </Link>
          </div>
          {summary.weakest.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-3">
              {started === 0
                ? "Cards you miss will be listed here."
                : "No misses so far. Cards you rate Again or Hard will be listed here."}
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {summary.weakest.map((card) => (
                <li key={card.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/study/card/${card.id}`} className="line-clamp-1 hover:text-blue">
                      {card.prompt}
                    </Link>
                    <p className="text-xs text-ink-3">
                      {card.lapses} {card.lapses === 1 ? "lapse" : "lapses"}
                      {card.lastRating ? ` · last rated ${RATING_LABEL[card.lastRating]}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Learned, in progress and not started as one bar. Segments are separated by a gap, not a border. */
function StageBar({ counts, className }: { counts: ProgressCounts; className?: string }) {
  const label = STAGES.map((stage) => `${counts[stage.key]} ${stage.label.toLowerCase()}`).join(
    ", ",
  );
  return (
    <div role="img" aria-label={label} className={cn("flex w-full gap-0.5", className)}>
      {STAGES.map((stage) =>
        counts[stage.key] > 0 ? (
          <div
            key={stage.key}
            title={`${stage.label}: ${counts[stage.key]}`}
            className={cn("h-full min-w-1 rounded-sm", stage.swatch)}
            style={{ flexGrow: counts[stage.key], flexBasis: 0 }}
          />
        ) : null,
      )}
    </div>
  );
}

const PLOT_HEIGHT = 144;

/** One series of daily counts as thin columns. Hovering a day names it above the plot. */
function ColumnChart({
  title,
  unit,
  days,
  firstLabel,
  empty,
}: {
  title: string;
  unit: string;
  days: DayCount[];
  /** Label for the first day when it is not a date, e.g. "Today". */
  firstLabel?: string;
  empty: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const max = niceMax(Math.max(...days.map((d) => d.count)));
  const plural = (n: number) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const name = (i: number) => (i === 0 && firstLabel ? firstLabel : dayLabel(days[i]!.day));
  const active = hover === null ? null : days[hover]!;
  const middle = Math.floor((days.length - 1) / 2);

  return (
    <section className="rounded-xl border border-rule bg-paper">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="font-mono text-xs text-ink-3" aria-live="polite">
          {active ? `${name(hover!)} · ${plural(active.count)}` : `${plural(total)} in all`}
        </p>
      </div>
      {total === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-3">{empty}</p>
      ) : (
        <div className="px-4 pt-4 pb-3">
          <div className="flex gap-2">
            <div
              className="flex w-6 shrink-0 flex-col justify-between text-right font-mono text-[10px] leading-none text-ink-3 tabular-nums"
              style={{ height: PLOT_HEIGHT }}
              aria-hidden
            >
              <span>{max}</span>
              <span>{max / 2}</span>
              <span>0</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative" style={{ height: PLOT_HEIGHT }}>
                {[0, 50, 100].map((top) => (
                  <div
                    key={top}
                    className="absolute inset-x-0 border-t border-rule/60"
                    style={{ top: `${top}%` }}
                    aria-hidden
                  />
                ))}
                <div
                  className="absolute inset-0 flex items-end"
                  onMouseLeave={() => setHover(null)}
                >
                  {days.map((d, i) => (
                    <div
                      key={d.day}
                      className="flex h-full min-w-0 flex-1 items-end justify-center"
                      onMouseEnter={() => setHover(i)}
                    >
                      <div
                        className={cn(
                          "w-full max-w-6 rounded-t bg-blue",
                          // A 2px gap between neighbours when columns are packed.
                          "mx-px",
                          hover !== null && hover !== i && "opacity-50",
                        )}
                        style={{ height: `${(d.count / max) * 100}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div
                className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-3"
                aria-hidden
              >
                <span>{name(0)}</span>
                <span>{name(middle)}</span>
                <span>{name(days.length - 1)}</span>
              </div>
            </div>
          </div>
          <details className="mt-2 text-xs text-ink-3">
            <summary className="cursor-pointer hover:text-ink">Show as a table</summary>
            <table className="mt-2 w-full border-collapse text-left tabular-nums">
              <thead>
                <tr className="border-b border-rule">
                  <th className="py-1 font-medium">Day</th>
                  <th className="py-1 text-right font-medium capitalize">{unit}s</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => (
                  <tr key={d.day} className="border-b border-rule/60 last:border-b-0">
                    <td className="py-1">{name(i)}</td>
                    <td className="py-1 text-right text-ink-2">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </section>
  );
}
