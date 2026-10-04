---
slug: backpressure
title: Backpressure in system design interviews
description: Backpressure in system design interviews. Slow consumers, bounded queues, drop versus block, and how you apply it across a network hop.
primaryKeyword: backpressure
category: traffic-and-reliability
tags:
  - messaging
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the backpressure answer an interviewer wants. A fast producer will fill any path that a slow consumer cannot drain. You bound the path so that extra work is refused, delayed, or sampled, instead of sitting in memory until the process dies. You say which of those three you chose and what the user sees. You say how the signal crosses a network hop. The rest of this post is the mismatch, the bound, the three refusals, the hop, and a metrics pipeline that uses all of them.

## Slow consumer, fast producer

Backpressure is the signal a slow consumer sends so a fast producer stops, slows, or throws work away. Without that signal the producer keeps creating. The extra items live in a buffer you did not mean to grow. Memory rises. Latency rises. Eventually the process is killed, or the disk fills, or the next hop times out as a crowd.

The mismatch is ordinary. A web handler accepts uploads faster than a thumbnail worker can resize them. A checkout writes receipt emails faster than the mail provider accepts them. An agent emits metrics faster than the time-series store can ingest them. In each case the producer can still succeed at its own job while the consumer is behind. That local success is what hides the problem until the buffer is the problem.

Name the producer, the consumer, and the buffer between them. If you cannot point at the buffer, you do not yet have a backpressure story. A synchronous call has a buffer of in-flight requests on the caller. A queue has a buffer of messages. A log has a buffer of unconsumed offsets. A UDP socket has a tiny kernel buffer and then drops. The shape changes. The question does not. What happens when the buffer is full.

[Message queues for system design interviews](/blog/message-queues-for-interviews) is the decoupling post. A queue lets the producer finish without waiting for the slow work. That is the gain. Backpressure is what you add so the gain does not become an unbounded pile. The two posts are a pair. The queue without a bound is a delayed crash. The bound without a policy is just an error you have not named.

A slow consumer is not always a bug. Batch jobs are slower than interactive writes on purpose. The interview is not "make the consumer as fast as the producer". It is "keep the producer from destroying the consumer, and keep the buffer from destroying the box".

Do not use backpressure as a synonym for rate limiting. A limiter caps one client against a budget you chose. Backpressure caps the producer against the consumer's actual drain rate.

## Bounded queues and what they refuse

A bound is a maximum number of items, bytes, or in-flight calls. When the count hits the maximum, the next enqueue is not accepted as normal success. That refusal is the mechanism. An unbounded queue has no such moment. It accepts until memory is gone. "We will add a queue" is not a complete answer. "The queue holds N, and then we refuse" is.

Choose the unit. Messages if they are similar in size. Bytes if a single large payload can fill a count-based queue by itself. In-flight calls if the buffer is a thread pool or a connection pool. Mixing units without saying so is how a "1000 message" queue still eats the heap.

The bound is visible in three places. The producer sees a failure, a block, or a slower ack. The operator sees a full-queue metric and a reject count. The consumer sees a queue that can actually drain, because it cannot grow past N. If only the consumer is happier and the producer still thinks every send succeeded, you stored the overflow somewhere else. Find that somewhere.

Small worked bound. A thumbnail queue holds 500 jobs. Each job is a pointer to an object, not the bytes. A worker takes 200 ms per image, and you run 10 workers. Drain rate is about 50 jobs a second. A burst of 2000 uploads in one second cannot sit in this queue. 500 are accepted. 1500 must be refused, blocked, or spilled to a larger store you have actually provisioned. Those figures are for the board. They are not a measurement of a product. Change the drain rate and the bound has to change with it.

A bound of one is still a bound. A hand-off with a single slot is backpressure. Add slots until you have the burst you are willing to hold.

Do not hide an unbounded retry list behind the queue. A failed consumer that puts the item back without a cap rebuilds the pile. [The message queues card](/cards/message-queues-basics) is the delivery-guarantee neighbour. This post owns the size.

## Drop, sample, or block

When the bound is hit you have three honest moves. Drop the item. Sample so some items still flow. Block the producer until a slot opens. Each move has a user-visible consequence. Say it.

Drop means the item is gone. Use it when a missed item is better than a late one, and better than stalling the producer. Metrics, traces, debug logs, and expired ads sit here. The user is not waiting on that one point. A dropped payment intent does not sit here.

Sample means you keep a fraction or a representative set. Count every event. Store one in N. Or keep a reservoir so a dashboard still has a shape. Sampling is how you refuse volume without refusing the existence of the stream. It is still a drop of the items you did not keep. Say the count still increments.

Block means the producer waits. The wait is the signal. A thread that cannot enqueue sits on the call. A socket that cannot write waits for window space. Blocking is the right move when losing the item is worse than making the producer slow. A checkout that cannot record the order should not drop the order. It should stop accepting checkouts, or wait on a durable append.

| Move | What happens to the item | What the producer sees | Fits |
| --- | --- | --- | --- |
| Drop | Gone | Success or a drop ack, no wait | Lossy telemetry |
| Sample | Some gone, counts kept | Usually success | High-volume metrics |
| Block | Held until a slot exists | The call waits or times out | Durable business writes |

"Spill to disk" is a larger bound, not a policy. Disk fills too. Give the spill its own refuse rule.

[Rate limiting for system design interviews](/blog/rate-limiting-for-interviews) can sit in front so one client cannot fill the bound alone. The limiter is fairness. The bound is safety. A fair client can still lose if every fair client arrives at once.

Timeouts belong with block. A producer that blocks forever pins a worker. Block up to a deadline, then return an error. That error is backpressure crossing an API. It is not a drop you hid inside a `200`.

## Backpressure across a network hop

Inside one process, a full blocking queue is a function return or a wait. Across a network, the consumer cannot touch the producer's memory. The signal has to become a message, a window, or a status code.

TCP already does this. A receiver advertises a window. A sender that has used the window stops. Application-level queues that sit above TCP can still grow without reading. If you read the socket into an unbounded list, you have defeated the window. Read at the rate you can handle. Let the window close.

HTTP can carry the signal. `429` says this caller should slow down. `503` with a retry hint says the service cannot take more work now. Both are refusals. Document which one you return for a full queue versus a per-key limit. A client that retries a `503` without jitter becomes the next storm. The callee must still bound what it accepts while those retries arrive.

A broker can refuse a publish. The producer gets an error. That is the honest block or drop at the edge of the queue. A broker that accepts and then throws the message away because an internal buffer filled is a silent drop. Prefer the refuse at the publish.

Streaming RPCs can grant credits the same way. When credits are zero, the producer stops. If you ignore them and buffer in user space, you are back to an unbounded list.

A fast hop with a slow consumer still needs a bound on the consumer side. The network only moves the items.

Load shedding is backpressure at the front door. The service refuses new requests when in-flight work is at a cap. Name that cap in outstanding requests.

## A metrics pipeline that applies it

A metrics pipeline is the cleanest drawing because loss is usually allowed and volume is usually high. Walk it hop by hop so each bound has a policy.

Agents on the machines emit points. Each agent has a ring of N points. When the ring is full, the agent samples. It keeps the count of points it could not keep. The product on that machine does not block. A checkout thread does not wait on a full metrics ring. That is drop or sample at the source. Blocking here would couple a dashboard to a purchase.

Agents send batches to an aggregator. The outbound socket uses TCP. If the aggregator is slow, the window closes and the agent stops sending. The ring then fills. Sampling increases. The signal moved from the aggregator to the agent without a custom protocol. If the agent instead spilled to an unbounded disk log, the disk becomes the new crash.

The aggregator has a bounded queue per tenant. A noisy tenant hits the bound and is sampled harder. Other tenants keep their share. That is fairness plus a bound. A single shared unbounded queue lets one tenant push everyone else out.

The aggregator writes to a store. When the write queue is full, it blocks up to a deadline, then drops the batch and increments a lost-batch counter. A lost batch is visible. It is not a silent `200`.

A board sketch. Agent ring of 10,000 points. Aggregator queue of 50,000. Store ingest you treat as 20,000 points a second. If agents emit 80,000 in a burst, the rings sample. The aggregator never sees 80,000 at once. The numbers are for arithmetic. Each hop names a bound and a refuse rule.

What you say in the room.

1. A fast producer and a slow consumer need a signal, not a hope.
2. Bound the buffer in items, bytes, or in-flight calls.
3. Full means drop, sample, or block. Name the user-visible result.
4. Across a hop, use a window, a refused publish, or a `429` / `503`.
5. Do not read a flow-controlled socket into an unbounded list.
6. A metrics pipeline samples at the agent and never blocks the product path.

Drill the queue and timeout cards, then say the bound out loud on every pipeline you draw. Start on the [fundamentals study page](/study/fundamentals).
