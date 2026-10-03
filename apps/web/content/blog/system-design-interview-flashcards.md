---
slug: system-design-interview-flashcards
title: System design interview flashcards that actually stick
description: How to make system design interview flashcards that train the answer you give out loud, not recognition. Card shapes, a grading rubric, and a daily routine.
primaryKeyword: system design interview flashcards
secondaryKeywords:
  - system design flashcards
  - how to study for system design interviews
category: study-method
tags:
  - study-method
  - interviews
author: Masao Kitamura
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

System design interview flashcards work when the card asks the question an interviewer would ask and grades the answer the way an interviewer would. Most decks fail on the second half. They show a term on the front and a paragraph on the back, you read the paragraph, you feel a flicker of recognition, and you press "good". Then you sit in the interview, the interviewer says "compare write-through and write-back", and the paragraph is not there. This post is about building and using cards that close that gap. It covers the three shapes of card that hold up, how to grade yourself without lying, and what a daily session looks like when the scheduler decides the order.

## Why most flashcards fail for system design

A vocabulary card has one right answer. "Capital of France" has an answer you either produce or do not. System design questions are not like that. "How would you design a URL shortener?" has no single answer. The interviewer is listening for coverage: did you ask about scale, did you estimate storage, did you pick an ID scheme and defend it, did you mention what happens when the database is down. A card that puts a 600-word model answer on the back and asks "did you know this?" measures recognition. Recognition is cheap. Reading a good answer and nodding feels like learning, and the feeling is the problem, because it does not predict what you will say under pressure.

There is a second failure. Term-first cards train the wrong direction. The interview gives you a situation and wants the concept. A card that shows "consistent hashing" and asks for a definition trains the reverse mapping, from name to meaning. You need the forward one: here is a cache cluster that needs to grow, which technique do you reach for and why. Cards should start from the prompt an interviewer would say, not from the vocabulary word.

The third failure is about grading. Self-graded flashcards depend on an honest rating, and honesty is hard when the answer is a paragraph. Was your answer "good"? Compared to what? Without a rubric, most people drift toward generous ratings, intervals grow, and the deck quietly stops testing anything.

## Three card shapes that hold up

MetaStack's card bank has 64 cards in three decks, and they fall into three shapes. Each shape exists because it survives the problems above.

**Concept and tradeoff cards.** The prompt is a comparison or a "when would you use" question. [The caching write strategies card](/cards/caching-write-strategies) asks you to compare write-through, write-back and write-around and say when you would pick each. The back is not a paragraph to recognise. It is a list of key points, between three and six per card, each one a thing a strong answer includes. For that card the points are: write-through is synchronous to both cache and store, write-back acknowledges early and risks loss on cache failure, write-around skips the cache for write-once data, the choice ties to read/write ratio and durability needs, and write-around usually pairs with cache-aside reads. If you said four of those five out loud, you know it. If you said two, you do not, however familiar the paragraph feels.

**Estimation cards.** The prompt gives a scenario and asks for a number: queries per second from daily active users, storage for a photo-sharing service, the cache size you need if 20% of the data serves 80% of the reads. The key points here are the steps, not the final figure. Did you state your assumptions? Did you round to powers of ten? Did you convert per-day to per-second with the 86,400 ≈ 10^5 shortcut? Estimation is the part of the interview where candidates freeze, and a card that drills the procedure is the only thing that makes the procedure automatic. The estimation deck is ten cards and takes about as many minutes.

**Design cards.** The prompt is a full system: a chat service, a rate limiter, a news feed. One card cannot hold a forty-minute answer, so these cards are split into stages that mirror the interview: requirements, estimates, API, data model, high-level design, deep dives, failure modes. Each stage has its own short rubric. You step through the stages and tick what you covered at each one. The card teaches you the shape of a design answer as much as the content, and the shape is what people lose first when they are nervous.

A card in any of these shapes also carries the follow-ups an interviewer is likely to ask next. For the write-strategy card: how would you make write-back safe against a cache node crash? Reading the follow-up after you answer is the fastest way to find the hole the interviewer would have found.

## Grade the answer, not the feeling

The fix for dishonest grading is to stop asking "how did that feel?" and start counting. Say the answer out loud, or type it, before you reveal the back. Then look at the key points and tick the ones you actually said. Not the ones you would have said, not the ones you recognise. The ones that came out of your mouth.

The tick count becomes the rating. MetaStack maps coverage to the four grades its scheduler understands: under 40% of the key points is Again, 40 to 69% is Hard, 70 to 94% is Good, and 95% or more is Easy. The thresholds are in the repository and you can override the suggestion on any card. The point is that the default is mechanical. You cannot talk yourself into a Good when you hit two points out of six, because the checkbox count is right there.

This changes the experience of studying in a way that is uncomfortable at first. Your ratings drop. Cards you thought you knew come back the next day. That is the deck working. A card that returns tomorrow because you covered two points out of five is a card that would have cost you in the interview, and tomorrow is a much cheaper place to find out.

If you want a faster session, a quick mode rates directly with the keys 1 to 4 and skips the rubric. Use it for the cards you have already proven, or when you have five minutes rather than fifteen. For a new card or one you lapsed on, the rubric is the whole point.

## Let the scheduler pick the order

Once grading is honest, the next question is which cards to see today. Working through the whole deck in order is the obvious approach and the wrong one. You spend most of the time on cards you know, and the cards you fumbled on Monday do not come back until you reach them again.

A spaced repetition scheduler inverts that. Every rating produces a next due date. A card you rated Again returns within the session. A card you rated Easy might not come back for weeks. Each day you see the cards that are due and a limited number of new ones. MetaStack uses FSRS for this, with a default of ten new cards per day and a maximum interval of 180 days so that nothing drops out of rotation during a prep window of a few weeks. The reasoning behind that choice over the older SM-2 algorithm is in [FSRS vs SM-2: which scheduler should you study with?](/blog/fsrs-vs-sm-2), and the general case for spacing is in [Spaced repetition for system design: why it works](/blog/spaced-repetition-for-system-design).

What this means in practice: your session is short and it is mostly made of the cards you are weakest on. With 64 cards, a daily session a few weeks before the interview is typically ten to twenty cards, and most of them are ones you have already met and not yet nailed. That is a very different use of twenty minutes than re-reading a chapter.

## A daily routine that fits in fifteen minutes

Here is the routine the cards are built for. It assumes you have an interview in two to six weeks.

1. **Open the due queue.** Mixed study pulls due cards from every deck first, then new ones up to your daily limit. Do not pick a deck to start; let the queue decide.
2. **Answer out loud before you reveal.** Speak as if the interviewer were there. Thirty to ninety seconds for a concept card, longer for a design stage. Out loud matters. The interview is spoken, and the words you can write are not always the words you can say.
3. **Reveal and tick.** Only the points you said. Press Enter to accept the suggested rating, or override it if you have a reason.
4. **Read the follow-ups.** One sentence each. If a follow-up surprises you, that is a note for later, not a reason to look it up now.
5. **Stop when the queue is empty.** Resist adding more new cards. The scheduler's daily limit is there because ten new cards a day, every day, is more than enough to cover the deck in a week, and the reviews pile up behind them.

On the weekend, or when the queue is short, browse the full card list on the [cards page](/cards) and read a design card end to end. That is reading, not drilling, and it is fine as long as you know the difference.

## Make your own cards, or start from a bank

You can build system design interview flashcards yourself, and some people should. Writing a card forces you to decide what the key points are, which is itself the understanding the interview tests. If you go that route, hold yourself to the same shape: a prompt an interviewer would say, three to six key points that a strong answer includes, and at least one reference you have actually read.

The cost is time. A good card takes twenty to forty minutes to write, and the first drafts have key points that are too vague to tick ("explain the tradeoffs") or too many of them. Sixty cards is a weekend you may not have. The other route is to start from an existing bank, drill it, and add cards for the gaps you find.

MetaStack's cards are Markdown files in a public repository, each with front matter that a build step validates: the tag vocabulary is closed, every card needs three to six key points, every card needs a public reference, and a card that fails validation fails the build. Cards you fumble are the best candidates for your own additions: read the model answer, find the specific point you keep missing, and write a card that asks for that point alone.

## Common mistakes

**Rating on recognition.** Covered above, but it is the one that undoes everything else. If you are not saying the answer before you reveal, the deck is a reading list.

**Skipping estimation.** Estimation cards are short and feel trivial. They are also the part of a real interview where the most prepared candidates go quiet. Ten minutes a day on the estimation deck for a week changes that.

**Studying only design cards.** Full designs are the glamorous part. But the design card for a chat system is built out of the fundamentals: delivery guarantees, realtime transport options, message queues. If a fundamentals card is weak, the design stage that depends on it is weak too, and the design card will not tell you which fundamental is the problem.

**Adding new cards to feel productive.** New cards are the easy dopamine. Reviews are where retention is built. If your due queue is thirty cards and you add ten new ones on top, tomorrow it is forty-five. Keep the new limit low and let the backlog clear.

**Cramming the night before.** Spacing works because the gaps are real. A deck you started three weeks out is worth more than the same deck crammed the night before, even though the cram feels more intense.

## What a good session feels like

It feels slightly worse than you expect. You will meet cards you were sure of and tick three boxes out of six. You will rate Again on something you explained to a colleague last month. That discomfort is the signal that the cards are measuring the right thing. After a week, the Again ratings thin out. After two, most of the session is Good and Easy, and the few Hard cards are exactly the topics you should read about that evening.

Nothing here requires an account or a subscription. The cards are open source, progress is stored in your browser, and you can export it as a JSON file and carry it to another machine. If you want to see the cards before committing to a routine, the [cards page](/cards) lists all 64 with their decks and tags. If you want to start, the next card is one click away.
