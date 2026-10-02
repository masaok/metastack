import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileDirectory, compileSource } from "../src/compile";

const here = dirname(fileURLToPath(import.meta.url));
const realCards = join(here, "..", "cards");

function card(
  overrides: Record<string, string> = {},
  body = "A long enough model answer body for the test.",
) {
  const fm = {
    id: "sample-card",
    deck: "fundamentals",
    type: "concept",
    difficulty: "1",
    tags: "[caching]",
    prompt: "What is a cache and why would you add one?",
    keyPoints: "[Faster reads, Less load on origin, Staleness risk]",
    references: "[{ title: MDN, url: https://developer.mozilla.org/ }]",
    updated: "2026-10-02",
    reviewed: "true",
    ...overrides,
  };
  const yaml = Object.entries(fm)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return `---\n${yaml}\n---\n${body}\n`;
}

describe("compileSource", () => {
  it("compiles a valid card and normalises the date", () => {
    const { cards, issues } = compileSource([
      { path: "/x/cards/fundamentals/sample-card.md", source: card() },
      {
        path: "/x/cards/estimation/est.md",
        source: card({ id: "est", deck: "estimation", type: "estimation", tags: "[estimation]" }),
      },
      {
        path: "/x/cards/designs/des.md",
        source: card({
          id: "des",
          deck: "designs",
          type: "design",
          stages:
            "[{ name: Requirements, keyPoints: [a] }, { name: API, keyPoints: [b] }, { name: Data, keyPoints: [c] }]",
        }),
      },
    ]);
    expect(issues).toEqual([]);
    expect(cards).toHaveLength(3);
    expect(cards[0]?.updated).toBe("2026-10-02");
    expect(cards[0]?.body).toContain("model answer");
  });

  it("fails on duplicate ids", () => {
    const { issues } = compileSource([
      { path: "/x/cards/fundamentals/sample-card.md", source: card() },
      { path: "/x/cards/fundamentals/sample-card.md", source: card() },
    ]);
    expect(issues.some((i) => i.message.includes("duplicate id"))).toBe(true);
  });

  it("fails when id or deck do not match the path", () => {
    const { issues } = compileSource([
      { path: "/x/cards/estimation/other-name.md", source: card() },
    ]);
    expect(issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('must match the file name "other-name"'),
        expect.stringContaining('must match the folder "estimation"'),
      ]),
    );
  });

  it("fails on missing key points and reports the schema path", () => {
    const { issues, cards } = compileSource([
      { path: "/x/cards/fundamentals/sample-card.md", source: card({ keyPoints: "[only one]" }) },
    ]);
    expect(cards).toHaveLength(0);
    expect(issues[0]?.message).toMatch(/^keyPoints:/);
  });

  it("fails on a too-short body and on broken front matter", () => {
    const short = compileSource([
      { path: "/x/cards/fundamentals/sample-card.md", source: card({}, "tiny") },
    ]);
    expect(short.issues.some((i) => i.message.includes("too short"))).toBe(true);

    const broken = compileSource([
      { path: "/x/cards/fundamentals/sample-card.md", source: "---\nid: [unclosed\n---\nbody" },
    ]);
    expect(broken.issues[0]?.message).toMatch(/invalid front matter/);

    const notAnObject = compileSource([
      { path: "/x/cards/fundamentals/sample-card.md", source: "---\n- just\n- a list\n---\nbody" },
    ]);
    expect(notAnObject.issues[0]?.message).toMatch(/^\(root\):/);
  });

  it("flags empty decks and makes paths relative to the root", () => {
    const { issues } = compileSource(
      [{ path: "/x/cards/fundamentals/sample-card.md", source: card() }],
      "/x",
    );
    expect(issues.map((i) => i.file)).toEqual(
      expect.arrayContaining(["cards/estimation", "cards/designs"]),
    );
    expect(compileSource([]).issues).toEqual([]);
  });
});

describe("the real question bank", () => {
  it("compiles with zero issues", () => {
    const { cards, issues } = compileDirectory(realCards);
    expect(issues).toEqual([]);
    expect(cards.length).toBeGreaterThanOrEqual(60);
  });

  it("meets the launch counts per deck", () => {
    const { cards } = compileDirectory(realCards);
    const count = (deck: string) => cards.filter((c) => c.deck === deck).length;
    expect(count("fundamentals")).toBeGreaterThanOrEqual(35);
    expect(count("estimation")).toBeGreaterThanOrEqual(10);
    expect(count("designs")).toBeGreaterThanOrEqual(15);
  });
});
