---
slug: fsrs-vs-sm-2
title: "FSRS vs SM-2: which scheduler should you study with?"
description: "FSRS vs SM-2 for flashcard study. What each does with a rating, what a lapse costs you, where SM-2 is still fine, and why MetaStack schedules with FSRS."
primaryKeyword: fsrs vs sm-2
secondaryKeywords:
  - fsrs algorithm
  - sm-2 algorithm
  - anki fsrs
tags:
  - scheduling
  - fsrs
  - study-method
author: Masao Kitamura
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

FSRS vs SM-2 comes down to one question. Do you want the scheduler to predict your memory, or to apply a fixed rule to your grades? If you want prediction, pick FSRS. It keeps three numbers per card, fits them to how you actually review, and schedules each card for the moment you are predicted to drop to a chosen retention. If you want a scheduler you can write in an afternoon and explain on a whiteboard, SM-2 is a fair pick, and it has been in use since 1987. For interview prep, where the deck is small and the deadline is a few weeks out, MetaStack uses FSRS. This post explains what each algorithm does with a rating, what happens when you forget a card, where SM-2 is good enough, and how to decide for your own study.

## What SM-2 does with a rating

SM-2 came out of SuperMemo in 1987. It keeps a small amount of state per card. There is an ease factor, which starts at a default and moves with your grades. There is the current interval. There is a count of how many reviews in a row have gone well. After each review you grade yourself, and the rule does three things with that grade.

First, it adjusts the ease by a fixed amount. A good grade nudges the ease up a little or leaves it alone. A poor grade pulls it down by a set step, down to a floor. Second, if the grade was a pass, it multiplies the previous interval by the ease to get the next one. The first two intervals are fixed steps rather than products, so a new card survives a short learning phase before the multiplier takes over. Third, if the grade was a fail, it resets the streak. The card goes back to the start of the learning phase and the interval sequence begins again.

Nothing in that rule knows how likely you are to remember the card today. SM-2 does not predict. It reacts. If you came back a week late and still remembered, SM-2 treats that the same as a review that landed on time. The ease factor is a per-card knob that drifts with your grades, and the interval follows it.

That is the whole algorithm, and the simplicity is the appeal. You can implement it in a few dozen lines. You can read a card's state and understand it. There are no fitted weights, no dataset and no training step.

## What FSRS does with a rating

FSRS stands for Free Spaced Repetition Scheduler. It models memory with three numbers per card. Difficulty is how hard this card is for you, on a bounded scale. Stability is how durable the memory is, expressed as the time it takes your chance of recall to fall to a reference level. Retrievability is the predicted probability that you remember the card right now, and it decays as time passes since the last review.

A rating updates difficulty and stability through formulas with fitted parameters. The update is not a fixed multiplier. How much stability grows after a Good depends on the card's current difficulty, its current stability and how far retrievability had fallen before you reviewed it. A card you recalled at the edge of forgetting gains more stability than one you reviewed early while it was still fresh. Scheduling then works backward from a target. You tell FSRS the retention you want, and it computes the interval at which retrievability is predicted to reach that value. Intervals differ by card, but the chance of recall at review time is roughly constant across the deck.

The parameters are weights fitted to review history. The library ships default weights fitted on public review data, and with enough history of your own they can be refit to you. FSRS is available as a scheduler in recent Anki versions, and the [ts-fsrs library](https://github.com/open-spaced-repetition/ts-fsrs) implements it for TypeScript. MetaStack wraps that library in a small package of pure functions, so the rest of the app only sees plain JSON state and a `rate` call.

## SM-2 vs FSRS at a glance

| | SM-2 | FSRS |
| --- | --- | --- |
| Memory model | None. A per-card ease factor and an interval. | Difficulty, stability and retrievability per card. |
| Inputs | Your grade for this review. | Your grade, the time since last review, and the card's current three values. |
| What a lapse does | Resets the interval to the start and cuts the ease by a fixed step. The ease penalty persists. | Computes a lower stability from the current stability and difficulty. Difficulty rises. The card does not return to zero. |
| Target retention | None. Retention is whatever falls out of the multipliers. | Explicit. You set the retention you want and intervals follow from it. |
| Tunability | A handful of constants such as starting ease, ease steps and first intervals. | Target retention, maximum interval, fuzz, and a set of weights that can be refit to your history. |
| Implementation effort | A few dozen lines. No dependencies. | A library. The formulas are public but you will not want to retype them. |
| When to pick | Small decks, a scheduler you must read and own, environments where a dependency is unwelcome. | Any deck where review time matters, lapses are common, or you want to reason about retention directly. |

## One card, five ratings, two schedulers

Take [the consistent hashing card](/cards/consistent-hashing). Suppose you meet it five times over a few weeks and rate it Good, Good, Good, Again, Good. No interval numbers follow, because the exact figures depend on the parameters and the days between reviews. The shapes are what matter.

Under SM-2, the first Good moves the card to its first fixed step and the second Good to the second. The third Good is the first real multiplication. The interval becomes the second step times the ease, and because every grade was Good, the ease is roughly where it started. Then you rate Again. The streak resets. The interval drops back to the first step, as if the card were new, and the ease takes its fixed penalty. The final Good puts the card on the second step again. From here it climbs by the same product rule, but the multiplier is smaller than it was, so each climb is shorter. The card has lost all of its progress and some of its growth rate in one bad day.

Under FSRS, the first Good sets an initial stability from the parameter for a first Good rating, and an initial difficulty. The second and third Good ratings each grow stability, by more when the review landed close to the target retention and by less when you reviewed early. Difficulty stays close to where it was, because Good is the neutral grade. Then you rate Again. FSRS does not reset. It computes a post-lapse stability from the current stability and difficulty. That new stability is lower than before, but it carries forward some of what the card had earned. Difficulty rises. The card enters a relearning state and comes back soon. The final Good grows stability again from that reduced base, and the next interval is wherever retrievability is predicted to hit the target. In MetaStack that interval is also capped at 180 days, so even a card that goes very well never leaves rotation during a prep window.

If you watched the "next review in" labels on the rating buttons, the SM-2 card falls off a cliff on the lapse and the FSRS card steps down. One lapse under SM-2 costs you the whole climb. One lapse under FSRS costs you part of it.

## What a lapse actually costs you

The lapse is where the two schedulers diverge most, and it is where interview prep lives. System design cards are not vocabulary. You will fumble them. The [flashcards post](/blog/system-design-interview-flashcards) argues for grading by counting the key points you said out loud, and honest grading on that rubric produces a lot of Again and Hard ratings in the first week. A scheduler that punishes lapses hard will spend your second week re-teaching cards you nearly knew.

SM-2's lapse behaviour has a name in the Anki community. Ease hell. Every failure cuts the ease by a fixed step. Passes raise it only a little. A card you fail a few times ends up with a low ease, and because the interval is a product of the ease, that card grows slowly from then on. You see it every other day, you keep passing it, and the interval barely moves. The algorithm has concluded the card is hard and has no quick way to unlearn that conclusion. People fix it by hand, resetting ease factors in bulk.

FSRS has no equivalent trap. Difficulty does rise with lapses, and a high-difficulty card does grow stability more slowly. But the growth also depends on stability and retrievability, and the model pulls difficulty back toward a mean over time. A card you failed early and then learned properly recovers. Its stability climbs, its intervals lengthen, and the early failures stop mattering.

There is a second difference in what a lapse costs in time. In MetaStack, a card rated Again comes back within the same session, a few minutes later, rather than tomorrow. FSRS handles that learning step itself. The card gets a second attempt while the model answer is still in your head, which is where relearning is cheapest.

## When SM-2 is a reasonable choice

A fair comparison says where the simpler tool wins, and SM-2 does win some cases.

It wins when you have to own the scheduler. If you are writing a tool for yourself, or for a team that must audit every line, a scheduler you can read in a minute beats one that depends on a library and a set of weights. You can explain to anyone why a card is due on Thursday. With FSRS the honest answer is "the model predicted retrievability would hit the target on Thursday", which is correct and not very illuminating.

It wins when the deck is small, the material is easy, and you rarely fail cards. Ease hell is a problem of lapses. A vocabulary deck you get right most of the time will not fall into it, and the difference between the two schedulers shrinks to a few extra reviews. For a small deck that may be a minute a day, which is not worth a dependency.

It wins when a dependency is unwelcome. A plugin for a tool that does not run JavaScript, a spreadsheet, a script with no package manager. SM-2 fits anywhere arithmetic does.

What SM-2 does not do is tell you anything about retention. If you want to say "I want to remember 90 percent of these cards when I sit down", SM-2 has no knob for that sentence. You adjust the ease constants and watch what happens.

## How MetaStack configures FSRS

MetaStack's scheduler lives in a package called `@metastack/srs`. It is a thin wrapper around ts-fsrs, and the choice is recorded in the project's ADR 0002. Three parameters are set on purpose.

The target retention is 0.9. Each card is scheduled for the point where the model predicts a 90 percent chance of recall. Lower and you forget cards you need in a week. Higher and the review load climbs steeply, because the last few points of retention are expensive.

The maximum interval is 180 days. Interview prep has a horizon of weeks, so a hard cap keeps every card in rotation. A card you rate Easy three times in a row still comes back within six months.

Fuzz is off. Many FSRS setups add a small random jitter to intervals so that cards learned together do not all come due together. That is useful for large decks and unhelpful when you want to test the scheduler or show the user an exact date. With fuzz off, the scheduler can be unit tested against exact values, and the "next review in" labels show the real date. The package exposes a `previewDue` function that computes the due date for each of the four ratings before you pick one, and that preview is only useful if it is exact.

The weights are the library defaults. Per-user optimisation needs more review history than a new user has, so the ADR leaves it as a possible later phase.

Ratings reach FSRS through a rubric. You tick the key points you said, and coverage maps to a grade. Under 40 percent is Again. From 40 to 69 is Hard. From 70 to 94 is Good. From 95 up is Easy. You can override on any card, and a quick mode skips the rubric. Each day's queue is built by a function called `buildSession`. It takes every card that is due, in a shuffled order, then adds new cards up to a daily limit, ten by default, minus however many new cards you have already met today. You can change that limit on the [settings page](/settings). The card state FSRS produces, with its stability, difficulty, lapse count and due date, is stored in your browser and goes out in the JSON export unchanged.

## Mistakes people make when comparing schedulers

**Comparing them on a deck that never lapses.** If every rating is Good, both schedulers grow intervals and the difference is a matter of degree. Compare them on the cards you fail, because that is where one has a failure mode and the other does not.

**Setting target retention very high.** A retention of 0.99 sounds like diligence. It means the scheduler brings every card back constantly, and your daily queue becomes unmanageable. If your queue is too long, this is the first thing to check.

**Blaming the scheduler for dishonest grading.** No scheduler fixes a Good that should have been an Again. SM-2 and FSRS both take your grade as truth. If you want the general case for spacing on material as loose as system design, [the spaced repetition post](/blog/spaced-repetition-for-system-design) covers it. Grade first, then worry about the algorithm.

**Switching schedulers mid-deck without a plan.** The two algorithms store different state. SM-2 has an ease factor and an interval. FSRS has stability and difficulty. Moving a deck from one to the other means converting that state or throwing it away. MetaStack's export format is tied to FSRS fields, and a scheduler change there would need a migration.

## Which scheduler should you study with?

If you are studying inside an existing app, use what it gives you, and if it offers FSRS, turn it on. Recent Anki versions ship it. The upgrade costs you a settings change and the trap of ease hell goes away.

If you are building a study tool, choose by what the deck will look like. A small deck of easy facts with few lapses is a fine home for SM-2, and the audit value of a few readable lines is real. A deck where honest grading produces frequent Again ratings, where review time is the constraint, or where you want to say out loud what retention you are aiming for, should run FSRS through a library.

For system design interview prep, the second description is the accurate one. The cards are hard. You will fail them. The deadline is fixed and the hours are not. That is why MetaStack schedules with FSRS, holds retention at 0.9, caps intervals at 180 days and keeps fuzz off. If you want to see what that feels like with real cards, the [study page](/study) will hand you the first one, and the scheduler will decide when you see it next.
