---
slug: system-design-preparation
title: System design preparation that fits in a month
description: "System design preparation that fits a working month: a four-week calendar, what to drill first, and when to stop adding cards."
primaryKeyword: system design preparation
secondaryKeywords:
  - four week interview calendar
  - weekday card reviews
category: study-method
tags:
  - study-method
  - scheduling
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

System design preparation fails when it tries to be a second job. A month of evenings is enough if the evenings are short, the work is spoken, and you stop adding material once the deck is circulating. Re-reading a book every night feels like progress and leaves you with recognition. A due queue of cards you have already failed feels worse and is the thing that still works on interview day. This post is a four-week calendar that sits next to a full-time job, what to drill before the cards start repeating, what to drill after they do, a weekend mock that uses the same rubric as the weekday reviews, and a rule for when to stop adding cards.

## A four-week calendar that fits a job

Assume five weekday sessions of fifteen to twenty-five minutes and one longer block on the weekend. That is the whole budget. If a week at work eats two evenings, skip new cards on those days and clear the due queue only. Do not "catch up" by doubling new cards the next night. The reviews behind a spike are what blow the following week.

MetaStack's defaults are built for this budget. Mixed study pulls due cards first, then new cards up to ten a day. The bank is 64 cards across Fundamentals, Estimation, and Classic designs (39, 10 and 15). Ten new a day finishes introductions in a week, with a few left for day seven. FSRS via ts-fsrs then spends the next two weeks on the cards you did not nail. You do not pick a deck. The queue picks.

| Week | Weeknights | Weekend | Stop doing |
| --- | --- | --- | --- |
| 1 | Due cards, then new ones up to the daily limit, spoken answers, rubric mode | Read one design card end to end. Do not time it. | Extra new cards, highlighting chapters |
| 2 | Reviews only. New cards only if a few remain unseen | One timed 45-minute pass on a single prompt | Adding cards from every article you open |
| 3 | Reviews. Evening reading only for cards you rated Hard or Again | A recorded mock. Grade it against key points, not vibes | Starting a second deck or a second book |
| 4 | Short due queue. Protect sleep the night before a loop | A second mock on a different prompt, or a rest day | Cramming the whole bank the night before |

Week one is introduction. You will rate Again and Hard more than you like. That is the deck measuring production, not recognition. Week two is where retention is built, which is why the calendar protects it. Week three adds a mock because a scheduler cannot tell you that you talked for ten minutes before asking about scale. Week four is maintenance and one more timed pass if you have the energy.

If the loop is in three weeks, delete week four. If it is in two, raise the daily new-card limit so the bank is seen by day four or five, and protect the review week. The [spaced-repetition three-week table](/blog/spaced-repetition-for-system-design) is the tighter version of this calendar.

Nothing here needs an account. Card state lives in IndexedDB. Export the JSON if you switch machines. Sign-in is optional and only adds a server copy.

## What to drill in week one

Drill the shape of an answer, not the catalogue of products. Week one is for meeting every card once and learning how you will grade.

Start each night from mixed study. Answer out loud before you reveal. Thirty to ninety seconds for a concept or tradeoff card. Longer for a design stage. Tick only the key points you said. Accept the suggested rating unless you have a reason to override. Under 40 percent of the points is Again, 40 to 69 is Hard, 70 to 94 is Good, 95 and up is Easy. Again comes back in the same session, a few minutes later. That second attempt is cheap because the model answer is still nearby.

Speak. The interview is spoken. If you cannot speak in the room you study in, whisper, or type the points you would have said and compare. Use the rubric on new cards. Quick mode, keys 1 to 4, is for cards you have already proven. Do not pick favourites. The design cards are built out of the fundamentals. If delivery guarantees are weak, the chat design is weak, and the design card will not tell you which fundamental failed.

The estimation deck is ten cards. It looks skippable. It is the part of a real hour where prepared people go quiet. Grade the steps: assumption, conversion, rounding, the sentence that names the fork.

On the weekend, pick one classic design and read it stage by stage without a timer. Requirements, estimates, API, data model, high-level design, deep dives, failure modes. That pass is reading. You are learning the shape so week two's reviews have somewhere to land. The [URL shortener card](/cards/url-shortener) is a short first read.

If a topic is new to you, the card is a prompt to read, not a test. Rate Again, read a public explanation, and come back. Trying to learn a topic entirely from the back of its card is re-reading with extra clicks.

## What to drill once the cards start repeating

Week two is reviews. The new-card stream has dried up, or nearly has. The queue is the cards you rated Hard and Good, plus the Again cards that never quite settled. This is the uncomfortable week and the one that pays.

Drill the misses, not the whole back of the card. If you keep dropping virtual nodes on consistent hashing, say virtual nodes first the next time, then the rest. If you keep skipping the durability sentence on write-back, put that sentence on a scrap of paper and say it before you start. The card already has three to six points. You do not need a new card for every miss. You need a tighter spoken answer on the same card.

Evening reading is one topic, the one behind a Hard or Again from that afternoon. Not a chapter. Not a second book. The follow-up questions on the card are a better reading list than a table of contents. When a follow-up surprises you, that is the evening.

Keep estimation in the mix unless the scheduler has moved those cards out. Easy on a design stage means you produced the key points, not that you can defend them. Read the follow-ups after you rate.

Resist the "study more" path while the due queue is long. That path bypasses the daily new-card limit. It is there for an empty queue. Adding ten new cards on top of thirty reviews is how week three becomes unmanageable.

The scheduler is doing arithmetic you should not redo by hand. FSRS keeps difficulty, stability and retrievability per card and aims at a 0.9 target retention. Intervals cap at 180 days. Fuzz is off, so the "next review in" label is the real date. The comparison with SM-2, and why a lapse does not reset a card to zero, is in [FSRS vs SM-2](/blog/fsrs-vs-sm-2). Grade honestly and let the dates move.

## A weekend mock that uses the same rubric

A mock in this calendar is not a different sport from the weekday cards. It is the same key points, spoken in one sitting, against a clock.

Pick a prompt you have already met as a design card. Set a 45-minute timer. Record the audio, or the screen, or both. You do not need a partner for the first one. You need a recording you will grade. The longer write-up of that ritual is the [solo mock interview post](/blog/system-design-mock-interview). This section only places it on the calendar.

After the recording, open the matching design card and walk the stages. Tick the points you actually said. Do not tick the points you meant to say. A stage at 40 to 69 percent is Hard, same as a weekday review. Write down the two or three points that failed across stages. Those are next week's spoken drills, not a reason to add a dozen new cards.

Grade the clock as well as the content. Did requirements finish by minute five? Did you estimate only until a number picked a box? Did you leave time at the end? A complete design that ran to minute 50 has failed the interview even if every key point landed. Put the overrun on the same scrap as the missed points.

A partner is useful once you can already finish the clock. They catch the conversational faults the rubric cannot: talking over the requirements, defending a store they did not ask about, ignoring a hint. If you have one evening with a person this month, put it in week three or four, after a solo recording has already shown you the content gaps.

Do not mock a prompt you have never studied. That is an assessment of reading speed. Mock a prompt whose stages you have rated at least once. The mock then measures assembly, which is the skill the weekday cards cannot grade.

## When you are ready to stop adding cards

Stop adding when the bank is circulating and the misses are repeats. That sentence has two parts.

Circulating means you have seen every card at least once and the daily queue is mostly reviews. With 64 cards and ten new a day, that is the end of week one. If you raised the limit, it is earlier. You do not need a second bank to feel busy.

Repeats mean the Again and Hard ratings cluster on the same points. You drop the same durability sentence. You skip the same shard-key warning. You freeze on the same conversion. Those are drills, not new topics. Write the missing sentence on paper. Say it first. Rate the same card again when it comes due. A new card that asks the same thing in different words adds a due date without adding knowledge.

Add a card when a mock or a real loop reveals a hole the bank does not cover. Write it in the same shape the validator already enforces: a prompt an interviewer would say, three to six key points a strong answer includes, at least one public reference. Vague points ("explain the tradeoffs") fail as soon as you try to tick them. Sixty homemade cards is a weekend you are no longer in. One or two cards for a real hole is a weeknight.

Do not add cards from every article you open in week two. The article can be the evening read behind a Hard rating. You are also ready to stop adding when the remaining Hard cards are topics you could teach. Extra cards at that point are a way to avoid a mock.

A month of this is enough to walk into a loop with the fundamentals in your mouth and one or two designs you can assemble under a clock. It is not enough to memorise every product in a cloud catalogue, and that is not the job. If you want the first due card tonight, start from the [fundamentals study queue](/study/fundamentals) or from mixed study on the [study page](/study), and let the scheduler spend the rest of the month.
