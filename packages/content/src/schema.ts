import { z } from "zod";

/** Decks that ship. Adding a deck means adding it here and in `decks.ts`. */
export const DECK_SLUGS = ["fundamentals", "estimation", "designs"] as const;
export type DeckSlug = (typeof DECK_SLUGS)[number];

export const CARD_TYPES = ["concept", "tradeoff", "estimation", "design", "failure"] as const;
export type CardType = (typeof CARD_TYPES)[number];

/**
 * The closed tag vocabulary. The validator fails the build on unknown tags so
 * the browser's tag filter stays meaningful.
 */
export const TAGS = [
  "api",
  "architecture",
  "availability",
  "caching",
  "cdn",
  "concurrency",
  "consistency",
  "data-structures",
  "databases",
  "durability",
  "estimation",
  "geo",
  "idempotency",
  "indexing",
  "latency",
  "load-balancing",
  "messaging",
  "networking",
  "observability",
  "rate-limiting",
  "realtime",
  "replication",
  "scalability",
  "search",
  "security",
  "sharding",
  "storage",
  "streaming",
] as const;
export type Tag = (typeof TAGS)[number];

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const referenceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});

export const stageSchema = z.object({
  name: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1).max(6),
});

export const frontMatterSchema = z
  .object({
    id: z.string().regex(kebab, "id must be kebab-case"),
    deck: z.enum(DECK_SLUGS),
    type: z.enum(CARD_TYPES),
    difficulty: z.number().int().min(1).max(3),
    tags: z.array(z.enum(TAGS)).min(1).max(5),
    prompt: z.string().min(10),
    keyPoints: z.array(z.string().min(1)).min(3).max(6),
    /** A plain-language restatement of each key point, in the same order. */
    eli5: z.array(z.string().min(1)).optional(),
    /** Plausible but wrong statements about the prompt, for the pick exercise. */
    distractors: z.array(z.string().min(1)).min(2).max(5).optional(),
    followUps: z.array(z.string().min(1)).max(5).default([]),
    references: z.array(referenceSchema).min(1),
    stages: z.array(stageSchema).min(3).max(8).optional(),
    updated: z.coerce.date(),
    reviewed: z.boolean().default(false),
  })
  .superRefine((card, ctx) => {
    if (card.eli5 && card.eli5.length !== card.keyPoints.length) {
      ctx.addIssue({
        code: "custom",
        path: ["eli5"],
        message: "eli5 must have one entry per key point",
      });
    }
    card.distractors?.forEach((distractor, i) => {
      if (card.keyPoints.includes(distractor)) {
        ctx.addIssue({
          code: "custom",
          path: ["distractors", i],
          message: "a distractor must not repeat a key point",
        });
      }
    });
    if (card.type === "design" && !card.stages) {
      ctx.addIssue({
        code: "custom",
        path: ["stages"],
        message: "design cards must include stages",
      });
    }
    if (card.type !== "design" && card.stages) {
      ctx.addIssue({
        code: "custom",
        path: ["stages"],
        message: "only design cards may include stages",
      });
    }
    if (card.type === "estimation" && !card.tags.includes("estimation")) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: "estimation cards must carry the estimation tag",
      });
    }
  });

export type FrontMatter = z.infer<typeof frontMatterSchema>;
export type FrontMatterInput = z.input<typeof frontMatterSchema>;

/** The compiled card: validated front matter plus the Markdown answer body. */
export interface Card extends Omit<FrontMatter, "updated"> {
  /** ISO date (YYYY-MM-DD) so the compiled JSON stays plain. */
  updated: string;
  /** Model answer in Markdown. May include ```mermaid blocks. */
  body: string;
}

/** Shortest model answer a card may have, in characters. */
export const MIN_BODY_LENGTH = 40;

/** The compiled form of validated front matter plus its Markdown body. */
export function toCard(frontMatter: FrontMatter, body: string): Card {
  return { ...frontMatter, updated: frontMatter.updated.toISOString().slice(0, 10), body };
}

export interface Deck {
  slug: DeckSlug;
  title: string;
  description: string;
  /** Short line used on the deck picker. */
  blurb: string;
}
