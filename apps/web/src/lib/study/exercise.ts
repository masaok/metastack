/**
 * The active step between a card's prompt and its key points. Each time a card
 * is shown one exercise is drawn at random from the kinds that card supports.
 * Every kind is derived from what a card already carries, so no card needs
 * extra content. Pure functions: the random source is passed in.
 */
import type { Card } from "@metastack/content";

export const EXERCISE_KINDS = ["slots", "cues", "match", "pick"] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

/** The word shown on the card for each kind. */
export const EXERCISE_LABEL: Record<ExerciseKind, string> = {
  slots: "recall",
  cues: "hints",
  match: "match",
  pick: "pick",
};

export interface PickOption {
  text: string;
  /** Index of the key point this is, or null for a wrong answer. */
  point: number | null;
}

export type Exercise =
  /** Recall each key point from nothing, one at a time. */
  | { kind: "slots" }
  /** The same, with the plain-language line as a hint for each point. */
  | { kind: "cues"; cues: readonly string[] }
  /** Match each plain-language line to its key point. `order` is the asking order. */
  | { kind: "match"; lines: readonly string[]; order: readonly number[] }
  /**
   * Pick this card's key points out of a list that mixes in wrong answers.
   * `authored` says the wrong answers are the card's own distractors, not borrowed points.
   */
  | { kind: "pick"; options: readonly PickOption[]; authored: boolean };

type Random = () => number;

/** Wrong answers mixed into a pick exercise. */
export const DISTRACTOR_COUNT = 3;

function shuffled<T>(xs: readonly T[], random: Random): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** One plain-language line per key point, or null when the card lacks them. */
function plainLines(card: Card): readonly string[] | null {
  return card.eli5 && card.eli5.length === card.keyPoints.length ? card.eli5 : null;
}

/** Key points of other cards that share a tag: plausible, but not this card's answer. */
function distractorPool(card: Card, bank: readonly Card[]): string[] {
  const own = new Set(card.keyPoints);
  const related = bank.filter(
    (other) => other.id !== card.id && other.tags.some((tag) => card.tags.includes(tag)),
  );
  return [...new Set(related.flatMap((other) => other.keyPoints))].filter(
    (point) => !own.has(point),
  );
}

/**
 * The wrong answers a pick can draw from: the card's own distractors, or for a
 * card without them, points borrowed from related cards. Null when neither is enough.
 */
function wrongAnswers(
  card: Card,
  bank: readonly Card[],
): { texts: readonly string[]; authored: boolean } | null {
  if (card.distractors) return { texts: card.distractors, authored: true };
  const borrowed = distractorPool(card, bank);
  return borrowed.length >= DISTRACTOR_COUNT ? { texts: borrowed, authored: false } : null;
}

export function eligibleKinds(card: Card, bank: readonly Card[]): ExerciseKind[] {
  const lines = plainLines(card);
  const kinds: ExerciseKind[] = ["slots"];
  if (lines) kinds.push("cues");
  if (lines && new Set(lines).size === lines.length) kinds.push("match");
  if (wrongAnswers(card, bank)) kinds.push("pick");
  return kinds;
}

export function buildExercise(
  card: Card,
  bank: readonly Card[],
  random: Random = Math.random,
): Exercise {
  const kinds = eligibleKinds(card, bank);
  const kind = kinds[Math.min(kinds.length - 1, Math.floor(random() * kinds.length))]!;
  const lines = plainLines(card) ?? [];
  switch (kind) {
    case "slots":
      return { kind };
    case "cues":
      return { kind, cues: lines };
    case "match":
      return {
        kind,
        lines,
        order: shuffled(
          card.keyPoints.map((_, i) => i),
          random,
        ),
      };
    case "pick": {
      const wrong = wrongAnswers(card, bank)!;
      const distractors = shuffled(wrong.texts, random).slice(0, DISTRACTOR_COUNT);
      const options: PickOption[] = [
        ...card.keyPoints.map((text, point) => ({ text, point })),
        ...distractors.map((text) => ({ text, point: null })),
      ];
      return { kind, options: shuffled(options, random), authored: wrong.authored };
    }
  }
}

/**
 * Key points credited for a pick. Each wrong answer that was selected cancels
 * one correct pick, so selecting everything scores no better than selecting nothing.
 */
export function scorePick(options: readonly PickOption[], selected: ReadonlySet<number>): number[] {
  const hits: number[] = [];
  let wrong = 0;
  options.forEach((option, i) => {
    if (!selected.has(i)) return;
    if (option.point === null) wrong += 1;
    else hits.push(option.point);
  });
  hits.sort((a, b) => a - b);
  return hits.slice(0, Math.max(0, hits.length - wrong));
}
