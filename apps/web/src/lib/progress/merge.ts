import type { CardState, ReviewRecord } from "@metastack/srs";

import type { ExportFile, Settings } from "@/lib/db";

function reviewKey(r: ReviewRecord): string {
  return `${r.cardId}|${r.reviewedAt}|${r.rating}`;
}

function newerState(a: CardState, b: CardState): CardState {
  const at = a.lastReview ?? "";
  const bt = b.lastReview ?? "";
  if (at === bt) return a.reps >= b.reps ? a : b;
  return at > bt ? a : b;
}

/** Last-write-wins per card. Reviews are unioned by (card, time, rating). */
export function mergeProgress(local: ExportFile, remote: ExportFile): ExportFile {
  const states = new Map<string, CardState>();
  for (const s of remote.cardStates) states.set(s.cardId, s);
  for (const s of local.cardStates) {
    const prev = states.get(s.cardId);
    states.set(s.cardId, prev ? newerState(s, prev) : s);
  }

  const reviews: ReviewRecord[] = [];
  const seen = new Set<string>();
  for (const r of [...remote.reviews, ...local.reviews]) {
    const k = reviewKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    reviews.push(r);
  }
  reviews.sort(
    (a, b) => a.reviewedAt.localeCompare(b.reviewedAt) || a.cardId.localeCompare(b.cardId),
  );

  // The account's preferences win, as they do on every page load.
  const settings: Partial<Settings> = { ...local.settings, ...remote.settings };

  return {
    app: "metastack",
    version: 1,
    exportedAt: new Date().toISOString(),
    cardStates: [...states.values()].sort((a, b) => a.cardId.localeCompare(b.cardId)),
    reviews,
    settings,
  };
}
