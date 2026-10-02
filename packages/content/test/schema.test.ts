import { describe, expect, it } from "vitest";

import { DECKS, getDeck, isDeckSlug } from "../src/decks";
import { frontMatterSchema, type FrontMatterInput } from "../src/schema";

const valid: FrontMatterInput = {
  id: "caching-write-strategies",
  deck: "fundamentals",
  type: "tradeoff",
  difficulty: 2,
  tags: ["caching", "consistency"],
  prompt: "Compare write-through, write-back and write-around caching.",
  keyPoints: ["Write-through is consistent", "Write-back is fast", "Write-around avoids pollution"],
  references: [{ title: "MDN HTTP caching", url: "https://developer.mozilla.org/" }],
  updated: "2026-10-02",
};

describe("frontMatterSchema", () => {
  it("accepts a valid card and applies defaults", () => {
    const card = frontMatterSchema.parse(valid);
    expect(card.followUps).toEqual([]);
    expect(card.reviewed).toBe(false);
    expect(card.updated).toBeInstanceOf(Date);
  });

  it("rejects ids that are not kebab-case", () => {
    expect(frontMatterSchema.safeParse({ ...valid, id: "Caching_Write" }).success).toBe(false);
  });

  it("requires 3–6 key points", () => {
    expect(frontMatterSchema.safeParse({ ...valid, keyPoints: ["a", "b"] }).success).toBe(false);
    expect(
      frontMatterSchema.safeParse({ ...valid, keyPoints: ["a", "b", "c", "d", "e", "f", "g"] })
        .success,
    ).toBe(false);
  });

  it("requires at least one reference with a real URL", () => {
    expect(frontMatterSchema.safeParse({ ...valid, references: [] }).success).toBe(false);
    expect(
      frontMatterSchema.safeParse({ ...valid, references: [{ title: "x", url: "nope" }] }).success,
    ).toBe(false);
  });

  it("rejects unknown tags and unknown decks", () => {
    expect(frontMatterSchema.safeParse({ ...valid, tags: ["blockchain"] }).success).toBe(false);
    expect(frontMatterSchema.safeParse({ ...valid, deck: "secret" }).success).toBe(false);
  });

  it("requires stages on design cards and forbids them elsewhere", () => {
    const noStages = frontMatterSchema.safeParse({ ...valid, type: "design", deck: "designs" });
    expect(noStages.success).toBe(false);
    const withStages = frontMatterSchema.safeParse({
      ...valid,
      type: "design",
      deck: "designs",
      stages: [
        { name: "Requirements", keyPoints: ["a"] },
        { name: "Estimates", keyPoints: ["b"] },
        { name: "API", keyPoints: ["c"] },
      ],
    });
    expect(withStages.success).toBe(true);
    const conceptWithStages = frontMatterSchema.safeParse({
      ...valid,
      stages: [
        { name: "a", keyPoints: ["a"] },
        { name: "b", keyPoints: ["b"] },
        { name: "c", keyPoints: ["c"] },
      ],
    });
    expect(conceptWithStages.success).toBe(false);
  });

  it("requires estimation cards to carry the estimation tag", () => {
    const bad = frontMatterSchema.safeParse({ ...valid, type: "estimation", deck: "estimation" });
    expect(bad.success).toBe(false);
    const good = frontMatterSchema.safeParse({
      ...valid,
      type: "estimation",
      deck: "estimation",
      tags: ["estimation"],
    });
    expect(good.success).toBe(true);
  });
});

describe("decks", () => {
  it("exposes the three launch decks", () => {
    expect(DECKS.map((d) => d.slug)).toEqual(["fundamentals", "estimation", "designs"]);
    expect(getDeck("estimation")?.title).toBe("Estimation");
    expect(getDeck("nope")).toBeUndefined();
    expect(isDeckSlug("designs")).toBe(true);
    expect(isDeckSlug("x")).toBe(false);
  });
});
