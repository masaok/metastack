---
slug: interview-study-guide
title: Interview study guide for system design
description: "An interview study guide that stays one page: topics that show up in every loop, topics that can wait, and a daily review that keeps it honest."
primaryKeyword: interview study guide
secondaryKeywords:
  - interview cheat sheet
  - interview roadmap
category: study-method
tags:
  - study-method
  - flashcards
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

An interview study guide is useful when it is short enough to lie about. A page you can scan on a Sunday night will tell you whether you still remember the forks. A forty-page outline will not, because you will read it and feel fluent. This post is about the topics that show up in almost every system design loop, the topics that can wait, why a one-page guide beats a pile of notes and still loses to a deck, how to keep the page honest as you learn, and how to hang it on a daily review so it does not rot. People also ask for an interview cheat sheet or an interview roadmap. Those are the same page with a different title. If it does not fit on one sheet, it is a book, and you already have books.

## The topics that show up in almost every loop

Almost every prompt turns on the same small set of decisions. The product changes. The decisions do not. A guide that lists products will grow forever. A guide that lists decisions stays one page.

Write these as questions, not as headings. A heading you recognise is cheap. A question you cannot answer is the point.

**What is allowed to be wrong, and for how long?** Caches, replicas, and queues all buy something by being behind. If you cannot say what a reader is allowed to see after a write, you will put a cache on the board and hope. Consistency models, replica lag, and the author's own read belong here.

**Where does a write go, and what happens if that path retries?** Idempotency, exactly-once you will not get, and the difference between a queue you drain and a log you replay. Chat, payments, and "post a photo" all die on a double write if you have not said this out loud.

**What is the shard key, and what is hot?** Partitioning shows up as soon as one primary cannot take the writes. The key you pick decides whether a celebrity, a popular short code, or a single customer melts a node.

**What do you put in front of the store?** A cache, a balancer, a rate limiter, a CDN. Not all four every time. Read ratio picks the cache. Abuse picks the limiter. Egress picks the CDN.

**How do you estimate just enough to pick a box?** QPS from daily actives, storage from object size, the 86,400 ≈ 10^5 conversion. Without this, the rest of the page is costume.

**What is the first failure that is not the database?** Timeouts, retries, a queue that backs up, a cache node with dirty data, a generator that collides. One failure, named, with a mitigation you can draw.

Those six questions cover a shortener, a feed, a chat, a rate limiter, and most of the prompts people recycle. If you can answer them for a new prompt in the first ten minutes, you have a design. If you cannot, adding "graph databases" to the guide will not help.

A one-page table that fits those questions:

| Question | You should be able to say | Leave off the page |
| --- | --- | --- |
| What may be stale? | Replica lag, cache TTL, author reads their write | Vendor consistency modes by name |
| What if the write retries? | An idempotency key, or a natural key, and where it lives | Exactly-once as a promise |
| What is the key? | The field you shard on, and one hot-key hedge | Every partitioning algorithm |
| What sits in front? | One reason per box you added | A mesh, a gateway, and a proxy stacked by habit |
| What is the number? | QPS or storage, and the fork it picked | A full capacity plan |
| What dies first? | One failure on the hot path | A disaster-recovery binder |

Keep the middle column in your own words. If you copy a paragraph onto the page, you have built a reading list.

## The topics that can wait

A lot of respectable material does not earn a line on the first page. It earns a line after a mock or a loop has asked for it.

Consensus algorithms can wait unless the prompt is a metadata store or a lock. You can say "a majority must see the write" without walking a leader election. Raft and Paxos are a later card, not a first-week heading.

Sagas, two-phase commit, and distributed transactions can wait until the prompt spans two stores that must agree, usually payments or inventory. Most feeds and shorteners do not.

Stream processors can wait until the prompt is fraud or metrics. A queue is enough for "fan this out later." Graph stores, time-series stores, and search engines can wait until the query is a neighbour walk, a rollup, or relevance. Clean architecture, meshes, and Kubernetes can wait until operations is the constraint.

Company-specific loops, language trivia, coding patterns, and behavioural stories do not belong on this page. This site does not teach them. If a Classic designs card is still unseen, it can wait until week two. The guide is for the decisions that repeat.

The rule is unkind and useful. If you have not needed the topic to finish a 45-minute prompt, it is not on page one.

## A one-page guide versus a deck

A page is a map. A deck is a test. You want both, and you want them to do different jobs.

The page tells you what "enough" is. On a Sunday you look at the six questions and mark any you could not answer in a sentence. That pass takes ten minutes and does not pretend to be study. It is inventory.

The deck tells you whether the sentence is still producible on a Wednesday. Recognition on the page is the same trap as re-reading a chapter. You see "idempotency key" and nod. A card asks you to say where the key lives and what a retry without it does, and you tick three to six points. The [flashcards post](/blog/system-design-interview-flashcards) is the case for that shape. The page should never replace it.

A roadmap people write in a notebook usually orders topics by a course. Week one is networking, week two is stores, week three is designs. That order is comfortable and it front-loads reading. A deck ordered by FSRS front-loads what you are about to forget. Those are different orders. Keep the page unordered. The six questions are not a sequence. They are a checklist you run against whatever prompt you have.

The page still wins in week one, as a reading order, and after a mock, as a place to write assembly faults ("asked about scale too late"). It loses when every article adds a row, or when you study from it the night before a loop. The due queue is the honest night-before session.

MetaStack's bank is 64 cards, three decks, three to six key points each. The page is a filter over the bank, not a second bank. If a question on the page has no card behind it, either the question is too vague or you have found a hole worth one new card.

## How to keep the guide honest as you learn

Honesty is a dating problem. The page goes stale in a week if you do not mark it from evidence.

Evidence is a rating or a recording, not a feeling. After a study session, look at the Again and Hard cards and put a mark next to the question they belong to. After a mock, mark the questions you did not answer out loud. Do not mark a question because an article made it sound important.

Use three states only.

- **Blank.** You have not tested it this week.
- **Tick.** You produced the sentence, on a card or in a recording, within the last two reviews.
- **Hole.** You failed it, or you skipped it, since the last Sunday.

Rewrite a hole in your own words the next time you get it right. The middle column should sound like you. If it still sounds like a blog post, you are still recognising.

Remove a row that has been ticked for two weeks and has not appeared in a mock. The page is not an archive. The deck is the archive. FSRS will bring the card back when retrievability is predicted to drop. The page does not need to store that date.

Add a row only when a mock asked a question the six do not cover. "Know Redis" is not a question. "When is Redis a cache, and when is it the wrong store?" is. Date the page on Sunday. Do not keep two copies. Paper is harder to grow, which is a feature.

## Linking the guide to a daily review

The page does not schedule. The scheduler does. Tie them together with a small ritual so the page does not become a separate project.

Each weekday session:

1. Open the due queue, not the page. Mixed study, due cards first, then new cards up to the daily limit of ten.
2. Answer out loud. Tick key points. Accept the rating or override it with a reason.
3. After the queue, spend two minutes on the page. Mark holes that the session proved. Do not read the rest of the page.
4. If a hole has no card, decide tonight whether it is a clock fault or a content fault. Clock faults go to the next mock. Content faults become at most one new card, in the same 3–6 point shape, or they become tomorrow evening's reading.

Sunday, ten minutes:

1. Scan the six questions. Any blank that you could not answer in a sentence becomes the week's evening reading, one question, not one book.
2. Clear ticks that are older than two weeks and still unused in a mock.
3. Look at the [software interview study plan](/blog/software-interview-study-plan) only if coding prep is eating the design evenings. The page cannot fix a calendar that has no design slot.

The scheduler details sit elsewhere. MetaStack wraps ts-fsrs, targets 0.9 retention, caps intervals at 180 days, and stores state in IndexedDB without an account. The case for spacing, and the three-week version of the calendar, is in [spaced repetition for system design](/blog/spaced-repetition-for-system-design). The comparison with SM-2 is in [FSRS vs SM-2](/blog/fsrs-vs-sm-2). This page only needs you to treat the due queue as the daily driver and the guide as the Sunday inventory.

If the queue and the page disagree, trust the queue. The page is a human summary and it will be kinder than the ticks. The ticks are what the interviewer is about to hear.

When you want the next card instead of another pass over the sheet, start mixed study from the [study page](/study), or stay inside the [fundamentals queue](/study/fundamentals) if Sunday's scan showed the repeating decisions are still the holes.
