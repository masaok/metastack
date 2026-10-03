---
slug: sql-vs-nosql
title: SQL vs NoSQL for system design interviews
description: SQL vs NoSQL for system design interviews. When a relational table is the right store, when a key-value or document store wins, and how to say the tradeoff.
primaryKeyword: sql
secondaryKeywords:
  - nosql
  - relational databases
  - document databases
  - key value stores
category: data-and-consistency
tags:
  - fundamentals
  - databases
author: Masao Kitamura
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

Here is the SQL versus NoSQL answer an interviewer wants. Start from the access pattern and the consistency you need. Pick a relational table when you have relations, transactions, and flexible queries. Pick a key-value or document store when the access is by a known key and you need to scale that path. Relational databases stay the default until a measured pain shows up. Document databases fit an aggregate you always read and write as one unit. Key-value stores fit a huge write volume where every lookup already names its key. That is the whole choice. The rest of this post is the signals, the three stores side by side, one order written both ways, and the sentence you say before any product name.

## Start from the access pattern

NoSQL is a label for several stores. Under it, the choice is query-flexible normalised data versus access-pattern-shaped denormalised data. Decide from how you will read and write.

Name the read before the product. Say which key the caller already holds. Say which other records must succeed or fail with this write. Say whether a later question can arrive that nobody has written down. Those three facts select the store.

Put consistency in the same opening. A checkout that reserves inventory and creates an order needs one outcome for several rows. A device heartbeat can use eventual consistency, or consistency you tune per operation. State that guarantee with the key.

Horizontal scaling is possible for both families now. The difference that remains is query flexibility versus a model built around lookups you already know. [The SQL vs NoSQL card](/cards/sql-vs-nosql) asks for these signals.

## When relational databases win

Relational databases win when the data is highly connected, the queries are ad hoc, and you need multi-row transactions and constraints.

An order points at a customer. A line points at an order. A payment points at that same order. A support tool will filter those links in a combination you invent after launch. A normalised table plus an index answers the new filter. If you cannot list every query on day one, stay relational.

The transaction signal is a write across rows. Move money from one account row to another in one commit. Reserve inventory and create the order in one commit. Several rows change together, or none of them change. Separate application calls can leave a reserved unit with no order, or an order with no reservation.

Put uniqueness, foreign keys, and check constraints in the database. The database rejects a bad write even when a new service forgets the rule. Every writer inherits the same check.

A single primary with read replicas covers most products far longer than people expect. Send reads to the replicas. Cache the hot keys. Shard after you measure a write rate or a size that replicas do not absorb. Start with Postgres. Add caches and replicas. Introduce a specialised store when a measured access pattern demands it.

## When document databases win

Document databases fit an aggregate you always read and write as one unit, with a shape that varies or keeps changing. The order page loads the order with its lines. The profile page loads the user with its settings. One read returns the bundle. One write replaces the bundle.

One profile has a single address. The next has two. A tax field appears on some orders only. The document carries the extra field on the records that need it. You still want secondary indexes. You still want reasonably rich queries within the document. The receipt total is a sum over the lines inside that one order.

Store the facts that must agree as one record. A query inside that aggregate is the query this store makes easy. A new join across many aggregates belongs in relational tables.

## When key-value stores win

Key value stores fit a huge write volume, known access patterns, and a lookup by a key you can always provide. Wide-column stores sit with them. The caller brings a user id, a device id, or a time bucket. You listed those patterns before you created the table.

Write throughput or data size beyond a single node is why you leave one primary. The partition key spreads that load. Every write for one key lands in one place. A key that many clients share becomes a hot spot. Pick the key while the pattern is stable.

These stores offer eventual consistency, or a level you tune per operation. A heartbeat may lag. A balance that must never go negative belongs in a relational transaction. Match the promise to the call. Then name the store.

Adding a machine comes next. Callers should still fetch a record by the same id. [Consistent hashing explained for the interview](/blog/consistent-hashing-explained) is how you place those keys so one new node takes a slice.

A wide-column key adds order. A user id plus a time bucket stores events you read in time order for that user. A question across every user belongs in another store.

## How the three stores compare

Use the row that matches the access pattern you already stated.

| Store | How you read | Transactions | How it scales | A workload that fits |
| --- | --- | --- | --- | --- |
| Relational | Joins and ad hoc filters across related rows | Multi-row transactions with constraints | One primary and read replicas, then a shard after a measured pain | Checkout that reserves inventory and writes an order |
| Document | One aggregate by id, plus a secondary index you planned | The aggregate is written as one unit | Add machines when a single node is too small | Order page that loads lines, status, and totals together |
| Key-value | A lookup by a key the caller always has | Eventual consistency, or consistency tuned per operation | Partition on that key so write volume spreads | Device heartbeats, or events in a time bucket |

A write that must keep two records in lockstep belongs on the relational row. Replacing one order belongs on the document row. Setting one key, at the consistency you named, belongs on the key-value row.

## One order, two schemas

Take one checkout order. Relational tables store the header and the lines as rows you can join. A document stores the same order as one record. Each version makes a different question easy.

```sql
create table orders (
  id uuid primary key,
  customer_id uuid not null,
  status text not null,
  placed_at timestamptz not null
);

create table order_lines (
  id uuid primary key,
  order_id uuid not null references orders (id),
  sku text not null,
  qty integer not null check (qty > 0),
  unit_price_cents integer not null
);
```

A line without an order fails the foreign key. A quantity of zero fails the check. Every writer gets that rejection.

The easy relational query cuts across orders. Orders for customer `cus_42` are a filter on `customer_id`. Orders that contain SKU `mug-blue` are a filter on `order_lines` joined to `orders`. Revenue for that SKU is the sum of `qty` times `unit_price_cents` over the join. You can add these after launch with an index. The rows already have a shape for a question you had not listed.

The easy relational write is the checkout itself. Decrement inventory for each SKU, insert the order, and insert the lines, in one commit. A failure before the commit leaves inventory and the order untouched.

The same order as one document looks like this.

```json
{
  "orderId": "ord_1001",
  "customerId": "cus_42",
  "status": "placed",
  "placedAt": "2026-10-02T18:04:00Z",
  "lines": [
    { "sku": "mug-blue", "qty": 2, "unitPriceCents": 1200 },
    { "sku": "poster-a", "qty": 1, "unitPriceCents": 2400 }
  ]
}
```

The easy document query is the order page. One read by `orderId` returns the status, both lines, and the prices. One write saves the aggregate. A gift note can exist on this order alone. The shape may vary by record. The receipt total is a sum inside this document.

Orders for `cus_42` need a secondary index on `customerId` if that pattern is known. You add the index because you named the lookup.

The hard document query cuts across orders. Units of `mug-blue` sold this week sit outside any one aggregate. You either read every order or maintain a second record on each write. That second record has its own consistency. If the stock count lives in another aggregate, the decrement and the order are two saves. The card's checkout wants those saves to commit together. That is the relational transaction above. Say what a crash between them would leave behind.

A key-value copy stores those bytes under the key `order_ord_1001`. The read works when the caller has the id. Use that form when the id is the only pattern and the measured pain is write volume.

## Signals you chose the wrong store

Joining collections in application code is the first signal. You load orders, lines, and products from separate places and match them in a loop. You wanted relations. A relational database does that join and holds the foreign keys. Move the data to tables when you hear yourself describe the loop.

A JSON column filtered with `LIKE` is the second signal. The questions are real queries. The columns never received the fields. A document store can keep the flexible shape and index the field. Real columns can index it too. The `LIKE` shows that the schema and the questions diverged.

A partition key that changes every quarter is the third signal. You built the key on a pattern that kept changing. Changing the key moves the data and every caller. Filters that keep changing belong on a relational table. A new question there is an index.

Keep graph databases and search engines secondary. Feed them from the primary. A graph earns its place on traversals such as friends-of-friends or a dependency chain. A search engine earns its place on full-text relevance. The primary still owns the transaction. When the interviewer asks when a graph earns its place, name the traversal. Then say you feed the graph from the primary.

## What to say in the interview

Say the access pattern. Say the consistency next. Name the store last.

"The checkout page loads one order with its lines. The write must reserve inventory and insert that order together. I need a multi-row transaction and constraints. I also need room for admin queries I have not listed. I start with Postgres."

"Heartbeats arrive by device id faster than one machine can absorb. Every read includes that device id. Eventual consistency is acceptable. I use a key-value store partitioned by device id."

"The profile is one aggregate. The shape changes often. Every read uses the user id. I use a document database. I add a secondary index only for a lookup we have measured."

Then give the default. Start with Postgres. Add caches and replicas. Add a specialised store for a measured pain.

A DynamoDB table starts from the access patterns. The partition key is a lookup the caller can always supply. A Postgres schema starts from entities and constraints. A new Postgres query is a new index. A DynamoDB question with no designed key is a new access pattern. Design a key for it, or keep that query in Postgres.

Keep the order straight.

1. State the key the caller holds.
2. State whether several records must commit together.
3. Pick a relational table for connections, ad hoc queries, transactions, and constraints.
4. Pick a document database for one aggregate whose shape changes.
5. Pick a key-value or wide-column store for huge writes and a known key.
6. Both sides scale horizontally. Start with Postgres until you measure a pain.

## Drill the access pattern first

You can recognise the words SQL and NoSQL. In the room you still name a product before you say how the data is read. Speak the access pattern before the product name on every pass.

The prompt asks when you would choose a relational database over a NoSQL store, and the reverse, with concrete signals. Say the checklist before you reveal the back. Tick a line only when you said it. [System design interview flashcards that actually stick](/blog/system-design-interview-flashcards) is that grading loop.

Drill the [SQL vs NoSQL card](/cards/sql-vs-nosql) until the access pattern comes before the product name. Start drilling on the [fundamentals study page](/study/fundamentals).
