---
slug: system-design-interview
title: "System design interview: what to drill first"
description: "A system design interview scores coverage under a clock. What to clarify, when to estimate, and how the cards map onto the hour."
primaryKeyword: system design interview
secondaryKeywords:
  - whiteboard interview clock
  - interview requirements gathering
category: study-method
tags:
  - study-method
  - interviews
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

A system design interview is a timed conversation about coverage, not a drawing contest. The interviewer already knows several workable shapes for the prompt. They are listening for whether you ask the questions that decide the shape, whether you size the load before you pick stores, and whether you can name the first failure that would take the product down. Forty-five minutes is short. Most of the hour is spent on two or three decisions, and the rest of the whiteboard is there so those decisions have somewhere to sit. This post is about what they score, a clock you can reuse, what to lock down before you draw a box, how little estimation is enough, and how the MetaStack cards line up with that hour.

## What the interviewer is scoring

They are not scoring whether your shortener looks like anyone else's shortener. They are scoring whether you treated the prompt as a set of constraints you had to discover. A candidate who jumps to sharding in minute two has not scored. A candidate who writes "100 million users, read-heavy, links last a year" on the board in minute four has started.

Coverage is the practical rubric. Did you name the clients and the write path? Did you pick an identifier scheme and say what happens when two writes collide? Did you put a cache or a queue in a place that has a reason, and say what is allowed to be stale? Did you mention one failure that is not "the database is down"? Each of those is a point an interviewer can tick. Missing two of them is a thin answer even if the boxes are tidy.

They also score how you spend silence. A long pause while you invent a novel store is worse than a short pause while you write the assumptions. Talking for ten minutes without asking about scale is worse than either.

Tradeoffs count when they change the design. "We could use a relational store or a document store" is not a tradeoff until you say which query you are optimising. "SQL is fine until the write rate forces a shard key" is. Follow-ups work the same way: when they ask what happens if the cache node dies, they want the next sentence, not a restart. Cards that carry follow-up questions exist for that moment. Read them after you rate.

None of this requires a particular stack. Interviewers accept Redis, Memcached, or "an in-memory cache with a TTL" if you say what it is for. They mark you down when the cache is a sticker on every box.

## A 45-minute clock you can reuse

The same skeleton works for a shortener, a feed, a chat, or a rate limiter. The minutes move; the jobs do not. Write this clock at the top of the board, or keep it on a scrap of paper, and glance at it when you feel yourself decorating.

| Minutes | Job | What must be on the board |
| --- | --- | --- |
| 0 to 5 | Requirements | Users, read/write mix, what must not be lost, one non-goal |
| 5 to 10 | Estimates | QPS, storage order of magnitude, the bottleneck those numbers imply |
| 10 to 18 | API and data | Three or four endpoints, the records they touch, the key you will shard on later |
| 18 to 32 | Shape | Clients, stateless tier, store, cache or queue if the numbers need one |
| 32 to 40 | Deep dive | One hot path and one failure, in enough detail that they can interrupt |
| 40 to 45 | Close | What you would do with another hour, and time for their last question |

Five minutes of requirements is the only time you get to change the problem. Write the answers down. "Read-heavy" on the board saves you from a write-optimised store twenty minutes later.

The estimate block is a ceiling. A rate limiter may need one number and forty seconds. Video needs egress. Stop when the number has picked an architecture.

API and data prevent the collapse at minute twenty-five, when you realise you never decided what a "post" is. Three endpoints is enough. `POST /v1/links`, `GET /{code}`, `DELETE /v1/links/{code}` is a shortener.

The shape block is where people overdraw. Two or three tiers and one store is a complete first picture. Add a cache when the read ratio requires it. Add a queue when a write must not wait on a fan-out.

Deep dive is where you spend the points you earned. For a shortener that is the redirect and the ID generator. For a feed, fan-out on write versus fan-out on read. Then pick one failure on that path. You will not finish a second deep dive. The close is there so you can say so.

Practise the clock with a timer, not with a book. The [URL shortener card](/cards/url-shortener) is a good first prompt because the stages already match this table. The [month-long preparation calendar](/blog/system-design-preparation) puts one timed pass on a weekend once the fundamentals have been through the scheduler.

## What to clarify before you draw

Ask questions that change a box, then stop. A useful question has an answer that would make you draw something different. "How many daily active users?" changes the store and the cache. "Do links expire?" changes the data model and the cleanup job. "Is this a mobile client, a browser, or both?" changes the API and the session story. "Must a read see a write from the same user immediately?" changes whether you can put a queue on the write path.

Useless questions do not move a line. "Should we use Kubernetes?" does not, unless they have already said the constraint is operational. You can name a managed queue later if they push. You do not need the vendor to start.

Write four lines and treat them as contracts.

1. **Actors.** Who writes, who reads, and whether those are the same people.
2. **Scale.** Users or objects, and a read/write mix even if it is a guess they can correct.
3. **Durability.** What may be lost, and for how long a read may be stale.
4. **Non-goal.** One thing you are not building. A shortener is not a full analytics suite. A feed is not a search engine. Saying the non-goal out loud keeps you from drawing it.

If they refuse to give a number, pick one and write "assumption" next to it. "Assume 10 million daily actives, correct me." That sentence is better than a shrug. They will correct you when the number matters, which is the point.

Ask one functional question and one that picks the architecture. "What is the p99 on redirect?" and "Can a user see their own new link immediately?" are enough to start a shortener. Then draw. They will add constraints as you go. That is the interview working.

## When to estimate, and how little is enough

Estimate when the number would change the next box. Skip the rest.

A write rate of tens per second is one primary and some replicas. A write rate of tens of thousands per second is a shard key and a story about hot partitions. A storage number in the low terabytes is one store you can grow. A storage number in the petabytes is object storage and a pointer, not rows. Egress in the terabits is a CDN before any origin drawing. Those are the forks. If your arithmetic has not reached a fork, you are decorating.

The procedure is short. State the assumption. Convert to a per-second rate with 86,400 ≈ 10^5. Round to a power of ten. Say what the result means. "100 million daily users, 20 requests each, about 20,000 QPS. One web tier, one primary will not take the writes if they are 10 percent of that." You do not need the third significant figure. You do need the sentence that follows the figure.

Memorise a handful of conversions and stop. Seconds in a day to the nearest power of ten. Bytes in a million records at 1 KB and at 1 MB. The estimation deck is ten cards and exists to make those steps automatic.

Do not estimate every quantity in the prompt. Disk IOPS on a shortener redirect is almost never the fork. Candidates who compute six numbers and pick a store that ignores all six have not estimated. They have performed.

If you freeze, write the assumption and a round number and move. "Assume 1 KB per record, 10^8 records, about 100 GB. Fits on one node with room; we will revisit if the objects are photos." That is a complete estimate. The interviewer can change the object size. You have left a place for the change.

A card that drills the steps rather than the final figure is the right drill. Grade yourself on whether you stated the assumption, used the conversion, and named the fork. The number is the output. The steps are the answer.

## How the MetaStack cards map onto the hour

MetaStack ships 64 cards in three decks: Fundamentals, Estimation, and Classic designs. The decks are 39, 10 and 15 cards. Each card holds three to six key points, the things a strong spoken answer includes. Design cards are split into the same stages the clock uses: requirements, estimates, API, data model, high-level design, deep dives, failure modes. That is not a coincidence. The card is a rehearsal of the hour, cut into pieces you can rate.

Use the decks against the clock, not as a reading list.

**Minutes 0 to 5.** Fundamentals cards that force a constraint into the open: consistency models, what a cache is allowed to get wrong. You are training the questions, not the definitions.

**Minutes 5 to 10.** The estimation deck. Ten cards, about as many minutes. After a week of honest ratings these steps stop being the place you go quiet.

**Minutes 10 to 32.** Fundamentals that become boxes, then a design card for the prompt you expect. Walk the stages in order. Tick what you said. Do not read the model answer first. The [flashcards post](/blog/system-design-interview-flashcards) is the longer case for grading by ticks rather than by recognition.

**Minutes 32 to 45.** The same design card's deep-dive and failure stages, plus the follow-up questions. A follow-up that surprises you is the evening's reading, not a reason to change the rating.

The scheduler decides which cards you see. MetaStack wraps FSRS via ts-fsrs. Coverage maps to Again under 40 percent, Hard from 40 to 69, Good from 70 to 94, Easy from 95 up. Again brings the card back in the same session. Intervals cap at 180 days so a card does not leave a prep window. Progress lives in IndexedDB. You do not need an account. The [spaced repetition post](/blog/spaced-repetition-for-system-design) is the case for letting the due queue pick the order.

A daily session of due cards plus a default of ten new ones meets the bank in a week. That is introduction. Mastery is the reviews in week two, and one timed pass on a weekend. The clock above is what you run on that weekend.

If you want the first due card rather than another paragraph, the [study queue](/study) will start mixed study across all three decks, oldest due first, then new cards up to the daily limit.
