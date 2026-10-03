"use client";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PenLine,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cardsForDeck, type Card } from "@metastack/content";
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
import { ExercisePanel } from "@/components/study/exercise-panel";
import { Button, ButtonLink } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  countNewIntroducedToday,
  db,
  DEFAULT_SETTINGS,
  getSettings,
  saveReview,
  type Settings,
  type StudyMode,
} from "@/lib/db";
import { studyCardPath } from "@/lib/study-url";
import { buildExercise, EXERCISE_LABEL, type Exercise } from "@/lib/study/exercise";
import { pushReview, savePreference } from "@/lib/sync";
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

/** Label colour only. Borders stay the shared hairline; translucent borders paint badly in Chromium. */
const RATING_TONE: Record<Rating, string> = {
  again: "text-red-ink",
  hard: "text-amber",
  good: "text-blue",
  easy: "text-green",
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

/** Show these cards in this order, including ones the scheduler would skip. */
async function loadFixed(cardIds: string[]) {
  const [settings, rows] = await Promise.all([
    getSettings(),
    cardIds.length ? db().cardStates.where("cardId").anyOf(cardIds).toArray() : Promise.resolve([]),
  ]);
  const learned = rows.filter((row) => row.state !== "new");
  const due = learned.filter((row) => new Date(row.due).getTime() <= Date.now());
  return {
    settings,
    states: new Map(rows.map((row) => [row.cardId, row])),
    queue: cardIds,
    counts: { due: due.length, fresh: cardIds.length - learned.length },
    nextDueLabel: null as string | null,
  };
}

export function StudySession({
  cards,
  bank,
  title,
  scope = "all",
  activeId,
  onQueue,
}: {
  cards: Card[];
  /** Every card, for stepping through a deck from a card opened by its own URL. */
  bank: readonly Card[];
  title: string;
  scope?: string;
  /** Card named by the URL. Absent while a fresh session is still at `/study`. */
  activeId?: string;
  onQueue?: (ids: string[]) => void;
}) {
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const [status, setStatus] = useState<Status>("loading");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [states, setStates] = useState<Map<string, CardState>>(new Map());
  const [queue, setQueue] = useState<string[]>([]);
  const [counts, setCounts] = useState({ due: 0, fresh: 0 });
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"prompt" | "revealed">("prompt");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratch, setScratch] = useState("");
  // Drawn again each time a card is shown. `serial` remounts the panel for a new draw.
  const [drawn, setDrawn] = useState<{ serial: number; exercise: Exercise } | null>(null);
  const [tally, setTally] = useState<Record<Rating, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [nextDueLabel, setNextDueLabel] = useState<string | null>(null);
  const [timing, setTiming] = useState({ startedAt: 0, finishedAt: 0 });
  const scratchRef = useRef<HTMLTextAreaElement>(null);
  const drawSerial = useRef(0);
  const router = useRouter();
  const onQueueRef = useRef(onQueue);
  const indexRef = useRef(0);
  const pendingUrl = useRef<string | null>(null);
  const finishedOn = useRef<string | null>(null);
  const request = useRef(0);
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    onQueueRef.current = onQueue;
    activeIdRef.current = activeId;
  });

  const drawExercise = useCallback(
    (id: string | undefined) => {
      const card = id ? cardById.get(id) : undefined;
      setDrawn(card ? { serial: ++drawSerial.current, exercise: buildExercise(card, bank) } : null);
    },
    [bank, cardById],
  );

  const load = useCallback(
    (opts: { ignoreLimit?: boolean } = {}) => {
      const token = ++request.current;
      const currentId = activeIdRef.current;
      const runner =
        currentId && cardIds.length === 1 && !opts.ignoreLimit
          ? loadFixed(cardIds)
          : loadSession(cardIds, opts);
      return runner.then((loaded) => {
        if (token !== request.current) return;
        const startedAt = Date.now();
        const startIndex =
          currentId && !opts.ignoreLimit ? Math.max(0, loaded.queue.indexOf(currentId)) : 0;
        indexRef.current = startIndex;
        setSettings(loaded.settings);
        setStates(loaded.states);
        setQueue(loaded.queue);
        setCounts(loaded.counts);
        setIndex(startIndex);
        setPhase("prompt");
        setChecked(new Set());
        setScratch("");
        setScratchOpen(false);
        drawExercise(loaded.queue[startIndex]);
        setTally({ again: 0, hard: 0, good: 0, easy: 0 });
        setTiming({ startedAt, finishedAt: 0 });
        setNextDueLabel(loaded.nextDueLabel);
        onQueueRef.current?.(loaded.queue);
        const first = loaded.queue[0];
        if (opts.ignoreLimit && currentId && first && first !== currentId) {
          pendingUrl.current = first;
          router.push(studyCardPath(first));
        }
        setStatus(loaded.queue.length === 0 ? "empty" : "ready");
      });
    },
    [cardIds, drawExercise, router],
  );

  useEffect(() => {
    void load();
    return () => {
      request.current += 1;
    };
  }, [load]);

  // The URL is the source of truth. Back and Forward change `activeId`.
  useEffect(() => {
    if (!activeId) return;
    if (pendingUrl.current && pendingUrl.current !== activeId) return;
    pendingUrl.current = null;
    if (status !== "ready" && status !== "done") return;
    const nextIndex = queue.indexOf(activeId);
    if (nextIndex < 0) return;
    if (status === "done" && finishedOn.current === activeId) return;
    if (nextIndex === indexRef.current && status === "ready") return;
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    setPhase("prompt");
    setChecked(new Set());
    setScratch("");
    setScratchOpen(false);
    drawExercise(activeId);
    setStatus("ready");
  }, [activeId, drawExercise, queue, status]);

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

  // Where Skip goes. A queue session steps through its own queue. A card opened
  // by its own URL is a one-card session, so Skip walks the deck in content
  // order instead; the new URL mounts a fresh one-card session for that card.
  const neighbors = useMemo(() => {
    if (!currentId || !current) return { prev: undefined, next: undefined };
    if (scope !== "card") return { prev: queue[index - 1], next: queue[index + 1] };
    const siblings = cardsForDeck(bank, current.deck).map((card) => card.id);
    const at = siblings.indexOf(currentId);
    return { prev: siblings[at - 1], next: siblings[at + 1] };
  }, [bank, current, currentId, index, queue, scope]);

  // Move without rating. Nothing is saved, so the card stays due.
  const skipTo = useCallback(
    (id: string | undefined) => {
      if (!id || pendingUrl.current) return;
      pendingUrl.current = id;
      router.push(studyCardPath(id));
    },
    [router],
  );

  const applyRating = useCallback(
    async (rating: Rating) => {
      if (!current || !currentState || pendingUrl.current) return;
      const result = rate(currentState, rating);
      await saveReview(result.state, result.review);
      void pushReview(result.state, result.review).catch(() => undefined);
      setStates((prev) => new Map(prev).set(current.id, result.state));
      const nextTally = { ...tally, [rating]: tally[rating] + 1 };
      setTally(nextTally);
      const nextId = queue[index + 1];
      if (!nextId) {
        finishedOn.current = current.id;
        setTiming((t) => ({ ...t, finishedAt: Date.now() }));
        setStatus("done");
        return;
      }
      pendingUrl.current = nextId;
      router.push(studyCardPath(nextId));
    },
    [current, currentState, index, queue, router, tally],
  );

  function studyMore() {
    if (scope === "card") {
      router.push("/study");
      return;
    }
    void load({ ignoreLimit: true });
  }

  const reveal = useCallback(() => setPhase("revealed"), []);
  const creditPoints = useCallback((points: number[]) => setChecked(new Set(points)), []);
  const exercise = settings.mode === "rubric" ? drawn : null;

  async function setMode(mode: StudyMode) {
    setSettings((s) => ({ ...s, mode }));
    await savePreference("mode", mode);
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (status !== "ready" || !activeId) return;
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

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        skipTo(e.key === "ArrowLeft" ? neighbors.prev : neighbors.next);
        return;
      }

      if (phase === "prompt") {
        // Inside the exercise, Space and Enter belong to its own buttons and tick boxes.
        if (target?.closest("[data-exercise]")) return;
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
  }, [
    status,
    activeId,
    phase,
    settings.mode,
    current,
    suggested,
    applyRating,
    reveal,
    skipTo,
    neighbors,
  ]);

  // ---- Render states ----

  if (status === "loading") {
    return (
      <SessionFrame title={title} wide>
        <div className="index-card h-[360px] animate-pulse" />
      </SessionFrame>
    );
  }

  if (status === "empty") {
    return (
      <SessionFrame title={title}>
        <div className="index-card px-8 py-10 text-center">
          <h2 className="font-display text-2xl font-bold text-ink">
            {nextDueLabel ? "Nothing due right now" : "Daily new-card limit reached"}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-2">
            {nextDueLabel
              ? `Your next card in this set is due in ${nextDueLabel}. Come back then, or pull in a few new cards now.`
              : `You have introduced ${settings.newLimit} new cards today. You can raise the limit in Settings or keep going anyway.`}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button onClick={() => void studyMore()}>Study 10 more now</Button>
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
        <div className="index-card px-8 py-10">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink">
            {total} {total === 1 ? "card" : "cards"} in about {mins}{" "}
            {mins === 1 ? "minute" : "minutes"}
          </h2>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RATINGS.map((r) => (
              <div
                key={r}
                className={cn("rounded-xl border border-rule bg-paper-2 px-4 py-3", RATING_TONE[r])}
              >
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
            <Button onClick={() => void studyMore()}>
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

  if (status === "ready" && !activeId) {
    return (
      <SessionFrame title={title} wide>
        <div className="index-card h-[360px] animate-pulse" />
      </SessionFrame>
    );
  }

  if (!current || !currentState) return null;

  const isNew = currentState.state === "new";

  return (
    <SessionFrame
      title={title}
      wide
      right={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <SkipButton
              label="Previous card"
              hint="←"
              onClick={() => skipTo(neighbors.prev)}
              disabled={!neighbors.prev}
            >
              <ChevronLeft className="h-4 w-4" />
            </SkipButton>
            <span className="font-mono text-xs text-ink-3">
              {index + 1}/{queue.length}
              <span className="hidden sm:inline">
                {" "}
                · {counts.due} due · {counts.fresh} new
              </span>
            </span>
            <SkipButton
              label="Next card"
              hint="→"
              onClick={() => skipTo(neighbors.next)}
              disabled={!neighbors.next}
            >
              <ChevronRight className="h-4 w-4" />
            </SkipButton>
          </div>
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
      <div className="mb-4 h-0.5 w-full overflow-hidden rounded-full bg-rule/70">
        <div
          className="h-full bg-red transition-[width] duration-300"
          style={{ width: `${(index / queue.length) * 100}%` }}
        />
      </div>

      <article className="index-card overflow-hidden">
        <div className="px-6 pt-6 pb-7 sm:px-10 sm:pt-8 sm:pb-9">
          <header className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-3 uppercase">
            <span className="text-red-ink">{current.deck}</span>
            <span aria-hidden>·</span>
            <span>{current.type}</span>
            <span aria-hidden>·</span>
            <span className={cn(isNew && "text-blue")}>{isNew ? "new" : "review"}</span>
            {exercise && (
              <>
                <span aria-hidden>·</span>
                <span title="How this card is testing you">
                  {EXERCISE_LABEL[exercise.exercise.kind]}
                </span>
              </>
            )}
            <span className="ml-auto hidden font-mono font-normal normal-case sm:inline">
              #{current.id}
            </span>
          </header>

          {/* On a wide viewport the question stays beside the work instead of above it. */}
          <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10">
            <h2 className="card-prompt mt-5 max-w-2xl text-balance lg:sticky lg:top-20">
              {current.prompt.trim()}
            </h2>

            {phase === "prompt" && (
              <div className="mt-7 lg:mt-5" data-exercise={exercise ? "" : undefined}>
                {exercise ? (
                  <ExercisePanel
                    key={exercise.serial}
                    exercise={exercise.exercise}
                    card={current}
                    onCovered={creditPoints}
                    onDone={reveal}
                  />
                ) : scratchOpen ? (
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
              </div>
            )}

            {phase === "revealed" && (
              <div className="mt-7 lg:mt-5">
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
                          <span className={cn("leading-snug", on && "text-ink-2")}>
                            {kp}
                            {current.eli5?.[i] && (
                              <span className="mt-1 block text-sm text-ink-2">
                                <span className="sr-only">In plain words: </span>
                                {current.eli5[i]}
                              </span>
                            )}
                          </span>
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
                          "h-auto flex-col gap-0.5 rounded-xl py-2.5",
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
          </div>
        </div>

        {phase === "prompt" && (
          <footer className="flex flex-wrap items-center gap-4 border-t border-rule/60 bg-paper-2/70 px-6 py-4 sm:px-10">
            <Button size="lg" onClick={reveal}>
              Reveal key points
            </Button>
            <span className="text-sm text-ink-3">
              {exercise ? "to skip the exercise, " : ""}or press <Kbd>space</Kbd>
            </span>
          </footer>
        )}
      </article>
    </SessionFrame>
  );
}

function SkipButton({
  label,
  hint,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; hint: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} (${hint})`}
      className="rounded-full p-1 text-ink-2 hover:bg-paper-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
      {...props}
    >
      {children}
    </button>
  );
}

function SessionFrame({
  title,
  right,
  wide = false,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  /** Match the site header's width on large viewports. The study card lays out in two columns there. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10", wide && "lg:max-w-6xl")}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">{title}</h1>
        {right}
      </div>
      {children}
    </div>
  );
}
