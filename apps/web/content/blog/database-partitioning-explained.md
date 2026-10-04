---
slug: database-partitioning-explained
title: Database partitioning explained simply
description: Database partitioning explained simply. How to pick a shard key, what a hot key does, and how partitioning differs from a single replica.
primaryKeyword: database partitioning
secondaryKeywords:
  - sharding
  - partitioning
category: data-and-consistency
tags:
  - fundamentals
  - distributed-systems
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

Database partitioning splits rows across machines so one machine does not hold the whole working set. Replication copies the same rows. They solve different problems. A replica stores another copy of rows you already have. A partition stores a different slice on each machine. The cluster can then hold more rows than one machine. It can take more writes than one machine. This post uses partitioning and sharding for that same family of ideas. Sharding means horizontal partitioning. A function of the shard key chooses the machine for each row. The worked case is a table of users and orders.

## One machine runs out of room

Vertical scaling stops at the biggest machine you can buy. The working set is the rows you read and write all the time. Split the table when the working set or the write rate no longer fits one box.

[The sharding strategies card](/cards/sharding-strategies) states the split directly. Sharding puts the rows of one table on many nodes. Storage and write throughput can then scale past a single machine. Every row goes to a shard by a function of its shard key. A bad key leaves you with one hot machine.

Replication does not add unique capacity. Three replicas of a 2 TB table still store 2 TB of distinct rows. They serve extra reads. They survive a dead disk. They do not hold 8 TB of distinct orders. Partitioning does that. Each shard is usually its own small replica set. The partition chooses the set. The replicas keep that set available.

## How this post uses the words

Partitioning and sharding overlap in casual speech. Here is the usage for the rest of this page.

Partitioning means you split a table into pieces by a rule. Sharding means those pieces live on different machines. Horizontal partitioning is the card's name for that move. Some databases also partition inside one machine. One piece per month lets a server drop old data. That split does not add a second machine's disk. When this post says database partitioning, it means the horizontal kind. Sharding and partitioning name that same family. The shard key is the column the rule reads. Sometimes the key is a pair of columns.

## A users and orders table

`users` holds an account. `orders` holds one row per purchase.

| order_id | user_id | created_at | total |
| --- | --- | --- | --- |
| 1001 | 17 | 2026-10-02 09:01 | 24 |
| 1002 | 42 | 2026-10-02 09:01 | 11 |
| 1003 | 17 | 2026-10-02 09:02 | 8 |
| 1004 | 9001 | 2026-10-02 09:02 | 240 |
| 1005 | 8 | 2026-10-02 09:03 | 15 |

The product reads one user's orders, newest first. The write inserts an order for that user. An admin screen asks for the last hour. [The shard-key card](/cards/choosing-a-shard-key) says to start from those queries. Rank them by volume and by latency sensitivity. A good key makes each dominant query a single-shard read or write. Here that pair is the user's list and the user's insert. Plan the admin hour-scan separately.

Give the cluster four shards, numbered 0 to 3. In this picture a row's home is `user_id` modulo 4. The modulo only shows which rows share a machine. Adding a shard under modulo remaps most keys. For the placement that moves about 1/N of the keys, read [Consistent hashing explained for the interview](/blog/consistent-hashing-explained). The sharding card says to hash the key modulo the shard count. The better option it names is consistent hashing. This post will not rebuild the ring.

Placement by `user_id` modulo 4.

- User 8 goes to shard 0. Order 1005 lives there.
- User 17 goes to shard 1. Orders 1001 and 1003 live there.
- User 42 goes to shard 2. Order 1002 lives there.
- User 9001 goes to shard 1. Order 1004 sits beside user 17.

User 17's orders share shard 1. User 9001 landed there too. They are the celebrity.

## Why user_id works

`user_id` matches the access pattern. The order list for user 17 looks up the shard key. It then reads that user's rows on shard 1. The insert of a new order for user 17 writes shard 1 and stops. The common path touches one machine.

Millions of user ids give the hash room to spread. In a normal hour many users check out at once. Their ids land on different shards. The card's checklist wants that spread. It wants the dominant read on one shard. It wants room for the biggest key to grow. The biggest user has to fit on one shard three years out. Otherwise you need a split plan from the start.

Keep `users` on the same key. User 17's account and orders then share shard 1. Put orders on `created_at` instead. The email screen then joins across shards. The card treats cross-shard joins, unique constraints, and transactions as distributed work. Copy the email onto the order to keep that read local. Use an async pipeline when a screen needs a fresher join.

`user_id` is the wrong key for a different product. A multi-tenant tool whose main question is everything in workspace X should shard by tenant id. Notion sharded by workspace id for this reason. The card cites that choice. A hashed user id would scatter one workspace across every shard. A workspace report would then ask every shard and sort in the application. The key has to match the question you ask most.

One limit sits inside `user_id` itself. An auto-increment user id only grows. Range-partition that column. Every new account lands on the last shard. The hash is what makes `user_id` spread. The column name alone does not.

## Why a timestamp hotspots

Shard the same orders by `created_at` with ranges. The October shard owns every row in the table above. Every `created_at` falls on the morning of 2026-10-02. Tomorrow's inserts go to tomorrow's range. Yesterday's shard sits quiet.

That is the monotonic hotspot. A timestamp only moves forward. An auto-increment `order_id` does the same thing under a range rule. Every insert lands on the last shard. You paid for four machines. One of them still takes every insert. HBase and Bigtable use range partitioning. The shard-key card still names a timestamp and an auto-increment id as the trap.

Hash the timestamp. The hotspot then changes shape. October's rows spread across the four shards. No single shard owns the current hour. Orders in the last hour must ask every shard and merge. You traded a hot writer for a scatter-gather read. A timestamp key also scatters one user's rows. "My orders" fans out too.

Put numbers on the hotspot. The method is the one in [Back-of-the-envelope estimation for system design](/blog/back-of-the-envelope-estimation). Treat the figures as a drill. They are not a measurement of any real store. Suppose the shop takes 4,000 order inserts per second at peak, on four shards. An even hash of `user_id` puts about 1,000 inserts per second on each shard. A range on `created_at` puts about 4,000 on the latest shard. The older shards take about zero inserts. The latest shard is the cluster's entire write capacity. A fifth range for an older month does not help the insert path.

## What a celebrity user does to one shard

User 9001 is a celebrity account. Order 1004 is one sample row. Let that user be 30% of order writes. The shard-key card asks the same question about a tenant that is 30% of traffic.

The hash of `user_id` still sends every one of those writes to one shard. Shard 1 owns user 9001. Shard 1 also owns user 17. Start from 4,000 inserts per second. Thirty percent is 1,200 inserts per second, all on shard 1. The other 70% is 2,800 inserts per second. Spread evenly, that remainder is about 700 inserts per second on each shard. Shard 1 then takes about 1,900 inserts per second. Each other shard takes about 700.

The other shards cannot absorb user 9001. The function returns one home for that key. A larger cluster spreads many keys. It does not split one key. [Consistent hashing explained for the interview](/blog/consistent-hashing-explained) says the same thing about a hot cache key. Virtual nodes even out many keys. They do not break one key apart.

The first mitigation is logical shards. Hash users onto many more logical shards than you have machines. Keep a map from each logical shard to a physical machine. You can move a hot logical shard onto its own machine. That isolates the celebrity from their neighbours. It does not help when that one user is already bigger than one machine. The dedicated machine still takes every write for that user.

The second mitigation is a compound key. The card uses `tenant_id` together with `entity_id`. One large tenant can then span a contiguous range across several shards. Small tenants stay together. For orders, `user_id` together with `order_id` is the same shape. Small users stay on one shard. The celebrity's orders can be range-split inside that user. Those slices can sit on more than one machine. You pay on the common read. "My orders" for the celebrity may touch several shards. For everyone else it still touches one.

If the biggest user will not fit on one shard, the compound key has to exist before the table is large. The card treats rebalancing as part of choosing the key. Double-write during the migration. Backfill the new home. Verify the copies. Cut reads over. Then stop the old writes.

## Range versus hash

[The sharding strategies card](/cards/sharding-strategies) compares three ways to place a row. Here is that comparison on the orders table.

Range sharding keeps adjacent keys together. One shard might own user ids 0 through 999. The next owns 1000 through 1999. A scan of a user-id band hits one shard or a few. Rising ids still pile onto the last shard. That is the timestamp hotspot on a different column. Choose a range when the query needs key order.

Hash sharding spreads load even when the raw key values clump. Neighbouring user ids land on different machines. "My orders" stays on one shard. The query names one `user_id`. Users 1000 through 1200 must visit every shard and merge. Orders from this week must do the same under a hash of `user_id`. Cassandra's partitioner hashes. Most key-value stores hash. Hash sharding on the card takes the key modulo the shard count. Consistent hashing is the better option it names. The ring, the virtual nodes, and the 1/N move live in [Consistent hashing explained for the interview](/blog/consistent-hashing-explained).

Many systems combine the two. Hash a coarse prefix such as tenant id. Range-partition inside that prefix. Tenants spread across machines. Inside one tenant the keys stay ordered. A scan of that tenant stays local.

## A directory when one user must move

Directory-based sharding puts a lookup in front of the data. The lookup maps a key, a key range, or a tenant to a shard. You move user 9001 by editing one mapping. Everyone else stays. A pure range rule cannot move one user that cheaply. A pure hash cannot either.

The lookup sits on every request path. It has to be correct. It has to be fast. It has to stay up. Cache it. Replicate it with care. A stale mapping sends a write to the wrong shard.

The shard key is painful to reverse under every scheme. Interviewers listen for the reasoning more than for a favourite column.

Geography is one of the card's wrong answers. Regions differ in size. Users move.

The card asks where a secondary index goes. A `created_at` index inside each shard still answers the last hour only by asking every shard.

Cross-shard transactions stay expensive. If orders stay on `user_id`, a stock change keyed by `product_id` crosses shards. The card points that leftover work at denormalisation or an async pipeline. If cross-user analytics later becomes the main query, reconsider the key. That is the card's other follow-up.

## Drill the celebrity until it is automatic

A smooth answer that never meets user 9001 will fail the follow-up. You say you would shard orders by `user_id`. You stop. The point of [the shard-key card](/cards/choosing-a-shard-key) is the next question. One user is 30% of writes. Where do those writes go? What do you change so that user can span more than one machine? What did the common read give up?

Say it before you reveal the card. Name the dominant query. Reject the timestamp in one sentence. Place the celebrity on one shard. Then apply a dedicated machine or a compound key. Say which problem each one solves. A memory of hashing for evenness misses the card.

The [fundamentals study page](/study/fundamentals) holds both cards. [Sharding strategies](/cards/sharding-strategies) is the range, hash, and directory comparison. Repeat the shard-key card until the celebrity case is automatic.

[Start drilling](/study/fundamentals).
