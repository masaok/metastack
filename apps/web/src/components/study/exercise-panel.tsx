"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

import type { Card } from "@metastack/content";

import { Button } from "@/components/ui/button";
import { scorePick, type Exercise, type PickOption } from "@/lib/study/exercise";
import { cn } from "@/lib/utils";

interface PanelProps {
  card: Card;
  /** Key points credited so far, as indices. Called whenever the credit changes. */
  onCovered: (points: number[]) => void;
  /** The exercise is finished; show the key points. */
  onDone: () => void;
}

/** The active step shown under a card's prompt, before its key points. */
export function ExercisePanel({ exercise, ...props }: PanelProps & { exercise: Exercise }) {
  switch (exercise.kind) {
    case "slots":
      return <RecallExercise {...props} />;
    case "cues":
      return <RecallExercise {...props} cues={exercise.cues} />;
    case "match":
      return <MatchExercise {...props} lines={exercise.lines} order={exercise.order} />;
    case "pick":
      return <PickExercise {...props} options={exercise.options} authored={exercise.authored} />;
  }
}

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <Check aria-label="Got it" className="mt-0.5 h-4 w-4 shrink-0 text-green" />
  ) : (
    <X aria-label="Missed" className="mt-0.5 h-4 w-4 shrink-0 text-red-ink" />
  );
}

/** Recall the key points one at a time, with or without a plain-language cue. */
function RecallExercise({
  card,
  cues,
  onCovered,
  onDone,
}: PanelProps & { cues?: readonly string[] }) {
  const [results, setResults] = useState<boolean[]>([]);
  const [shown, setShown] = useState(false);
  const [typed, setTyped] = useState("");
  const total = card.keyPoints.length;
  const active = results.length;

  function mark(got: boolean) {
    const next = [...results, got];
    onCovered(next.flatMap((ok, i) => (ok ? [i] : [])));
    if (next.length === total) {
      onDone();
      return;
    }
    setResults(next);
    setShown(false);
    setTyped("");
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-ink-2">
        {cues
          ? "Turn each plain-language hint into the key point"
          : `Recall the ${total} key points, one at a time`}
      </h3>
      <ol className="mt-3 space-y-2">
        {card.keyPoints.map((point, i) => (
          <li
            key={point}
            className={cn(
              "rounded-xl border border-rule px-4 py-3",
              i === active ? "bg-paper-2" : "bg-paper",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="font-mono text-sm text-ink-3">{i + 1}</span>
              <div className="min-w-0 flex-1">
                {cues && (
                  <p className={cn("text-sm leading-snug", i > active && "text-ink-3")}>
                    <span className="sr-only">Hint: </span>
                    {cues[i]}
                  </p>
                )}
                {!cues && i > active && <p className="text-sm text-ink-3">Point {i + 1}</p>}

                {i < active && (
                  <p className={cn("flex items-start gap-2 leading-snug", cues && "mt-2")}>
                    <Mark ok={results[i]!} />
                    <span className="text-ink-2">{point}</span>
                  </p>
                )}

                {i === active && !shown && (
                  <form
                    className={cn("flex flex-wrap items-center gap-2", cues && "mt-2")}
                    onSubmit={(e) => {
                      e.preventDefault();
                      setShown(true);
                    }}
                  >
                    <input
                      type="text"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      aria-label={`Your answer for point ${i + 1}`}
                      placeholder="A few words, or just think it"
                      className="h-10 min-w-0 basis-full rounded-lg border border-rule bg-paper px-3 text-sm text-ink placeholder:text-ink-3 sm:flex-1 sm:basis-0"
                    />
                    <Button type="submit" variant="secondary" autoFocus={i > 0}>
                      Show point
                    </Button>
                  </form>
                )}

                {i === active && shown && (
                  <div className={cn(cues && "mt-2")}>
                    {typed.trim() && (
                      <p className="mb-1 text-sm text-ink-3">You wrote: {typed.trim()}</p>
                    )}
                    <p className="leading-snug text-ink">{point}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" autoFocus onClick={() => mark(true)}>
                        <Check className="h-4 w-4 text-green" /> Got it
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => mark(false)}>
                        <X className="h-4 w-4 text-red-ink" /> Missed it
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Match each plain-language line to the key point it restates. */
function MatchExercise({
  card,
  lines,
  order,
  onCovered,
  onDone,
}: PanelProps & { lines: readonly string[]; order: readonly number[] }) {
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [covered, setCovered] = useState<number[]>([]);
  const answer = order[step]!;
  const last = step + 1 === order.length;

  function choose(i: number) {
    setChoice(i);
    if (i !== answer) return;
    const next = [...covered, answer].sort((a, b) => a - b);
    setCovered(next);
    onCovered(next);
  }

  function advance() {
    if (last) {
      onDone();
      return;
    }
    setStep(step + 1);
    setChoice(null);
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-ink-2">
        Which key point is this, in plain words?{" "}
        <span className="font-normal whitespace-nowrap text-ink-3">
          Line {step + 1} of {order.length}
        </span>
      </h3>
      <blockquote className="mt-3 rounded-xl border border-rule bg-paper-2 px-4 py-3 leading-snug text-ink">
        {lines[answer]}
      </blockquote>
      <ul className="mt-3 space-y-2">
        {card.keyPoints.map((point, i) => {
          const right = choice !== null && i === answer;
          const wrong = choice === i && i !== answer;
          return (
            <li key={point}>
              <button
                type="button"
                disabled={choice !== null}
                onClick={() => choose(i)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl border border-rule bg-paper px-4 py-2.5 text-left leading-snug text-ink",
                  choice === null && "hover:border-rule-strong hover:bg-paper-2",
                  right && "border-green",
                  wrong && "border-red-ink",
                  choice !== null && !right && !wrong && "text-ink-3",
                )}
              >
                {right && <Mark ok />}
                {wrong && <Mark ok={false} />}
                <span>{point}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {choice !== null && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" autoFocus onClick={advance}>
            {last ? "See key points" : "Next line"}
          </Button>
          <span className="text-sm text-ink-2" role="status">
            {choice === answer ? "Matched." : "Not that one. The match is marked."}
          </span>
        </div>
      )}
    </div>
  );
}

/** Pick this card's key points out of a list that mixes in wrong answers. */
function PickExercise({
  options,
  authored,
  onCovered,
  onDone,
}: PanelProps & { options: readonly PickOption[]; authored: boolean }) {
  const wrongLabel = authored ? "A common mistake" : "From another card";
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [marked, setMarked] = useState(false);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function check() {
    setMarked(true);
    onCovered(scorePick(options, selected));
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-ink-2">
        Tick the points that belong in an answer to this question
      </h3>
      <ul className="mt-3 space-y-2">
        {options.map((option, i) => {
          const on = selected.has(i);
          const belongs = option.point !== null;
          return (
            <li key={option.text}>
              <label
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-rule bg-paper px-4 py-2.5",
                  !marked && "cursor-pointer hover:bg-paper-2",
                  marked && belongs && "border-green",
                  marked && !belongs && on && "border-red-ink",
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={marked}
                  onChange={() => toggle(i)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--red)]"
                />
                <span className={cn("leading-snug", marked && !belongs && "text-ink-3")}>
                  {option.text}
                  {marked && (
                    <span
                      className={cn(
                        "mt-1 block text-sm",
                        belongs && on && "text-green",
                        belongs && !on && "text-ink-2",
                        !belongs && on && "text-red-ink",
                      )}
                    >
                      {belongs
                        ? on
                          ? "Key point, picked"
                          : "Key point, missed"
                        : on
                          ? wrongLabel
                          : `${wrongLabel}, left out`}
                    </span>
                  )}
                  {marked && option.why && (
                    <span className="mt-1 block text-sm text-ink-2">{option.why}</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        {marked ? (
          <Button variant="secondary" autoFocus onClick={onDone}>
            See key points
          </Button>
        ) : (
          <Button variant="secondary" onClick={check}>
            Check answers
          </Button>
        )}
      </div>
    </div>
  );
}
