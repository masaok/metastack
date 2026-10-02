import type { Deck, DeckSlug } from "./schema";

export const DECKS: readonly Deck[] = [
  {
    slug: "fundamentals",
    title: "Fundamentals",
    description:
      "The building blocks every design answer is assembled from: load balancing, caching, replication, sharding, consistency, queues, rate limiting and the tradeoffs between them.",
    blurb: "Concepts and tradeoffs you will be asked to justify.",
  },
  {
    slug: "estimation",
    title: "Estimation",
    description:
      "Back-of-the-envelope math: QPS from users, storage from writes, bandwidth from reads, and the latency numbers that make or break an architecture.",
    blurb: "Napkin math with the numbers interviewers expect you to know.",
  },
  {
    slug: "designs",
    title: "Classic designs",
    description:
      "Full design prompts drilled stage by stage: requirements, estimates, API, data model, high-level design, deep dives and bottlenecks.",
    blurb: "Complete interview prompts with a rubric for every stage.",
  },
];

export function getDeck(slug: string): Deck | undefined {
  return DECKS.find((d) => d.slug === slug);
}

export function isDeckSlug(slug: string): slug is DeckSlug {
  return DECKS.some((d) => d.slug === slug);
}
