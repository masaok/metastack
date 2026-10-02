import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { cards, cardsForDeck, DECKS, getCard } from "@metastack/content";

import { HeroCard } from "@/components/hero-card";
import { ButtonLink } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { GITHUB_URL } from "@/lib/utils";

const HERO_CARD_ID = "caching-write-strategies";

const steps = [
  {
    title: "Read the prompt and answer out loud",
    body: "Exactly like the interview. There is a scratchpad if you want to sketch, but speaking is the point.",
  },
  {
    title: "Reveal, then tick the points you actually hit",
    body: "Every card carries a rubric of three to six key points instead of one right answer, because design questions do not have one.",
  },
  {
    title: "Your coverage sets the rating; FSRS sets the date",
    body: "Under 40% is Again, 95% is Easy. The scheduler picks the next review so you see shaky cards soon and solid ones rarely.",
  },
];

export default function HomePage() {
  const hero = getCard(HERO_CARD_ID) ?? cards[0]!;
  const total = cards.length;

  return (
    <>
      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20 lg:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="max-w-xl">
            <h1 className="font-display text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.03em] text-ink sm:text-[3.4rem] lg:text-[3.9rem]">
              Drill system design until the answers are reflex.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-ink-2">
              {total} original flashcards on caching, sharding, consistency, estimation and the
              classic design prompts. Spaced repetition decides what you see next. Progress saves in
              this browser. No account, no paywall.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href="/study" size="xl">
                Start drilling <ArrowRight className="h-5 w-5" />
              </ButtonLink>
              <ButtonLink href="/cards" size="xl" variant="outline">
                Browse the cards
              </ButtonLink>
            </div>
            <p className="mt-5 text-sm text-ink-3">
              Your first card is on screen in one click. Press <Kbd>space</Kbd> to reveal,{" "}
              <Kbd>1</Kbd>–<Kbd>9</Kbd> to tick points, <Kbd>enter</Kbd> to rate.
            </p>
          </div>
          <div className="pt-12 lg:pt-6">
            <HeroCard card={hero} />
          </div>
        </div>
      </section>

      {/* How a drill works */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink">
              One drill, ninety seconds
            </h2>
            <p className="mt-4 text-ink-2">
              The loop is built around how the real interview goes: you talk, the interviewer checks
              boxes in their head. MetaStack makes those boxes visible.
            </p>
          </div>
          <ol className="relative space-y-6 border-l border-rule pl-8">
            {steps.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="absolute -left-[2.45rem] flex h-7 w-7 items-center justify-center rounded-full border border-rule-strong bg-paper font-mono text-xs text-ink-2">
                  {i + 1}
                </span>
                <h3 className="font-display text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Decks */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink">Three decks</h2>
          <Link
            href="/decks"
            className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            See due counts
          </Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {DECKS.map((deck, i) => {
            const n = cardsForDeck(deck.slug).length;
            return (
              <Link
                key={deck.slug}
                href={`/study/${deck.slug}`}
                className="index-card group flex min-h-[220px] flex-col px-6 pt-5 pb-5 transition-shadow hover:shadow-[var(--shadow-lift)]"
                style={{
                  ["--rule-top" as string]: "60px",
                  transform: `rotate(${[-0.6, 0.4, -0.3][i]}deg)`,
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl font-bold text-ink">{deck.title}</h3>
                  <span className="shrink-0 font-mono text-sm whitespace-nowrap text-ink-3">
                    {n} cards
                  </span>
                </div>
                <p className="mt-6 text-[0.95rem] leading-relaxed text-ink-2">{deck.blurb}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-medium text-red-ink">
                  Drill this deck
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Why FSRS + open source */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-24 sm:px-6">
        <div className="grid gap-10 rounded-[var(--radius-card)] border border-rule bg-paper p-8 md:grid-cols-2 md:p-10">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              Why FSRS and not a fixed schedule
            </h2>
            <p className="mt-4 text-ink-2">
              Most flashcard apps still use SM-2 from 1987: fixed multipliers that treat every card
              the same. FSRS fits a memory model to how you actually rate each card, so a concept
              you keep fumbling comes back tomorrow while one you nailed waits a month. Fewer
              reviews, same retention.
            </p>
            <p className="mt-3 text-ink-2">
              The scheduler is a small, pure, fully tested package. Your progress is yours: export
              it as JSON any time from Settings.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              Open source, written by hand
            </h2>
            <p className="mt-4 text-ink-2">
              Every card is original Markdown with a rubric and a link to a public engineering blog
              or docs page. Bad cards fail the build. If you spot a mistake or want to add a card,
              open a pull request.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href={GITHUB_URL} variant="secondary" target="_blank" rel="noreferrer">
                View on GitHub
              </ButtonLink>
              <ButtonLink href="/cards" variant="outline">
                Read the cards
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
