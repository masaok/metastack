---
slug: spaced-repetition-for-system-design
title: "Spaced repetition for system design: why it works"
description: Why system design knowledge fades, why re-reading does not fix it, and how spaced repetition for system design turns ratings into a three-week schedule.
primaryKeyword: spaced repetition for system design
secondaryKeywords:
  - forgetting curve
  - active recall for interviews
category: study-method
tags:
  - study-method
  - scheduling
author: Masao Kitamura
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

Spaced repetition for system design works because it schedules each topic for the day you are about to forget it, and because it asks you to produce the answer rather than recognise it. Those two properties fix the two ways interview prep usually fails. You read about consistent hashing on a Sunday, feel good about it, and cannot explain virtual nodes two weeks later in the room. A spaced schedule would have asked you to explain virtual nodes on Wednesday, found the gap, and asked again on Friday. This post explains why the knowledge decays, why re-reading does not stop the decay, what spacing and recall change, how a scheduler turns your ratings into dates, and what a three-week plan looks like. It ends with the cases where spaced repetition is the wrong tool.

## Why system design knowledge decays

System design material has a shape that makes it easy to lose. It is wide. A reasonable prep list covers caching, replication, sharding, consistency models, queues, rate limiting, load balancing, and a dozen named designs. Each topic is small on its own. Together they are hundreds of facts and tradeoffs, and most of them are things you do not touch at work in a given month.

Memory follows what people call a forgetting curve. Right after you learn something, recall is high. It drops quickly at first and then more slowly. Each time you successfully recall the item, the curve resets and the next drop is slower than the last. That is the whole basis of spacing. It is common knowledge in memory research rather than a claim specific to any tool.

The shape matters for system design because the material is wide and shallow in daily use. You might run a cache at work and remember cache-aside without effort. You probably do not think about PACELC or rendezvous hashing between interviews. Those topics sit at the steep part of the curve and stay there. The result is a familiar experience. The week you studied, everything felt connected. Three weeks later, half of it is a vague outline and the other half is a word you recognise but cannot define.

There is a second reason the knowledge decays. System design answers are built from pieces, and the pieces depend on each other. A news feed design needs fan-out, a cache, a queue and a store. If the queue facts go, the design answer does not go blank. It goes thin. You still say "use a queue", you just cannot say what delivery guarantee you need or why. Thin answers are what interviewers mark down, and they are the hardest to notice in yourself because the outline is still there.

## Why re-reading does not stop the decay

The default response to forgetting is to read again. Open the notes, read the chapter, feel the recognition, close the chapter. Re-reading feels productive because recognition is fast and pleasant. Each sentence looks right. Nothing surprises you. The feeling is fluency, and fluency is a poor predictor of recall.

Recognition and recall are different operations. Recognition asks whether this thing matches something stored. Recall asks you to produce the thing with no cue but the question. An interview is recall under time pressure with another person watching. Re-reading trains recognition and leaves recall untouched, so the gap between how prepared you feel and how prepared you are grows the more you re-read.

Re-reading also has no schedule. You read what you feel like reading, which is usually the material you already know, because it is comfortable. The topics that most need work are the ones you avoid, and nothing in a re-reading routine forces them back in front of you. A deck with a scheduler does exactly that. It puts the uncomfortable card at the top of the queue.

## What spacing and active recall change

Spacing changes when you study. Active recall changes what you do when you study. They work together and they fail separately.

Active recall means you produce the answer before you see it. For a system design card, that means saying the comparison of write-through and write-back out loud, or writing the steps of a QPS estimate, before the back of the card appears. The act of retrieving the memory strengthens it more than reading it would. It also tells you the truth. If you cannot produce the answer, you know it now and not in the interview.

Spacing means the gap between attempts grows as the memory gets stronger. A card you failed comes back soon. A card you nailed waits longer each time. The gap is doing work. Retrieving something that has almost faded is harder than retrieving something you saw an hour ago, and harder retrieval produces a more durable memory. Cramming skips the gap, which is why the cram feels intense and leaves little behind a week later.

For a subject with no single right answer, active recall needs a rubric. "Did you get it right?" does not apply to "design a rate limiter". What applies is coverage. Did your answer include the points an interviewer listens for? MetaStack's cards each carry three to six key points, and you tick the ones you said. The companion post on [building flashcards that train the spoken answer](/blog/system-design-interview-flashcards) covers card shapes and grading in detail. For this post, the thing to hold onto is that the tick count becomes the rating, and the rating drives the schedule.

## How a scheduler turns ratings into intervals

A spaced repetition scheduler is a function. It takes the card's history and your latest rating and returns the next due date. The older SM-2 approach keeps one number per card, an ease factor, and multiplies the current interval by it. FSRS, which MetaStack uses through the ts-fsrs library, keeps three numbers per card. Difficulty is how hard this card is for you. Stability is how long the memory lasts before recall drops below a threshold. Retrievability is the predicted chance you can recall the card right now.

The scheduling rule is to pick the next review for the moment retrievability is predicted to fall to a target. MetaStack sets that target at 0.9, so the next review lands when the model predicts a nine in ten chance you still remember. Rate Easy and stability jumps, so the next due date is further out. Rate Again on a card you had learned and it is treated as a lapse. It comes back within the same session, in minutes rather than tomorrow, and its stability starts over from a lower point.

Two parameters shape how this plays out in a prep window. The maximum interval is capped at 180 days, so a card you rate Easy several times does not vanish for a year. Interview prep has a horizon of weeks, and the cap keeps every card in rotation. Fuzz is disabled, which means the scheduler is deterministic. When the rating button says "3d", the card is due in three days, not somewhere between two and four. The reasoning for choosing FSRS over SM-2, and what the difference means for a short deck, is in [FSRS vs SM-2: which scheduler should you study with?](/blog/fsrs-vs-sm-2).

The weights are the default FSRS weights. Per-user optimisation, where the model fits itself to your review history, needs more history than a new user has, so it is not part of the current setup. The practical effect is that two people rating the same card the same way on the same days get the same schedule.

## A worked example with one card over a week

Take [the consistent hashing card](/cards/consistent-hashing). It has five key points. The prompt asks you to explain consistent hashing, say what problem it solves compared with hash mod N, and say what virtual nodes are for.

Day one, the card is new. You answer out loud. You say that hash mod N remaps almost every key when N changes, and you describe the ring with each key going to the next node clockwise. You forget virtual nodes, you forget replication to the next R nodes, and you do not mention where it is used. That is two points of five, which is 40% coverage. The rubric maps 40 to 69% to Hard. The card is scheduled to return soon.

The card returns. This time you get the two points from before, plus virtual nodes, plus replication. Four of five is 80%, which is Good. The interval grows.

Third time, you say all five. That is 100%, which is Easy, and the card moves out of your way for a while. If instead you had frozen and produced only the hash mod N point, that is one of five, 20%, which is Again. The card would return in the same session.

The thresholds are fixed and they are in the source. Under 40% is Again. 40 to 69% is Hard. 70 to 94% is Good. 95% and up is Easy. With five key points the only way to reach Easy is to say all five, which is strict on purpose. Four of five on a card about consistent hashing is a solid answer, and it is rated Good, which keeps the card in rotation a little longer. You can override the suggestion on any card if you have a reason. If you want the topic itself rather than the schedule, [the consistent hashing walkthrough](/blog/consistent-hashing-explained) covers the ring, virtual nodes and the failure cases.

## A three-week plan, day by day

Here is a plan built around the defaults. It assumes 64 cards across three decks (39 fundamentals, 10 estimation, 15 classic designs), a daily new-card limit of 10, and an interview on day 22. The new-card numbers follow from the limit. The review column has no numbers because it depends on your ratings.

| Days     | New cards            | Review queue                                                   | What else to do                                                                        |
| -------- | -------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1 to 6   | 10 per day, 60 total | Small at first, growing each day as early cards come due       | Answer out loud. Use rubric mode. Do not add cards beyond the limit.                   |
| 7        | The last 4           | Growing                                                        | Every card has now been seen once.                                                     |
| 8 to 14  | None left            | The bulk of your time. Mostly Hard and Good cards from week one | Read about the topic behind each Hard card that evening. One topic per evening.        |
| 15 to 18 | None                 | Thinning. Easy cards have moved out                            | Walk through two design cards end to end, stage by stage, as if you were in the room. |
| 19 to 20 | None                 | Short                                                          | Do one mock interview with a person. Write the gaps down as cards you need.            |
| 21       | None                 | Whatever is due                                                | Review only. No reading. Sleep.                                                        |

The first week is about introduction. Ten new cards a day is enough to see the whole deck in seven days and small enough that the reviews behind them stay manageable. Start each day from the mixed [study queue](/study), which pulls due cards from every deck first, oldest due first, and then fills the remaining new allowance. Do not pick a deck. Letting the queue decide is what makes the schedule work.

The second week is where retention is built. There are no new cards, so every session is reviews, and most of them are the cards you rated Hard or Good in week one. This is the uncomfortable week. The Again ratings on topics you were sure about are the reason you started three weeks out instead of three days.

The third week is for shape. By now the fundamentals are largely Good and Easy, and the review queue is short. Spend the saved time on the design cards, which are split into interview stages (requirements, estimates, API, data model, high-level design, deep dives, failure modes), and on a real mock. The estimation cards deserve a specific mention. There are only ten of them and they take about as many minutes. The method for the estimates themselves is in [the back-of-the-envelope estimation guide](/blog/back-of-the-envelope-estimation).

If your interview is in two weeks rather than three, compress the first week, not the second. Raise the daily limit in [settings](/settings) so introductions finish in four or five days, and protect the review week. If the interview is in one week, see the section on when this is the wrong tool.

## Mistakes people make with open-ended material

**Treating the model answer as the answer.** A design card has a long model answer on the back. It is a reference. If you grade yourself on whether your answer matched the model answer word for word, you will always rate low and the card will never graduate. Grade on the key points. The model answer is for reading after you rate.

**Rating on feel.** The rubric exists because feelings are generous. If the card has five key points and you said two, it is Hard, however familiar the back of the card looks. The tick count is the point of the method.

**Adding new cards during the review week.** New cards feel like progress. Reviews feel like a chore. The daily limit is there to stop you from trading one for the other. There is a "study more" path that bypasses the limit when you have a reason. Use it when the queue is empty, not when the queue is long.

**Putting a whole design on one card.** "Design a chat system" as a single card with twenty key points is a card you can never rate Easy and never learn from. Split it by stage. Each stage has three to six points and each stage can be rated honestly.

**Mistaking coverage for depth.** A card rated Easy means you can produce the key points. It does not mean you can defend them against a follow-up. The follow-up questions on each card exist to show you the hole. Read them after you rate. When one surprises you, that is a topic for the evening, not a reason to change the rating.

**Studying only one deck.** The design deck depends on the fundamentals deck. If delivery guarantees are weak, the chat system design is weak, and the design card will not tell you which fundamental is the problem. Mixed study across all decks is the default for a reason.

## When spaced repetition is the wrong tool

Spaced repetition is a maintenance tool. It keeps something you have learned from decaying. It is a poor way to learn something for the first time.

If you have never met consistent hashing, a card that asks you to explain it is not a test. It is a prompt to go and read. Rate it Again, read a good explanation, and come back. The card becomes useful the second time, once there is a memory to retrieve. Trying to learn a topic entirely from the back of its card produces the same thin recognition that re-reading produces, because that is what it is.

If your interview is in a week, spacing has little room to work. The gaps that make retrieval durable need time to open. You can still use the cards, and honest grading still tells you where the gaps are, but the schedule is doing less. Use the week for active recall without worrying about intervals, and pick the cards by weakness rather than by due date.

If your problem is the conversation rather than the content, cards will not fix it. A scheduler cannot tell you that you talk for ten minutes before asking about scale, or that you jumped to sharding before anyone mentioned load. For that you need a person and a whiteboard, and no number of reviews substitutes.

Finally, if the material is already yours, meaning you work with it daily and could explain it without notes, you do not need to schedule it. Rate those cards Easy, let them move out toward the cap, and spend the session on what you do not know.

## How to decide whether to use it

A short checklist.

- You know the topics but cannot reliably produce them under pressure. Use it.
- You have two weeks or more. Use it, and let the first week be introductions.
- You have never studied the material. Read first. Add cards as you go and start the schedule once the deck exists.
- You have a week. Drill by weakness and skip the schedule.
- You freeze in conversation, not on content. Do mock interviews, with the cards as a warm-up.

The method does not depend on any particular tool. A stack of index cards and a calendar is a spaced repetition system, and it works for the reasons in this post. What a scheduler like FSRS adds is the arithmetic. It tracks 64 due dates so you do not have to, and it moves the card you are about to forget to the top of the queue on the right day. MetaStack keeps that state in your browser and lets you export it as a JSON file, with no account involved. Nothing about the method requires it. The cards carry the content. The schedule carries the cards to you on time.
