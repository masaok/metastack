---
slug: system-design-mock-interview
title: System design mock interview, run at home
description: Run a system design mock interview at home. Pick a prompt, record the hour, grade against key points, and turn gaps into cards.
primaryKeyword: system design mock interview
secondaryKeywords:
  - solo mock interview
  - interview recording review
category: study-method
tags:
  - study-method
  - flashcards
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

A system design mock interview does not need a partner on the first attempt. It needs a prompt, a timer, a recording, and a rubric you will apply after you stop talking. Partners are useful later, when the content is already in your mouth and the remaining faults are conversational. Before that, a solo recording finds the same holes a weekday card finds, and it finds the holes a card cannot: you never asked about scale, you drew for twenty minutes, you ran past forty-five. This post is a mock you can run alone, the setup, how to grade the recording against key points, what a weak pass usually missed, and how one recording becomes the next week's cards.

## A mock you can run without a partner

The point of a mock is assembly. Weekday cards test a comparison, an estimate, or one stage of a design. A mock tests whether those pieces still appear when the clock is running and no one is advancing the stage for you. You can test that in a room by yourself if you are willing to watch the recording.

Pick a prompt you have already met as a design card. A first mock on a topic you have only read about measures whether you can read. A first mock on a topic whose stages you have rated at least once measures whether you can assemble. The [URL shortener card](/cards/url-shortener) is a good first prompt because the stages are short and the forks are obvious. Chat and a news feed are better second and third prompts, once the shortener recording has shown you how you use the hour.

Set rules in advance so you do not negotiate with yourself at minute twenty.

- You may look at a blank page or a whiteboard. You may not look at notes, cards, or a model answer until the timer ends.
- You speak the whole time. Silence while you draw is fine. Silence while you think of a vendor is not an excuse to search.
- You stop at 45 minutes even if the failure case is unfinished. The unfinished part is data.
- You record. Memory of what you said is generous in the same way recognition is generous.

A partner changes the exercise. They interrupt and refuse to give a number. That is a better interview and a worse diagnostic if you still cannot finish the skeleton. Run one or two solo recordings first. If you have no quiet room, a headset and a document is enough. The audio is what you grade.

## The prompt, the timer, and the recording

Write the prompt at the top of the page before you start the timer. One sentence. "Design a URL shortener for 100 million users who create links that last a year." If you leave the prompt in your head, you will drift into a related product at minute fifteen.

Use a 45-minute timer you can see. Phone on the desk is fine. A second timer at 5, 10, 18 and 32 minutes is better, because those are the job boundaries from the interview clock: requirements, estimates, API and data, shape, then deep dive. You will ignore the second timer the first time. That is information.

Record the screen if you draw on a tablet or a shared doc. Record audio if you draw on paper. Record both if you can. You are not producing a film. You are producing a transcript you can tick against.

Start the timer and do the first five minutes as if someone were there. Ask the clarifying questions out loud. Answer them out loud, including the ones you have to assume. "I am assuming 10 percent of users create a link on a given day. Correct me." There is no one to correct you. Say it anyway. The sentence is what you are practising.

When you estimate, say the assumption, the conversion, and the fork. When you draw a cache, say what is allowed to be stale. A recording that is mostly "and then we put a load balancer here" will grade poorly even if the picture is neat.

If you get stuck, say so and move to the next job on the clock. In a solo mock the timer is the nudge. Stop when it ends. Save the file. Take five minutes away before you grade.

A checklist for the setup, so you do not invent a new ritual each weekend:

1. Prompt written. Timer visible. Recorder on.
2. Blank page. Cards closed.
3. Forty-five minutes, spoken.
4. File saved. Break.
5. Card open. Ticks only for what the recording contains.

## Grading the recording against key points

Open the matching design card after the break. Walk each stage in order. Play the recording and tick a key point only when you hear it. Not when you see a box that would have implied it. Not when you remember intending to say it. When you hear it.

Each stage has three to six key points. The coverage map is the same one the weekday queue uses. Under 40 percent is Again. 40 to 69 is Hard. 70 to 94 is Good. 95 and up is Easy. With five points, Easy means all five. Four of five is Good, which is a solid stage and still in rotation. Write the stage grades on the page under the prompt.

Then grade the clock on a second pass, without the card.

| Check | Pass | Fail |
| --- | --- | --- |
| Requirements on the board by minute 5 | Actors, scale, durability, one non-goal are spoken | You are drawing boxes before anyone agreed the problem |
| An estimate that picks a box | One or two numbers, then a sentence about the store or the cache | Six numbers, or no numbers, or numbers that never get used |
| API and data before the big picture | Endpoints and records exist | The picture has a "service" with no idea what it stores |
| A deep dive, not a tour | One hot path in enough detail to interrupt | Every box gets a sentence and none gets a minute |
| A close | You stop, you name what is missing, you leave time | You are still drawing at 45 |

A stage at Easy and a clock that failed is still a failed mock. The interviewer does not award extra minutes because the data model was complete.

Do not grade against the model answer paragraph. The model answer is a reference you read after the ticks. If you require your spoken hour to match it, you will rate every stage Again and learn nothing about which points you actually missed. The [flashcards post](/blog/system-design-interview-flashcards) is the longer version of that rule. It applies harder to a mock because the temptation to be kind to yourself is louder after 45 minutes of talking.

Override a suggested rating only when the recording is ambiguous. If you said "the cache can be a few seconds behind" you may tick a staleness point even if you did not say "eventual consistency" by name. If you said "we will cache it" and nothing else, you may not.

## What a weak mock usually missed

The same misses show up across prompts. They are more useful than a unique theory of why your shortener was weak.

**No written requirements.** You asked two questions and started drawing. Twenty minutes later you cannot remember whether links expire. The fix is four lines on the board, not a better cache.

**An estimate with no fork.** You computed QPS and storage and then picked the store you were going to pick anyway. The number must change a box or it was theatre.

**A picture with no write path.** Boxes for clients, a balancer, a database, and no arrow for creating a link. The first deep dive should walk one write without inventing a record.

**A cache sticker.** Every box has a cache and you cannot say what is allowed to be wrong. One cache on the hot read, with a TTL, is a design.

**No failure that is not "the database is down."** Name a second one: dirty write-back, a backed-up queue, a colliding ID.

**Overrun or a tour.** Completeness is not a virtue past 45. Mentioning seven components and explaining none looks busy. A stronger mock looks sparse and has two minutes on the ID allocator.

Listen for filler. "We would need to think about consistency" is not a point. "The reader can be a replica a second behind, except the author should see their own write" is. Quiet is also a miss. Careful is "I am going to assume X and draw Y."

## Turning one mock into the next week's cards

Do not build a new deck from a weak mock. Extract two or three holes and attach them to work you already do.

Write the missed key points on a single list, grouped by whether the bank already has a card for them.

If the bank has the card, you do not add a card. You change how you answer the one that exists. If you missed "write-back acknowledges early and can lose data on a crash," the caching write-strategies card already asks for that sentence. When it comes due, say that sentence first. If the card is not due, you may open it once as a spoken drill, rate it honestly, and let FSRS put it back on the calendar. Do not open it every night. That is cramming, and the [spacing post](/blog/spaced-repetition-for-system-design) is the case against burning the gap.

If the hole is assembly, not a fact, do not make a card for it. "I never asked about scale" is a clock fault. Put a five-minute alarm in the next mock. "I drew for twenty minutes" is a clock fault. The weekday queue will not fix it.

If the hole is a topic the bank does not cover, write one card. Prompt in the interviewer's voice. Three to six key points you can tick. A public reference you have read. Vague points fail as soon as you try to tick them.

Schedule the next mock on a different prompt. A retry tomorrow measures memory of your own recording. A second prompt next weekend measures whether the missed sentences transferred. The [interview study guide](/blog/interview-study-guide) is the one-page list of topics that should transfer.

A month of weekday cards plus two solo recordings is a complete prep loop for the content you can control. A partner can replace the second solo if they will hold you to 45 minutes.

If you want the weekday half of this loop rather than another weekend, the [study page](/study) will give you the due queue and a limit on new cards. Run the mock when that queue has already taught you the stages.
