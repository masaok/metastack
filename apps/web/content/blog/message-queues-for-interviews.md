---
slug: message-queues-for-interviews
title: Message queues for system design interviews
description: Message queues for system design interviews. What a queue is for, how it differs from a log, and which delivery guarantee you should claim.
primaryKeyword: message queues
secondaryKeywords:
  - pub sub
  - delivery guarantees
tags:
  - fundamentals
  - distributed-systems
author: Masao Kitamura
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

Message queues let a producer finish without waiting for the slow work. The consumer does that work later. You still have to say what happens if the consumer dies mid-job. A crash after a successful write and a lost acknowledgement look the same to the sender.

## What a message queue is for

A synchronous call couples two services in time. The caller waits for the callee. A slow callee makes the caller slow. A down callee fails the caller. [The message queues card](/cards/message-queues-basics) opens on that coupling and on the costs a queue adds.

A queue changes the contract. The producer writes a message. The producer then moves on. A consumer reads the message when it can.

Put a queue on an edge the caller can leave before the work finishes. The work may be slow. The arrivals may come in bursts. Say which reason applies before you name a broker.

Temporal decoupling is the first gain. The consumer can be deploying, restarting, or slower than the producer. The send does not require the consumer to be up.

Load levelling is the second gain. A checkout spike can produce 10,000 receipt messages in a minute. Email workers can drain them at 500 a minute. Checkout returns without sitting inside the email send.

Independent scaling is the third gain. You add consumers to drain faster. The producer program stays the same.

Retries with backoff, a dead-letter queue for poison messages, and fan-out live beside the queue. The producer stays unchanged.

## What you take on

The caller no longer learns the outcome in the response. The product has to show completion later. A status field, a notification, or polling can carry it. Name the one the client uses.

Most queues retry until a consumer acknowledges the message. That policy is at-least-once. A lost acknowledgement can deliver a duplicate. The consumer has to tolerate the second copy. Order usually holds inside one queue, or inside one partition of a log.

Queue depth and consumer lag become the health signals. A growing backlog is a silent outage. The producer can still return success while the work waits. The broker is now a critical dependency. It has to stay available. It has to retain messages through a long consumer outage.

## An upload that enqueues a thumbnail

A user uploads a photo. The API writes the original file. The API then enqueues a thumbnail job for that file. The API returns. The resize runs later.

Image resizing is a queue job, in the same group as email sending and webhook delivery. [The queue versus log card](/cards/queue-vs-log) is where that split is spelled out. Each of those jobs should be done once and then forgotten.

The original lands at `images/42/original`. The job body is the id `42`. A worker reads the original. It writes `images/42/thumb`. It acknowledges. The image row moves from preparing to ready. That status is how the user learns the thumbnail exists.

Kill the worker during the resize, before the acknowledgement. The broker still treats the job as open. The object at `images/42/thumb` might be missing, half written, or complete. The sender can see only the missing acknowledgement.

The API can die in an earlier gap. The file write has finished. The enqueue has not. The original sits with no job. A transactional outbox covers this when the upload decision lives in a database. Write the image row and an outbox row in one transaction. A publisher reads the outbox and enqueues. A crash in the publisher sends the job again. The worker then sees a duplicate. The blob store and the broker usually sit outside that database transaction. The outbox binds the row to the intent to publish.

## At-most-once, at-least-once, and exactly-once

[The delivery guarantees card](/cards/delivery-guarantees) names the three claims. Hang each claim on the thumbnail crash.

**At-most-once.** Send the job and do not retry. A lost message stays lost. A second copy does not arrive. Acknowledging before the resize reaches the same place. The worker acknowledges. It then dies during the write. The broker has nothing left to redeliver. The thumbnail can vanish. The next message replaces a lost one. A metrics sample or a presence ping can accept that loss. A thumbnail someone is waiting on is a bad fit for this claim.

**At-least-once.** Retry until an acknowledgement arrives. Acknowledge only after the thumbnail write succeeds. A lost ack is indistinguishable from a lost job. The job returns. The thumbnail gets written. The lost piece was the acknowledgement. A second write can happen. SQS, Kafka consumers, and most RPC retry policies default to this. Expect duplicates.

**Exactly-once.** The words say every job is processed once and only once. True exactly-once delivery is impossible across an unreliable network. The worker can finish the thumbnail and crash before the ack. That looks like a message that never arrived. A retry can duplicate the job. Skipping the retry can drop the only copy.

## What a retry and an idempotent consumer keep

Retry until the broker acknowledges the job. Delivery stays at-least-once. A duplicate after a timeout is allowed.

Exactly-once processing is the claim you can keep. The message may arrive more than once. The effect happens once.

The thumbnail write is absolute. Every attempt stores bytes at `images/42/thumb`. The second write replaces the first. Setting a balance to 100 twice leaves 100. Adding 10 on each delivery changes the balance again. Prefer an overwrite or an upsert when a replay must leave the same result.

A conditional write covers a row that a blind replace would damage. Update it only where the version is still the version you read. The replay fails. The row stays put.

Jobs that are not overwrites need an idempotency key. The producer attaches a unique id. The consumer records processed ids and skips a repeat. Stripe's API is this pattern. Store the ids with a TTL that outlasts redelivery. Name the store and the duration when you are asked. The thumbnail key is enough for the resize. A ready email needs the id table.

Kafka transactions commit new records and input offsets together. Inside that consume-and-produce loop, each input counts once. A thumbnail put to object storage sits outside the promise.

The upload you can defend uses the retry and the idempotent consumer together. The API retries the enqueue until the broker accepts the job. A repeat overwrites `images/42/thumb`. A consumer that stores job ids skips one it has already finished. The acknowledgement comes after that write or that skip. You kept at-least-once delivery. You kept exactly-once processing. Exactly-once delivery was not the promise.

## A queue versus a log

Both move a message from a producer to consumers later. They split on the fate of a message after it is read.

A traditional queue delivers the message to one consumer. It deletes the message after the acknowledgement. Competing consumers share the queue. One worker takes the job. The broker then drops it. RabbitMQ, SQS, and ActiveMQ are this family. Routing rules, priorities, a per-message time to live, and delayed delivery come with them. The mental model is a to-do list.

A distributed log appends to a partitioned log and retains records for a configured period, from hours to forever. Each consumer group stores its own offset. The record stays. Kafka, Kinesis, Pulsar, and Redpanda are this family. Billing, a search indexer, and a fraud model can each read the same stream at their own pace. Any group can rewind and reprocess. Order holds inside a partition. Throughput scales with partitions. The log is built for very high throughput. A queue is a hard fit for that volume.

| Need | Queue | Log |
| --- | --- | --- |
| A background job done once, then forgotten | The natural fit | Awkward |
| Several teams reading the same events | A copy on a queue per team | One topic, many consumer groups |
| Replay of last week | Removed when acknowledged | Rewind an offset during retention |
| Strict order for one key | Inside that queue | Inside the key's partition |
| Very high throughput | Hard | What the log is built for |
| Delay or priority on one message | Supported | Absent |

Choose a queue for image resizing, email, and webhook delivery. The thumbnail is image resizing. Choose a log when analytics, search, notifications, and an audit trail must read the same events and replay them. Many systems use both. The log is the durable history. Queues are work buffers in front of specific workers.

A consumer that stalls for an hour shows the split. Unacknowledged queue jobs pile up. The broker has to hold them. On a log, that group's offset lags. Other groups keep reading. The slow group catches up while retention still has the records.

A queue distributes work. A log shares a durable history. Replay and many readers are why a log backs event sourcing, change data capture, and stream processing.

## Where pub sub copies the message

A queue gives the thumbnail job to one consumer group. Workers in the group compete. One of them takes the job and acknowledges it. The broker then deletes the message.

Pub sub is the other contract. Many subscribers each get a copy. The upload event can reach a thumbnail worker, a search indexer, and an audit writer. Each subscriber has its own success or failure. A broken indexer leaves the thumbnail copy alone.

A queue broker fans out by copying the message onto one queue per subscriber. Each copy then has its own competing workers, its own retries, and its own dead-letter queue. The producer still publishes a single message.

A log gives every consumer group the full stream from one topic. Each group keeps an offset and can replay inside the retention window.

Use one consumer group when the job should be done once and forgotten. Use pub sub when each subscriber must see the event. Put the shared events on a log when replay matters.

## What to say in the interview

Open with why this edge is async. The upload response can leave before the thumbnail exists. The resize is the slow part. Then the steps. The handler writes the file. It enqueues the job. It returns. Then the crash. If the worker dies mid-job, name the guarantee you mean.

Two consequences follow. The consumer is idempotent. The user can learn when the thumbnail is ready, by a status field, a notification, or polling.

**Dead-letter queue.** A message that still fails after retries with backoff moves to a dead-letter queue. You inspect it there. The producer stays unchanged. The retry limit is a parameter you choose.

**Ack before the work.** An early ack plus a crash during the resize drops the job. That is at-most-once. Ack after the write when you mean at-least-once.

**Ids, a stall, and partitions.** Store processed ids with a TTL past redelivery. An hour of queue stall is depth the broker must hold. An hour of log stall is one lagging offset. The partition count limits parallelism on a log. Order stays inside the partition.

Close on the tool. Use a queue for the thumbnail. Use a log for history several teams replay. Use pub sub when each subscriber needs a copy.

## Drill until you can name the guarantee

Recognition is the failure mode. You nod at the three names. Two weeks later you promise exactly-once delivery because it sounds strict. Say the answer before you reveal the card.

[System design interview flashcards that actually stick](/blog/system-design-interview-flashcards) is the grading loop. You speak, then you tick the points you actually said. [Spaced repetition for system design](/blog/spaced-repetition-for-system-design) is why a missed guarantee should come back tomorrow.

Three prompts on the fundamentals deck are this post.

The message queues prompt asks why you would put a message queue between two services, and what problems it introduces. Cover decoupling in time and availability, the burst buffer, fan-out with retries and a dead-letter path, the missing immediate result, and the operational load of ordering, duplicates, backlog alerts, and the broker.

The delivery prompt asks you to explain at-most-once, at-least-once, and exactly-once, why exactly-once is hard, and how systems approximate it. Retry until acknowledgement, overwrite the same thumbnail or skip a stored job id, and name how long those ids live. A broker that "guarantees exactly once" is the miss.

The queue versus log prompt asks you to compare a traditional queue such as RabbitMQ or SQS with a distributed log such as Kafka or Kinesis, and when you want each. A queue distributes work. A log shares a durable history. The thumbnail is the queue. The event several teams replay is the log.

Drill until you can name the guarantee you mean. The cards are on the [fundamentals study page](/study/fundamentals).

[Start drilling](/study/fundamentals).
