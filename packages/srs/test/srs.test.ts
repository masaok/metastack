import { describe, expect, it } from "vitest";
import {
  buildSession,
  countDeck,
  createCardState,
  dayKey,
  formatInterval,
  getDueCards,
  isDue,
  previewDue,
  rate,
  ratingFromRubric,
  retrievability,
  RATINGS,
  type CardState,
} from "../src/index";

const T0 = new Date("2026-10-02T09:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("createCardState", () => {
  it("creates a new card that is due immediately", () => {
    const s = createCardState("a", T0);
    expect(s.cardId).toBe("a");
    expect(s.state).toBe("new");
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(0);
    expect(s.lastReview).toBeUndefined();
    expect(isDue(s, T0)).toBe(true);
  });

  it("accepts number and string clocks and defaults to now", () => {
    expect(createCardState("a", T0.getTime()).due).toBe(T0.toISOString());
    expect(createCardState("a", T0.toISOString()).due).toBe(T0.toISOString());
    const before = Date.now();
    const s = createCardState("a");
    expect(new Date(s.due).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});

describe("rate", () => {
  it("does not mutate the input and records the previous state", () => {
    const s = createCardState("a", T0);
    const copy = structuredClone(s);
    const { state, review } = rate(s, "good", T0);
    expect(s).toEqual(copy);
    expect(state.cardId).toBe("a");
    expect(state.reps).toBe(1);
    expect(state.lastReview).toBe(T0.toISOString());
    expect(review).toMatchObject({ cardId: "a", rating: "good", previousState: "new" });
    expect(review.reviewedAt).toBe(T0.toISOString());
  });

  it("schedules easy further out than good, good further than hard, hard further than again", () => {
    const s = createCardState("a", T0);
    const due = (r: (typeof RATINGS)[number]) => new Date(rate(s, r, T0).state.due).getTime();
    expect(due("again")).toBeLessThan(due("hard"));
    expect(due("hard")).toBeLessThan(due("good"));
    expect(due("good")).toBeLessThan(due("easy"));
  });

  it("moves through learning into review and counts lapses on again", () => {
    let s = createCardState("a", T0);
    s = rate(s, "easy", T0).state;
    expect(s.state).toBe("review");
    const later = new Date(new Date(s.due).getTime() + DAY);
    const relearn = rate(s, "again", later).state;
    expect(relearn.lapses).toBe(1);
    expect(relearn.state).toBe("relearning");
    expect(relearn.scheduledDays).toBeLessThanOrEqual(1);
  });

  it("defaults the clock to now", () => {
    const s = createCardState("a", T0);
    const { review } = rate(s, "good");
    expect(Date.now() - new Date(review.reviewedAt).getTime()).toBeLessThan(5000);
  });
});

describe("previewDue", () => {
  it("returns one due date per rating in increasing order", () => {
    const s = createCardState("a", T0);
    const p = previewDue(s, T0);
    const ts = RATINGS.map((r) => new Date(p[r]).getTime());
    expect(ts[0]).toBeLessThan(ts[1]!);
    expect(ts[1]).toBeLessThan(ts[2]!);
    expect(ts[2]).toBeLessThan(ts[3]!);
    expect(previewDue(s).good).toBeTypeOf("string");
  });

  it("matches what rate() would produce", () => {
    const s = rate(createCardState("a", T0), "good", T0).state;
    const at = new Date(new Date(s.due).getTime() + DAY);
    const p = previewDue(s, at);
    for (const r of RATINGS) expect(p[r]).toBe(rate(s, r, at).state.due);
  });
});

describe("isDue / getDueCards", () => {
  it("excludes new cards and sorts most overdue first", () => {
    const a = rate(createCardState("a", T0), "good", T0).state;
    const b = rate(createCardState("b", T0), "easy", T0).state;
    const fresh = createCardState("c", T0);
    const farFuture = new Date(T0.getTime() + 400 * DAY);
    const due = getDueCards([b, fresh, a], farFuture);
    expect(due.map((s) => s.cardId)).toEqual(["a", "b"]);
    expect(getDueCards([a, b], T0)).toEqual([]);
    expect(isDue(a)).toBeTypeOf("boolean");
    expect(getDueCards([])).toEqual([]);
  });
});

describe("ratingFromRubric", () => {
  it("maps coverage to the plan's thresholds", () => {
    expect(ratingFromRubric(0, 5)).toBe("again");
    expect(ratingFromRubric(1, 5)).toBe("again"); // 20%
    expect(ratingFromRubric(2, 5)).toBe("hard"); // 40%
    expect(ratingFromRubric(3, 5)).toBe("hard"); // 60%
    expect(ratingFromRubric(7, 10)).toBe("good"); // 70%
    expect(ratingFromRubric(9, 10)).toBe("good"); // 90%
    expect(ratingFromRubric(19, 20)).toBe("easy"); // 95%
    expect(ratingFromRubric(5, 5)).toBe("easy");
  });

  it("is defensive about bad input", () => {
    expect(ratingFromRubric(3, 0)).toBe("good");
    expect(ratingFromRubric(-1, 5)).toBe("again");
    expect(ratingFromRubric(9, 5)).toBe("easy");
  });
});

describe("retrievability", () => {
  it("is 1 for new cards and decays over time for reviewed cards", () => {
    const fresh = createCardState("a", T0);
    expect(retrievability(fresh, T0)).toBe(1);
    const s = rate(fresh, "good", T0).state;
    const soon = retrievability(s, new Date(T0.getTime() + DAY));
    const later = retrievability(s, new Date(T0.getTime() + 60 * DAY));
    expect(soon).toBeGreaterThan(later);
    expect(later).toBeGreaterThan(0);
    expect(retrievability(s)).toBeLessThanOrEqual(1);
  });
});

describe("buildSession", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("puts due reviews first, then new cards up to the limit", () => {
    const a = rate(createCardState("a", T0), "good", T0).state;
    const b = rate(createCardState("b", T0), "good", T0).state;
    const later = new Date(T0.getTime() + 30 * DAY);
    const session = buildSession({ cardIds: ids, states: [a, b], now: later, newLimit: 2 });
    expect(session.queue.slice(0, 2).sort()).toEqual(["a", "b"]);
    expect(session.queue.slice(2)).toEqual(["c", "d"]);
    expect(session.dueCount).toBe(2);
    expect(session.newCount).toBe(2);
  });

  it("respects cards already introduced today and never goes negative", () => {
    const s1 = buildSession({ cardIds: ids, states: [], newLimit: 3, newIntroducedToday: 2 });
    expect(s1.queue).toEqual(["a"]);
    const s2 = buildSession({ cardIds: ids, states: [], newLimit: 3, newIntroducedToday: 9 });
    expect(s2.queue).toEqual([]);
  });

  it("ignores states for cards outside the eligible set and treats stored 'new' states as new", () => {
    const other = rate(createCardState("zzz", T0), "good", T0).state;
    const storedNew: CardState = createCardState("a", T0);
    const session = buildSession({
      cardIds: ids,
      states: [other, storedNew],
      now: T0,
      newLimit: 10,
    });
    expect(session.queue).toEqual(ids);
    expect(session.dueCount).toBe(0);
  });

  it("applies a shuffle to new cards only and uses default limits", () => {
    const session = buildSession({
      cardIds: ids,
      states: [],
      shuffle: (xs) => [...xs].reverse(),
    });
    expect(session.queue).toEqual(["e", "d", "c", "b", "a"]);
    const twelve = Array.from({ length: 12 }, (_, i) => `c${i}`);
    expect(buildSession({ cardIds: twelve, states: [] }).queue).toHaveLength(10);
  });
});

describe("countDeck", () => {
  it("counts totals, due, new and learned", () => {
    const a = rate(createCardState("a", T0), "good", T0).state;
    const b = rate(createCardState("b", T0), "easy", T0).state;
    const later = new Date(T0.getTime() + 2 * DAY);
    const counts = countDeck(["a", "b", "c"], [a, b, createCardState("zzz", T0)], later);
    expect(counts.total).toBe(3);
    expect(counts.learned).toBe(2);
    expect(counts.new).toBe(1);
    expect(counts.due).toBeGreaterThanOrEqual(1);
    expect(countDeck([], []).total).toBe(0);
  });
});

describe("formatInterval", () => {
  it("formats minutes, hours, days, months and years", () => {
    const at = (ms: number) => new Date(T0.getTime() + ms);
    expect(formatInterval(T0, T0)).toBe("now");
    expect(formatInterval(T0, at(10 * 60_000))).toBe("10m");
    expect(formatInterval(T0, at(3 * 3_600_000))).toBe("3h");
    expect(formatInterval(T0, at(5 * DAY))).toBe("5d");
    expect(formatInterval(T0, at(45 * DAY))).toBe("2mo");
    expect(formatInterval(T0, at(400 * DAY))).toBe("1y");
    expect(formatInterval(T0.getTime(), T0.toISOString())).toBe("now");
  });
});

describe("dayKey", () => {
  it("formats a local calendar day and defaults to today", () => {
    const d = new Date(2026, 0, 5, 12);
    expect(dayKey(d)).toBe("2026-01-05");
    expect(dayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
