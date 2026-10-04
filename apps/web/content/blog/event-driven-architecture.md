---
slug: event-driven-architecture
title: Event driven architecture for interviews
description: Event driven architecture for interviews. Facts that already happened, consumers you can add later, and when a request-response call is clearer.
primaryKeyword: event driven architecture
category: architecture
tags:
  - architecture
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the event driven architecture answer an interviewer wants. An event is a fact that already happened, named in the past tense, immutable once written. Producers do not know the full list of consumers. You can add a consumer without a meeting with every producer. You take on ordering, duplicates, and a log you can replay. A request-response call is still clearer when the caller needs the outcome in the same turn. A feed fan-out or a notification path is the drawing that shows the style. That is the whole shift. The rest of this post is the fact, the extra consumer, the log, the cases you should not force, and one path you can walk on a board.

## A fact that already happened

An event is not a job and it is not a request. `OrderPlaced` means an order was committed. `PaymentCaptured` means money moved. `UserFollowed` means the follow row exists. The name is past tense on purpose. The producer already changed its own store. The event reports that fact.

A command is the opposite direction. `PlaceOrder` asks a service to do work. The service may refuse. An event does not ask. It notifies. If you find yourself waiting for a subscriber to approve the write, you have drawn a hidden request. Pull that call back into the write path.

The payload is the fact plus enough identifiers to fetch the rest. An order id, a customer id, a total, a time. Avoid a giant snapshot if consumers only need the id. Avoid an id with no way to load the body if every consumer will immediately read you back. Stable fields beat a schema you rewrite every week.

Once written, the event is not edited. A correction is a new event. `OrderCancelled` does not erase `OrderPlaced`. Readers that care apply both. That rule is how late consumers, and future you, can replay without guessing.

The producer writes the fact and the event together. The outbox pattern is the usual glue. The order row and the outbox row commit in one database transaction. A publisher reads the outbox and appends to the log or the queue. A crash after the commit and before the publish retries. Consumers then see a duplicate. They must tolerate it. A crash that writes the event but not the order is the failure you designed away by sharing the transaction.

Do not let the publisher be a second writer of the order. The order service is the source of the fact. The bus carries a copy.

## Consumers you can add without a meeting

The point of the style is a consumer that did not exist at launch. Search needs `OrderPlaced` to index a purchase history. Analytics needs it for a daily rollup. Email needs it for a receipt. Fraud needs it for a score. None of those should sit inside the checkout request if checkout can return without them.

A new consumer subscribes. The producer stays the same. That is the meeting you skip. The cost you accept is a contract you now treat as public. A field you remove will break a reader you have never met. Version the event. Add fields. Run a v2 alongside v1 until the last reader moves.

Fan-out is native on a log. Several consumer groups read the same `orders` topic at their own offsets. A queue can fan out too, with a copy per subscriber or a pub-sub exchange. [Message queues for system design interviews](/blog/message-queues-for-interviews) is the neighbouring choice. Use a queue when each message is a job that should be done once and forgotten. Use a log when several teams read the same history and may replay.

Independence has a limit. If the new consumer must reject the order, it is not a consumer. It is a participant in the write. Put it on the request path, or make the order pending until that service votes. Quietly turning a receipt worker into a veto is how event driven designs rot.

Slow consumers are expected. The producer has moved on. The receipt can land a minute later. The index can lag. Product copy has to tell the truth. "We are sending your receipt" is honest. "Your receipt is in your inbox" is a lie if the worker is down.

A consumer should own its own store. It projects the events it cares about into tables it can query. It does not join live into the producer's database. That join is a meeting you just reintroduced, this time at query time.

## Ordering, duplicates, and the log

Three properties show up on every board. Say what you have. Say what you do not.

Ordering is per partition, not global. Events for one order id land in one partition if you key the partition on that id. Those events stay in append order. Events for two orders can interleave any way they like. If a consumer needs "all of customer 17 in order," key on customer 17 and accept that one hot customer is one hot partition.

Duplicates happen because publish and consume are at-least-once. The publisher retries. The consumer crashes after the write and before the ack. The same `OrderPlaced` arrives twice. The consumer keys its work on the event id or on the order id. The second call is a no-op. If the work is "send a receipt," an idempotency row on the event id is the store. If the work is "set status to placed," an upsert is enough.

A log retains. Consumers track an offset. A new consumer can start at the oldest retained event and build a store from scratch. A broken projection can rewind. That is why a log, not a queue, is the backbone for change data, for search indexers, and for event sourcing. A queue deletes the message after one ack. There is no history to replay. The [queue versus log card](/cards/queue-vs-log) is the short version of that split.

| Need | Prefer | Why |
| --- | --- | --- |
| Receipt, thumbnail, webhook | Queue | One worker, then forgotten |
| Search, analytics, audit, new readers | Log | Many groups, replay |
| Order of one aggregate | Log, key on that id | Partition order |
| Global order of every event | Neither, honestly | You do not have it |

Retention is a number you name. A week of events lets you rebuild a projection if you also have a snapshot. Forever is a product decision, not a default. Disk is not free. Privacy deletions become new events and a scrub of retained payloads.

A consumer that is slow for an hour is a lag metric, not a lost fact, if the log still holds the events. A queue with a growing depth is the same signal for jobs. Page both. A silent consumer is an outage the producer cannot see from its own success rate.

## When a request-response call is clearer

Event driven architecture is a tool. It is a poor default for a question that needs an answer now.

Reserve inventory and return the leftover count in the same checkout click. That is a request. The caller must know whether the reserve held. Publishing `ReserveInventory` and hoping a later `InventoryReserved` arrives before the HTTP timeout is a request you disguised as an event. The disguise adds a bus, a race, and no extra independence.

Read your own write on the next line of the handler. That is a request, or a read of the store you just wrote. Do not bounce through a consumer to learn whether your commit landed.

A validation that can reject the write belongs before the commit. Coupon rules, a fraud hard-stop, a credit check that must pass. Those are calls, or local checks. After `OrderPlaced` exists, you can only compensate. Compensation is a different product than a 400.

User-facing errors should name a service you can still see in the stack. "Payment declined" comes from payments in the request path, or from a pending order you later mark failed. Hiding the decline inside a worker the user cannot see is how you get a success page and a charge that never happened.

Chatty event chains are a smell. Service A emits. B reacts and emits. C reacts and emits. A then reacts to C. You have a distributed callback that you cannot step through. Collapse the part that must agree into one service, or into an orchestrated workflow with a single timeout you can point at.

Use events to notify and to project. Use a call when the caller cannot continue without the result. Many good drawings mix them. Checkout calls payments. Checkout writes `OrderPlaced`. Email and search listen. The mix is the answer, not a purity test.

## A feed or a notification path that is event-driven

A news feed is the worked path. A user publishes a post. The post service writes the post. The post service emits `PostPublished`. Fan-out workers read the author's follower list and insert the post id into each follower's feed list. The read path loads one list. The publisher of the post does not wait for a million inserts.

[Design news feed for the interview](/blog/design-news-feed) is that design. The event is what lets the write return. Workers are consumers you can scale without changing the post API. A celebrity author is a consumer policy, not a new event type: skip the push and let the read path pull.

A notification path is the other drawing. `OrderPlaced` lands on a log. A preference service already projected who wants email, who wants push, and who is in quiet hours. Workers per channel send. Dedup keys on the order id plus the channel. A new channel is a new consumer group. The order service does not learn Slack's API.

```text
Post service --PostPublished--> log
                                |-> fan-out workers -> per-user feed lists
                                |-> notification workers -> push / email
                                '-> search indexer -> posts index
```

The three readers fail independently. Search can be down. The feed lists still fill. The notification worker can retry without blocking publish. That isolation is the reason you drew events.

Walk one failure. The fan-out worker dies after 40 of 200 follower inserts. The event is not acked. It returns. The worker continues from a cursor it stored per event, or it upserts each insert so the second pass is safe. The last 160 followers get the id. The first 40 see the same id twice and ignore it. You do not re-publish from the post service. The log still has the fact.

Keep the order straight.

1. Name a past-tense fact and the store that committed it.
2. Add a consumer without changing the producer.
3. Say partition order, at-least-once, and replay.
4. Keep request-response for the outcome the caller needs now.
5. Draw a feed or a notification path, and one crashed worker.

You can name Kafka and still emit commands into a topic. Speak the fact first. Speak the consumer second.

Start on the [fundamentals study page](/study/fundamentals).
