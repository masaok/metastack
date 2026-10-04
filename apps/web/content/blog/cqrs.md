---
slug: cqrs
title: CQRS and event sourcing for interviews
description: CQRS and event sourcing for interviews. Separate write and read models, optional event store, and the lag a read model is allowed.
primaryKeyword: cqrs
secondaryKeywords:
  - event sourcing
category: architecture
tags:
  - architecture
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the CQRS answer an interviewer wants. CQRS means the model that accepts a write is not the model that answers a query. You keep a write side that enforces rules. You keep one or more read models shaped for a screen. Event sourcing is optional. It stores the write side as a sequence of facts instead of a mutable row. The two pair well because those facts can feed the projections. They also work apart. You pay with lag, with event versions that never go away, and with a conceptual load the team has to share. That is the whole pattern. The rest of this post is the split, the optional log, the lag you must name, two read models you can draw, and the lines the card already grades.

## Separate models for write and read

Most services use one schema for both jobs. You insert an order. You select the same row for the order page. That is fine while the page is the row, or a small join.

CQRS splits the jobs. A command arrives: place, cancel, approve. The write model loads the aggregate it protects, runs the rules, and commits. A query arrives: show the seller dashboard, show the search page, show the feed. The query does not load that aggregate. It reads a table, a cache, or an index built for that shape.

The stores can differ. Postgres can own the write. A search engine can own the catalog query. A sorted set can own a leaderboard. [SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) is how you pick each store from its access pattern. CQRS is why you are allowed to pick more than one.

The write model stays normalised enough to enforce the rule. You cannot oversell a unique seat if the write side does not serialise the reservation. The read model is allowed to denormalise. The seller dashboard can store a count next to a title. The feed can store a list of ids. You would not want the write side to update every dashboard row in the same commit as the sale. That is the coupling CQRS removes.

You do not need a bus on day one. A process can write the order and then update a denormalised table in the same database, even in the same transaction, if the read model is small and you can afford the extra writes. That is still CQRS. The moment those updates move off the request, you have the usual outbox and the usual lag.

Commands can fail. The write model says no. Queries should not carry that veto. If a query handler starts calling the write side to "make sure," you have collapsed the split.

Writers are few. Readers are many and disagree with each other. That disagreement is the reason for more than one read model. A single extra column on the write row is not CQRS. Use the word when the shapes have actually diverged.

## Event sourcing as an optional store for the write side

Event sourcing stores every change as an immutable event on an append-only log, usually one stream per aggregate. The current state is what you get by replaying those events. The log is the truth. A snapshot is a cache of that replay.

`Deposited 100` then `Withdrew 20` is the account. You do not store `balance = 80` as the only fact. You may store 80 in a snapshot so the next command does not replay a year of movements. You can rebuild 80 at any time.

CQRS does not require that log. The write side can be an ordinary row. `orders.status` can move from `placed` to `cancelled` with an update. Read models then subscribe to a change stream or to an outbox of those updates. That is CQRS without event sourcing.

Event sourcing does not require CQRS. You can replay a single model and serve reads from the rebuilt state. You lose the specialised screens until you add projections.

Together, the write side appends events. Projections subscribe. Each projection writes a read store. A new question, "how many users downgraded last quarter," becomes a new projection that replays. You do not guess a migration from a mutated row that lost the path.

```text
Command -> write model -> event store
                              |-> projection: search
                              |-> projection: dashboard
                              '-> projection: feed list
Query  -> read store
```

The costs arrive with the log. Events are forever. A field you named badly in year one is still in the stream. You upcast when you read, or you version the event type. You do not edit the old payload. Long streams need snapshots or command latency grows. Projections must be idempotent, because replay will hit them again. A bug that ran for a year is a rebuild, not an `UPDATE`.

Recommend the pair when history is the product. Ledgers, orders, collaboration documents. Steer away when the domain is a profile you overwrite and a list you page. Plain CRUD with a few denormalised tables is the better answer there. Say that. Interviewers have heard CQRS used as decoration.

## The lag the read model is allowed

The read model is a projection. It is behind the write. That is not an accident you hide. It is a budget you set.

The seller who just accepted an order should see that order on the next screen. You have three honest options. Read from the write side for that actor. Wait for the projection and spin briefly. Show a pending row the client already knows about because it sent the command. The option you should not take is to block every reader until every projection has caught up.

A stranger browsing the catalog can see a listing that is seconds old. Rank and a search index are in this bucket. Stock that must not sell twice is not. Stock lives on the write side, or on a reservation that serialises. The catalog card can be stale if add-to-cart re-checks.

Name the number. A few seconds for a feed. A minute for a dashboard rollup. A day for a warehouse report. The number is part of the product. An SLO on projection lag is more useful than a claim that "we use CQRS."

When a projection falls behind, the write side keeps taking commands. Page the lag. Serve the stale read. A blocked checkout because the dashboard worker is down is a failed drawing. Rebuild from the event store, or from the write rows plus the outbox, when a projection is wrong. That rebuild is why the log, or the outbox, must be replayable.

Read-your-write is the case interviewers poke. The user submits. The next GET misses. They refresh and think the save failed. The fix is not a shorter Kafka topic. The fix is a path that does not depend on the projection for that user in that moment.

Idempotent projections matter here. At-least-once delivery will apply `OrderPlaced` twice. A count increment that is not keyed on the event id will drift. A row upsert on order id will not. Design the projection as if replay is normal traffic.

## A news feed or a bookings read model

A news feed is a read model. The write is "publish a post." The write store is the posts table, maybe plus an event. The read model is a per-user list of post ids, capped, scored by time. Fan-out workers are the projection. [Design news feed for the interview](/blog/design-news-feed) is that path. CQRS is the name of the split you already drew: one write, many lists.

You do not run the write through the lists. The author does not wait for every follower insert. Celebrity accounts skip the push and stay on a pull at read time. That is a second read model for the same write. The post did not change.

A bookings product is the other sketch. The write model is a reservation. A command tries to take a slot. The write side serialises on the slot, or on a version of the resource, and appends `SlotBooked` or rejects. Two customers cannot take the same seat because the write said no.

The read models diverge.

| Read model | Shape | Lag you allow |
| --- | --- | --- |
| My bookings | Rows for this customer | Seconds, or read-your-write |
| Calendar grid | Counts per slot for a day | A few seconds |
| Search of listings | Analysed text plus filters | Near-real-time |
| Finance export | Daily aggregates | Hours |

The calendar grid is why CQRS earns its keep. A page of 200 slots with remaining counts should not load 200 aggregates and replay them on the request. A projection increments a count when `SlotBooked` arrives. A double-click that loses the race still fails on the write side. The grid can show one extra free slot for a second. Checkout does not trust the grid.

```text
Book command -> reservation aggregate -> events
                                         |-> my_bookings (by customer)
                                         |-> slot_counts (by day)
                                         '-> listings index
```

If you only have "my bookings," you do not need this. A query on the reservation table is enough. Add the split when the calendar, the search, and the write rules cannot share a schema without hurting each other.

Walk the seat, the missed GET after a book, and the rebuild of `slot_counts` after a bad increment.

## What the cqrs-and-event-sourcing card already asks you to say

The [CQRS and event sourcing card](/cards/cqrs-and-event-sourcing) grades a short list. Say it in this order.

CQRS separates the write model from one or more read models optimised for specific queries. Commands go to the write side. Queries go to the read side. The stores can differ.

Event sourcing stores the sequence of domain events as the source of truth and derives current state by replay. The log is the truth. Everything else is a cache.

Together, events from the write side feed projections that build the read models asynchronously. A new view is a new projection, not a guess from a mutated row.

Benefits the card wants: a full audit history, temporal queries, replay to build new views, and read models shaped for each screen.

Costs the card wants: eventual consistency between write and read, event schema evolution, snapshots for long streams, and a higher conceptual load. Teams that do not share the pattern turn it into two writes that disagree.

The distractors are common. CQRS does not require event sourcing. Read models are not updated in the same transaction as the write once they have moved off the request. Events are not edited in place when the schema changes.

The follow-ups on the card are a year-old bug in a projection, and the case where plain CRUD is better. Rebuild the projection from the log. Prefer CRUD when history is not the product and the screens still match the rows.

A sentence you can reuse:

"I write reservations as an aggregate with a version. I project my bookings, a calendar count, and a search index. The calendar can lag a few seconds. The reserve still serialises on the write. I would not event-source a profile I overwrite."

Keep the order straight.

1. Split the write model from the read models.
2. Treat event sourcing as optional, and say when history is the product.
3. Name the lag and the read-your-write path.
4. Draw a feed or a bookings read model.
5. Recite the card's benefits, costs, and distractors.

Speak the write side first. Speak the projection second. Drill the card until the lag comes out with the split. Start on the [fundamentals study page](/study/fundamentals).
