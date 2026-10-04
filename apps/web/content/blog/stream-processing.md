---
slug: stream-processing
title: Stream processing for system design interviews
description: Stream processing for system design interviews. Event time versus processing time, windows and watermarks, and when a join cannot wait for a batch.
primaryKeyword: stream processing
category: architecture
tags:
  - architecture
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the stream processing answer an interviewer wants. You compute on events as they arrive. You group them by the time the fact happened, not by the time your worker woke up. You join two streams inside a window because a nightly file is already too late. A queue you drain is a different tool. Each job there is done once and forgotten. The rest of this post is the two clocks, windows and watermarks, a join that cannot wait, that queue contrast, and a fraud or metrics job that needs the stream.

## Event time versus processing time

Event time is the timestamp on the fact. A phone recorded a click at 10:00:02. A card reader stamped a swipe when the chip answered. That clock belongs to the world you are measuring.

Processing time is the wall clock on the worker that saw the record. The same click can land at 10:04:18 because the phone was offline, the partition lagged, or a retry sat in a buffer. The worker's clock answers a different question. It tells you how late you are. It does not tell you when the click happened.

Name both clocks before you name a product. If you bucket by processing time, the 10:00 minute loses a real click and the 10:04 minute gains a stranger. A restart makes the lie worse. Every replayed record looks new. History collapses into "now".

Say the line out loud. "I window on event time. Processing time is how late this job is." The interviewer is waiting for that sentence.

| Clock | What it answers | What breaks if you use the other one |
| --- | --- | --- |
| Event time | When the fact happened | A late upload lands in the wrong minute |
| Processing time | When this job saw the record | A restart rewrites history into now |

The phone that uploads at 10:04 still belongs in the 10:00 window if you care about clicks as users experienced them. A dashboard that only asks how many records arrived in the last minute can use processing time. That dashboard is about the pipeline. Say which question you are answering. Ask how late a source can be. Allowed lateness is a product choice, not a property of the engine.

## Windows, watermarks, and late data

A window is a slice of event time you aggregate over. Three shapes cover almost every prompt.

A tumbling window is adjacent and does not overlap. Clicks per campaign per minute is a tumbling window.

A sliding window overlaps. Width is five minutes. Slide is one minute. Fraud scores that want "the last five minutes, refreshed every minute" are sliding windows.

A session window closes after a gap of inactivity. The next event opens a new one. The data picks the bounds.

You cannot close a window the instant the clock reaches its end. Late events exist. The engine needs a guess that "I will not see events older than T." That guess is the watermark. It is not a promise. It is a heuristic you publish as events arrive, usually from the maximum event time you have seen minus some allowed lateness.

When the watermark passes the end of a window, the job emits the result and may drop the state. An event that arrives after that is late data. You pick a policy before you draw the box.

Drop it. The count stays at what you already emitted. The late click is gone from that minute.

Send it to a side output. A human or a second job can decide. The main stream stays clean.

Update the result. Emit a correction. Downstream has to tolerate a second value for the same window. A dashboard can overwrite. A billing total that already charged a customer cannot.

Say the policy. "I allow two minutes of lateness. After the watermark I send late clicks to a side stream. The minute count does not move." That is an answer. "The framework handles it" is not.

State size is the cost you should name next. A five-minute sliding window keyed by user holds five minutes of events per user, or a compact aggregate if the function allows it. Cardinality times width times per-event bytes is the envelope. [Back-of-the-envelope estimation for system design](/blog/back-of-the-envelope-estimation) is the arithmetic. A million active keys and a wide window is a memory problem, not a syntax problem.

Watermarks also stall. One slow partition holds the watermark back if you take the minimum across sources. Idle sources need a timeout or the whole job waits. Mention that when the interviewer asks why a window has not closed. The missing partition is a common reason.

## A join that cannot wait for the batch

A join is the reason people reach for a stream. An impression and a click share an id. A swipe and a device ping share a card. A nightly batch can join them after both files land. The product cannot wait until morning.

Walk one pair. An ad impression happens at 10:00:01. The click, if it happens, should arrive within a few minutes. You keep impressions in state keyed by impression id, for a window you named. A click looks up that id. A match emits a joined record. An impression that never gets a click expires when the window ends.

That is a stream-stream join. Both sides are unbounded. Both sides need a window. Without a window the state grows forever. You are waiting for a mate that may never come.

A stream-table join is enrichment. Each swipe looks up the current device record, or the current account flag. The table is a slowly changing copy you maintain from another stream. The swipe does not wait for a matching event. It waits for a key in the table. If the table is stale, the join is stale. Say that.

The batch version waits until both files are closed, then sorts or hashes. That is fine when the answer can wait and you do not want join state in the job.

A concrete sketch keeps the board honest.

```
impression { id: imp_9, campaign: c1, event_time: 10:00:01 }
click       { id: imp_9, user: u2,    event_time: 10:01:12 }
```

The join window is four minutes on event time. The click finds `imp_9`. You emit `{ campaign: c1, user: u2 }`. A click at 10:08:00 is late for that impression. The watermark has passed. You apply the late policy you already named.

The job can die after it wrote the join and before it advanced the offset. A replay joins again. The sink has to be idempotent. If both records already live in one database and a query can wait, you need a table, not this join.

## Stream versus a queue you drain

[Message queues for system design interviews](/blog/message-queues-for-interviews) cover the tool people confuse with a stream. A queue is a to-do list. A producer writes a job. One consumer takes it. An acknowledgement deletes it. The next worker never sees that job. Thumbnail resize, receipt email, and webhook delivery belong there. Each unit of work should happen once and then disappear.

A stream sits on a log. Records are appended. They stay for a retention period. Each consumer group tracks its own offset. Billing, search, and a fraud job can read the same clicks. Any of them can rewind. Order holds inside a partition. Across partitions there is no global order.

Stream processing is computation on that log. You are not draining a to-do list. You are folding events into windows, joins, and running aggregates, and you may read the same events again after a bug fix.

Use a table when the interviewer asks you to pick.

| Need | Queue you drain | Stream you process |
| --- | --- | --- |
| One job, one worker, then forget | Yes | Awkward |
| Many independent readers of the same events | Fan-out copies | Native |
| Replay after a bad deploy | Usually gone | Rewind the offset |
| Count, join, or score over event time | You would rebuild it | This is the job |
| Per-message routing and delay | Natural | Extra work |

A growing queue depth means workers are behind. A growing stream lag means the job is behind. The signal looks similar. The recovery is not. You add queue consumers to drain faster. You add stream parallelism up to the partition count, and you accept that a single hot key still lands on one worker.

If the prompt is "send this email when the user signs up," draw a queue. If the prompt is "count signups per minute and flag a device that signed up three times in ten minutes," draw a stream. Mixing the words is the usual miss.

## A fraud or metrics job that needs it

Two prompts make the tool obvious. Walk one of them to the end.

A card swipe arrives. You must score it against the last few minutes of swipes for that card, and against a device record, before you approve. A nightly batch tells you tomorrow that last night was bad. The merchant already fulfilled the order. The window is sliding. The key is the card. The join to the device record is a stream-table lookup. Late swipes still matter if they change the score of an open decision. They do not matter if you already approved and the money moved. Say which.

State is per card. Width times swipe size times active cards is the memory. You compact to counts and last locations when the raw events are not required. A hot card is a hot key. All of its swipes hit one partition. You cannot spread one card across workers without breaking the window. Name that limit.

A metrics job is the calmer twin. Each request emits `{ endpoint, status, event_time }`. You tumble by minute and emit a count per endpoint. A dashboard reads those minutes. Allowed lateness is short because a late request is usually a late client, not a late truth you must correct. Dropping late samples is acceptable for a graph. It is not acceptable if the same stream later bills by request.

Inserting every swipe and running a count at read time is a design. It is not stream processing. Leave it when the read cannot scan, or when the decision has to happen on the write path.

Keep the order of the answer straight.

1. Name the event and its event-time field.
2. Name the window and the key.
3. Name the watermark and the late-data policy.
4. Say whether the join is stream-stream or stream-table.
5. Contrast a queue you would have used if the work was a single job to forget.
6. Size the state from keys, width, and bytes.

You can recognise the words tumbling and watermark. In the room you still say "Kafka" before you say which clock you window on. Speak the clock and the window before the product name.

Drill the queue-versus-log split on the [fundamentals study page](/study/fundamentals) until you can pick a drain or a stream without naming a broker first. Then keep going on the [study page](/study).
