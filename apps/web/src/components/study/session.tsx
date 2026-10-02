"use client";

import { ArrowRight, ExternalLink, PenLine, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Card } from "@metastack/content";
import {
  buildSession,
  createCardState,
  formatInterval,
  previewDue,
  rate,
  ratingFromRubric,
  RATINGS,
  type CardState,
  type Rating,
} from "@metastack/srs";

import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  countNewIntroducedToday,
  db,
  getSettings,
  saveReview,
  setSetting,
  type Settings,
  type StudyMode,
} from "@/lib/db";
import { pushReview } from "@/lib/sync";
import { cn } from "@/lib/utils";

type Status = "loading" | "ready" | "empty" | "done";

const RATING_LABEL: Record<Rating, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

const RATING_KEY: Record<Rating, string> = { again: "1", hard: "2", good: "3", easy: "4" };
const RATING_LETTER: Record<string, Rating> = { a: "again", h: "hard", g: "good", e: "easy" };

const RATING_TONE: Record<Rating, string> = {
  again: "border-red/40 text-red-ink",
  hard: "border-amber/50 text-amber",
  good: "border-blue/40 text-blue",
  easy: "border-green/40 text-green",
};

function shuffle<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

async function loadSession(cardIds: string[], opts: { ignoreLimit?: boolean }) {
  const [settings, rows, introduced] = await Promise.all([
    getSettings(),
    db().cardStates.where("cardId").anyOf(cardIds).toArray(),
    countNewIntroducedToday(),
  ]);
  const session = buildSession({
    cardIds,
    states: rows,
    newLimit: opts.ignoreLimit ? 10 : settings.newLimit,
    newIntroducedToday: opts.ignoreLimit ? 0 : introduced,
    shuffle,
  });
  let nextDueLabel: string | null = null;
  if (session.queue.length === 0) {
    const learned = rows.filter((r) => r.state !== "new");
    if (learned.length > 0) {
      const soonest = learned.reduce((a, b) =>
        new Date(a.due).getTime() < new Date(b.due).getTime() ? a : b,
      );
      nextDueLabel = formatInterval(new Date(), soonest.due);
    }
  }
  return {
    settings,
    states: new Map(rows.map((r) => [r.cardId, r])),
    queue: session.queue,
    counts: { due: session.dueCount, fresh: session.newCount },
    nextDueLabel,
  };
}

export function StudySession({ cards, title }: { cards: Card[]; title: string }) {
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const [status, setStatus] = useState<Status>("loading");
  const [settings, setSettings] = useState<Settings>({ newLimit: 10, mode: "rubric" });
  const [states, setStates] = useState<Map<string, CardState>>(new Map());
  const [queue, setQueue] = useState<string[]>([]);
  const [counts, setCounts] = useState({ due: 0, fresh: 0 });
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"prompt" | "revealed">("prompt");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratch, setScratch] = useState("");
  const [tally, setTally] = useState<Record<Rating, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [nextDueLabel, setNextDueLabel] = useState<string | null>(null);
  const [timing, setTiming] = useState({ startedAt: 0, finishedAt: 0 });
  const scratchRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(
    (opts: { ignoreLimit?: boolean } = {}) =>
      loadSession(cardIds, opts).then((loaded) => {
        setSettings(loaded.settings);
        setStates(loaded.states);
        setQueue(loaded.queue);
        setCounts(loaded.counts);
        setIndex(0);
        setPhase("prompt");
        setChecked(new Set());
        setScratch("");
        setTally({ again: 0, hard: 0, good: 0, easy: 0 });
        setTiming({ startedAt: Date.now(), finishedAt: 0 });
        setNextDueLabel(loaded.nextDueLabel);
        setStatus(loaded.queue.length === 0 ? "empty" : "ready");
      }),
    [cardIds],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const currentId = queue[index];
  const current = currentId ? cardById.get(currentId) : undefined;
  const currentState = useMemo(
    () => (currentId ? (states.get(currentId) ?? createCardState(currentId)) : undefined),
    [currentId, states],
  );
  const previews = useMemo(
    () => (currentState && phase === "revealed" ? previewDue(currentState) : null),
    [currentState, phase],
  );

  const suggested: Rating | null =
    current && phase === "revealed" && settings.mode === "rubric"
      ? ratingFromRubric(checked.size, current.keyPoints.length)
      : null;

  const applyRating = useCallback(
    async (rating: Rating) => {
      if (!current || !currentState) return;
      const result = rate(currentState, rating);
      await saveReview(result.state, result.review);
      void pushReview(result.state, result.review).catch(() => undefined);
      setStates((prev) => new Map(prev).set(current.id, result.state));
      setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
      if (index + 1 >= queue.length) {
        setTiming((t) => ({ ...t, finishedAt: Date.now() }));
        setStatus("done");
      } else {
        setIndex(index + 1);
        setPhase("prompt");
        setChecked(new Set());
        setScratch("");
      }
    },
    [current, currentState, index, queue.length],
  );

  const reveal = useCallback(() => setPhase("revealed"), []);

  async function setMode(mode: StudyMode) {
    setSettings((s) => ({ ...s, mode }));
    await setSetting("mode", mode);
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (status !== "ready") return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLInputElement &&
          !["checkbox", "radio", "range"].includes(target.type)) ||
        target?.isContentEditable;

      // Enter on a focused button or link activates it; the shortcut stays out of the way.
      if (
        e.key === "Enter" &&
        (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement)
      ) {
        return;
      }

      if (inField) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && phase === "prompt") {
          e.preventDefault();
          reveal();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (phase === "prompt") {
        if (e.code === "Space" || e.key === "Enter") {
          e.preventDefault();
          reveal();
        }
        return;
      }

      // revealed
      if (settings.mode === "quick") {
        const r = RATINGS.find((x) => RATING_KEY[x] === e.key);
        if (r) {
          e.preventDefault();
          void applyRating(r);
        }
        return;
      }

      if (/^[1-9]$/.test(e.key) && current) {
        const i = Number(e.key) - 1;
        if (i < current.keyPoints.length) {
          e.preventDefault();
          setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
          });
        }
        return;
      }
      if (e.key === "Enter" && suggested) {
        e.preventDefault();
        void applyRating(suggested);
        return;
      }
      const letter = RATING_LETTER[e.key.toLowerCase()];
      if (letter) {
        e.preventDefault();
        void applyRating(letter);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, phase, settings.mode, current, suggested, applyRating, reveal]);

  // ---- Render states ----

  if (status === "loading") {
    return (
      <SessionFrame title={title}>
        <div className="index-card plain h-[360px] animate-pulse" />
      </SessionFrame>
    );
  }

  if (status === "empty") {
    return (
      <SessionFrame title={title}>
        <div className="index-card plain px-8 py-10 text-center">
          <h2 className="font-display text-2xl font-bold text-ink">
            {nextDueLabel ? "Nothing due right now" : "Daily new-card limit reached"}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-2">
            {nextDueLabel
              ? `Your next card in this set is due in ${nextDueLabel}. Come back then, or pull in a few new cards now.`
              : `You have introduced ${settings.newLimit} new cards today. You can raise the limit in Settings or keep going anyway.`}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button onClick={() => void load({ ignoreLimit: true })}>Study 10 more now</Button>
            <ButtonLink href="/decks" variant="outline">
              Pick another deck
            </ButtonLink>
          </div>
        </div>
      </SessionFrame>
    );
  }

  if (status === "done") {
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    const mins = Math.max(1, Math.round((timing.finishedAt - timing.startedAt) / 60000));
    return (
      <SessionFrame title={title}>
        <div className="index-card plain px-8 py-10">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink">
            {total} {total === 1 ? "card" : "cards"} in about {mins}{" "}
            {mins === 1 ? "minute" : "minutes"}
          </h2>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RATINGS.map((r) => (
              <div key={r} className={cn("rounded-xl border bg-paper-2 px-4 py-3", RATING_TONE[r])}>
                <dt className="text-xs font-medium tracking-wide uppercase opacity-80">
                  {RATING_LABEL[r]}
                </dt>
                <dd className="mt-1 font-mono text-2xl text-ink">{tally[r]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-ink-2">
            Everything is saved in this browser. Close the tab; the cards you rated Again or Hard
            will be waiting when you come back.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button onClick={() => void load({ ignoreLimit: true })}>
              Study 10 more <ArrowRight className="h-4 w-4" />
            </Button>
            <ButtonLink href="/decks" variant="outline">
              Back to decks
            </ButtonLink>
            <ButtonLink href="/settings" variant="ghost">
              Export progress
            </ButtonLink>
          </div>
        </div>
      </SessionFrame>
    );
  }

  if (!current || !currentState) return null;

  const isNew = currentState.state === "new";

  return (
    <SessionFrame
      title={title}
      right={
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-ink-3">
            {index + 1}/{queue.length}
            <span className="hidden sm:inline">
              {" "}
              · {counts.due} due · {counts.fresh} new
            </span>
          </span>
          <div
            role="group"
            aria-label="Study mode"
            className="flex rounded-full border border-rule p-0.5 text-xs"
          >
            {(["rubric", "quick"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => void setMode(m)}
                aria-pressed={settings.mode === m}
                className={cn(
                  "rounded-full px-2.5 py-1 capitalize",
                  settings.mode === m ? "bg-ink text-bg" : "text-ink-2 hover:text-ink",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-rule">
        <div
          className="h-full bg-red transition-[width] duration-300"
          style={{ width: `${(index / queue.length) * 100}%` }}
        />
      </div>

      <article
        className={cn("index-card px-6 pt-5 pb-6 sm:px-9", phase === "revealed" && "header-only")}
        style={{ ["--rule-top" as string]: "68px" }}
      >
        <header className="flex flex-wrap items-center gap-2">
          <Badge tone="red">{current.deck}</Badge>
          <Badge>{current.type}</Badge>
          <Badge tone={isNew ? "blue" : "neutral"}>{isNew ? "new" : "review"}</Badge>
          <span className="ml-auto hidden font-mono text-xs text-ink-3 sm:inline">
            #{current.id}
          </span>
        </header>

        <h2 className="mt-6 font-display text-[1.5rem] leading-[1.3] font-semibold tracking-tight text-ink sm:text-[1.8rem]">
          {current.prompt.trim()}
        </h2>

        {phase === "prompt" && (
          <div className="mt-8">
            {scratchOpen ? (
              <textarea
                ref={scratchRef}
                value={scratch}
                onChange={(e) => setScratch(e.target.value)}
                placeholder="Sketch your answer. Cmd/Ctrl+Enter to reveal."
                rows={5}
                className="w-full resize-y rounded-xl border border-rule bg-paper-2 px-4 py-3 font-mono text-sm text-ink placeholder:text-ink-3"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setScratchOpen(true);
                  setTimeout(() => scratchRef.current?.focus(), 0);
                }}
                className="inline-flex items-center gap-2 text-sm text-ink-2 hover:text-ink"
              >
                <PenLine className="h-4 w-4" /> Add a scratchpad
              </button>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={reveal}>
                Reveal key points
              </Button>
              <span className="text-sm text-ink-3">
                or press <Kbd>space</Kbd>
              </span>
            </div>
          </div>
        )}

        {phase === "revealed" && (
          <div className="mt-7">
            <h3 className="text-sm font-medium text-ink-2">
              {settings.mode === "rubric" ? "Tick the points you covered" : "Key points"}
            </h3>
            <ol className="mt-3 space-y-2">
              {current.keyPoints.map((kp, i) => {
                const on = checked.has(i);
                const Row = settings.mode === "rubric" ? "label" : "div";
                return (
                  <li key={kp}>
                    <Row
                      className={cn(
                        "-mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5",
                        settings.mode === "rubric" && "cursor-pointer hover:bg-paper-2",
                      )}
                    >
                      {settings.mode === "rubric" ? (
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setChecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              return next;
                            })
                          }
                          className="mt-1 h-4 w-4 shrink-0 accent-[var(--red)]"
                        />
                      ) : (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />
                      )}
                      <span className={cn("leading-snug", on && "text-ink-2")}>{kp}</span>
                      {settings.mode === "rubric" && i < 9 && (
                        <Kbd className="mt-0.5 ml-auto hidden sm:inline-flex">{i + 1}</Kbd>
                      )}
                    </Row>
                  </li>
                );
              })}
            </ol>

            {scratch.trim() && (
              <div className="mt-5 rounded-xl border border-rule bg-paper-2 px-4 py-3">
                <p className="text-xs font-medium text-ink-3">Your scratchpad</p>
                <pre className="mt-1 font-mono text-sm whitespace-pre-wrap text-ink-2">
                  {scratch}
                </pre>
              </div>
            )}

            <div className="mt-8 border-t border-rule pt-6">
              {settings.mode === "rubric" && suggested && (
                <p className="mb-3 text-sm text-ink-2">
                  {checked.size}/{current.keyPoints.length} covered → suggested{" "}
                  <strong className="text-ink">{RATING_LABEL[suggested]}</strong>. Press{" "}
                  <Kbd>enter</Kbd> to accept or pick another.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RATINGS.map((r) => (
                  <Button
                    key={r}
                    variant="rate"
                    size="lg"
                    onClick={() => void applyRating(r)}
                    className={cn(
                      "h-auto flex-col gap-0.5 py-2.5",
                      RATING_TONE[r],
                      suggested === r && "ring-2 ring-ink/70 ring-offset-2 ring-offset-paper",
                    )}
                  >
                    <span className="font-medium">{RATING_LABEL[r]}</span>
                    <span className="font-mono text-xs text-ink-3">
                      {previews ? formatInterval(new Date(), previews[r]) : ""}
                    </span>
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-3">
                {settings.mode === "quick" ? (
                  <>
                    Rate with <Kbd>1</Kbd>–<Kbd>4</Kbd>.
                  </>
                ) : (
                  <>
                    Override with <Kbd>A</Kbd> <Kbd>H</Kbd> <Kbd>G</Kbd> <Kbd>E</Kbd>.
                  </>
                )}
              </p>
            </div>

            <details className="group mt-8">
              <summary className="cursor-pointer list-none text-sm font-medium text-ink-2 hover:text-ink">
                <span className="inline-flex items-center gap-2">
                  <RotateCcw className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  Model answer
                  {current.stages && ` · ${current.stages.length} stages`}
                </span>
              </summary>
              <div className="mt-4">
                {current.stages && (
                  <ol className="mb-6 space-y-3">
                    {current.stages.map((stage, i) => (
                      <li
                        key={stage.name}
                        className="rounded-xl border border-rule bg-paper-2 px-4 py-3"
                      >
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
                )}
                <Markdown source={current.body} />
                {current.followUps.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-ink-2">Likely follow-ups</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
                      {current.followUps.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-6 text-sm">
                  <Link
                    href={`/cards/${current.id}`}
                    className="inline-flex items-center gap-1 text-ink-2 underline underline-offset-4 hover:text-ink"
                  >
                    Open this card <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </p>
              </div>
            </details>
          </div>
        )}
      </article>
    </SessionFrame>
  );
}

function SessionFrame({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">{title}</h1>
        {right}
      </div>
      {children}
    </div>
  );
}
