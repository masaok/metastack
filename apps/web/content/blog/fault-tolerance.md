---
slug: fault-tolerance
title: Fault tolerance for system design interviews
description: Fault tolerance for system design interviews. Name the fault first, then retries, isolation, bulkheads, and a store or queue that can lose a node.
primaryKeyword: fault tolerance
category: consensus-and-coordination
tags:
  - availability
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Fault tolerance in a system design interview is the set of faults you named, plus the behaviour that remains useful when each one happens. It is not a synonym for "we replicate everything", and it is not a circuit-breaker logo on every arrow. The interviewer is checking that you can pick one fault, say what the user sees, and show a limit that stops that fault from taking the rest of the product with it. This post starts with the fault you name first, then retries and isolation, bulkheads against a noisy neighbour, degradation that is still a product, and a store or a queue that can lose a node.

## The fault you name first

Start with a single failure, spoken as a sentence. "This API process dies." "This zone loses power." "This dependency hangs for two seconds on every call." "This disk fills." "This primary is paused for a long garbage-collection stop." Those are different designs. A process death is answered by another process and a load balancer that has already dropped the dead one. A hang is answered by a timeout. A full disk is answered by a bound, an alert, and a path that can still read. If you jump to "the system is fault tolerant" before you name the fault, you are decorating the diagram.

Across a network you only ever see silence. A crashed node, a node in a long pause, a congested link, and your own broken NIC produce the same missing packet. Heartbeats turn silence into a suspicion after N missed beats. The timeout is a tradeoff, not a proof. A short timeout failovers fast and also failovers on a slow-but-alive node. A long timeout waits out a real death. Adaptive detectors stretch the threshold when heartbeat jitter is usually large and tighten it when the line is quiet. Say that you cannot tell slow from dead, that you pick a timeout anyway, and that the rest of the design stays safe when the detector is wrong.

Wrong is the dangerous case. You declare a leader dead and promote another. The old leader was only paused. It wakes and still believes it leads. Two writers. Protect that with a lease that expires unless it is renewed, and with a fencing token that storage checks so a stale leader's writes are rejected. Failure detection without fencing is an invitation to split brain.

Name the blast radius next. Process, host, zone, region, dependency, tenant. The first fault should be the one the SLO has to survive. A shortener can lose a process. A chat product has to say what happens when a zone disappears. Do not draw three regions and keep a single primary.

## Retry, timeout, and isolation

A retry absorbs a blip. A retry without a timeout pins a thread. A retry on a non-idempotent write doubles a charge. A retry from every client at once keeps a struggling dependency down. The [retries, timeouts, and backoff card](/cards/retries-timeouts-and-backoff) is the checklist. In the room you still have to say the pieces in an order that sounds like a design, not a list.

Timeout first. Every outbound call has an explicit deadline derived from the caller's own budget. If the endpoint promised 500 ms and 200 ms are gone, the downstream call gets at most 300 ms, and that remaining time is passed along. A call with no timeout is a fault you invented. It will hold a connection until the process restarts.

Retry only work that is safe to repeat, or that you made safe with an idempotency key. Retry only faults that look transient: connection reset, timeout, `502`, `503`, `504`, a throttle. Do not retry `400`, `401`, `403`, `404`, or `422`. Those answers will not change. Back off exponentially and add jitter so a thousand timed-out clients do not return as a single wave. Cap the retries with a budget, for example retries at most 10 percent of requests in a window, so a down dependency is not hit with three times the usual traffic. Retry at one layer. Three layers of three attempts turn one user request into twenty-seven dependency calls.

Isolation is the sibling of retry. A pool of threads, a pool of connections, a queue in front of a worker, a timeout: each one is a bound. When the bound is hit, you fail that call instead of borrowing from a neighbour. [Rate limiting for system design interviews](/blog/rate-limiting-for-interviews) is isolation at the front door. It stops one client, or one token-bucket key, from spending the whole fleet. The same idea inward is a per-dependency pool. The photo-thumbnail caller does not share a thread pool with the payment caller. A hung thumbnail dependency can exhaust its own pool. It cannot exhaust the process.

The sentence to say. "Timeouts on every call, retries only on idempotent transient faults, jittered backoff, a retry budget, and one layer that retries. Everything else fails fast."

## Bulkheads and the noisy neighbour

A bulkhead is a partition that stops water in one compartment from flooding the ship. In a service it is a limit that stops one class of work from taking the resources another class needs. Thread pools are the usual drawing. Connections, memory, disk, and cache keys are the same idea.

The noisy neighbour is the tenant, the request class, or the shard that consumes the shared thing. One customer uploads a huge export. One celebrity account is read by millions. One partition key is hotter than the rest. Without a bulkhead, that neighbour spends the CPU, the connection pool, or the cache, and everyone else times out. With a bulkhead, that neighbour hits its own ceiling. Everyone else keeps a smaller, reserved pool.

Draw the bulkhead on the resource that actually runs out. A per-tenant request rate is a bulkhead on admission. A per-tenant connection limit on the database is a bulkhead on the store. A separate cache cluster for the hottest key is a bulkhead on memory. A separate consumer group for low-priority jobs is a bulkhead on worker time. Saying "we will isolate noisy neighbours" without naming the resource is a slogan.

Put the tenant id on the bulkhead, not only on the log line. [Rate limiting for system design interviews](/blog/rate-limiting-for-interviews) already walked the bucket. Place one bucket per neighbour and a larger bucket for the fleet.

Inside one process, two pools do the same job. Search callers fill pool A. Billing still has pool B, so charges complete. That is a better outage than one shared pool. Pick the two resources the prompt will exhaust. Chat is often connections and the fan-out queue. A feed is often celebrity cache keys and the primary.

## Degradation that is still a product

Fault tolerance that only has "up" and "down" wastes most of the design. Many faults leave a smaller product that is still worth serving. Read-only mode when the writer cannot take writes. A feed of cached ids when ranking is down. Last-known presence when the presence service is silent. A static homepage when personalisation cannot load. The user still has a product. The alternative is a full error page because one optional box failed.

Name the core path and the optional path. The core path is what the SLO is about. For chat, send and receive of a 1:1 message is core. Read receipts and typing indicators are optional. For a news feed, loading a page of posts is core. Ranking, ads, and "people you may know" are optional. When the optional path fails, return the core path without it. When the core path fails, that is the outage.

Degradation has to be designed, not hoped. The feed service must be allowed to skip the ranker. The API must be allowed to return a stale cache entry and a header or a field that says so. The checkout must be allowed to refuse new orders and still show existing ones. If the code path cannot skip the dependency, the fallback does not exist. Saying "we degrade" on a call that throws when the client is null is fiction.

Honesty is part of the product. An empty feed looks like the user has no friends. A stale cached page marked stale is a product. A fake payment success is a lie. Degrade reads more freely than writes. Time-box the fallback: thirty seconds of stale cache is a shield, a day is a different product.

## A store or a queue that can lose a node

Stateless replicas are the easy half. The hard half is the thing that remembers. A store or a queue that cannot lose a node is a single point of failure with extra steps. The interview answer is a replication story plus a client story.

For a store, say how many copies, which writes wait for how many acknowledgements, and what a reader is allowed to see if one copy is gone. A primary and a synchronous replica can lose the primary if promotion is automatic and if the replica had every acknowledged write. A primary and an asynchronous replica can lose acknowledged writes on failover; say so. A quorum of three can lose one node and still take a majority write. Two remaining nodes out of three still overlap any previous majority of two, so a later majority read sees the write. Losing two of three loses the quorum. Draw three, not two, if the prompt is "survive one node".

For a queue, the same questions. Where does an unconsumed message live. How many brokers have a copy. What happens if the consumer dies after processing and before ack. [Message queues for system design interviews](/blog/message-queues-for-interviews) is the delivery-guarantee post. At-least-once plus an idempotent consumer is the usual pair that survives a worker death. At-most-once survives the worker by dropping the message. Exactly-once is a claim you should not make about the broker alone.

A lost broker is different from a lost consumer. Multiple brokers, a replicated topic or a mirrored queue, and a client that can reconnect to another broker are the node-loss story. A single-broker queue with ten consumers still dies when the broker dies. Draw the brokers. Then say how long a producer blocks when the remaining brokers cannot accept a write. That pause is the fault the producer has to tolerate: buffer, reject, or spill.

Worked shape. Three-node store, write majority, read majority. One node dies. Reads and writes continue on the other two. Three-broker queue, replication factor two. One broker dies. Messages that had a second copy remain. Producers reconnect. Consumers re-read unacked work. That is the whole answer: a named fault, a remaining copy, and a client that can find it.

The [fundamentals deck](/study/fundamentals) drills the pieces until they come out in that order. Retries, heartbeats, rate limits, and queues are separate cards. Fault tolerance is the habit of naming one fault and walking those cards against it. Start the deck before the loop. When the interviewer kills a node, you will already be pointing at the copy that is left.
