---
slug: redis
title: Redis for system design interviews
description: Redis for system design interviews. Name the structure, name the job, and do not treat persistence as a database you can rebuild from.
primaryKeyword: redis
category: caching-and-storage
tags:
  - caching
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the Redis answer an interviewer wants. Redis is an in-memory store with a small set of data types. You pick it when the access is by a key you already have and the working set fits in memory. You name the structure first. You name the job second. Cache, lock, and stream are three different jobs. Persistence is a restart aid, not a source of truth. A cluster is a map from keys to slots, and a slot can move. That is the whole pitch. The rest of this post is the types, the three jobs, what persistence does not give you, how a slot migrates, and when you should pick another store.

## The structures interviewers expect you to name

[The Redis data types](https://redis.io/docs/latest/develop/data-types/) are the vocabulary. You do not need every module. You need the ones that show up on a whiteboard.

A string holds a value or a counter. A session or a rendered fragment is a string with a TTL. A hash holds fields on one key, so a cached profile can update one field. A list is an ordered sequence you push, pop, and trim, not a durable log. A set is unique membership: presence, or who is in a room. A sorted set orders members by a score: a leaderboard, or feed ids by time. A stream is an append-only sequence with consumer groups. Name it when Redis is doing messaging, not caching.

Say the type before the command. "I store the last 500 post ids for this reader in a sorted set, score equal to time" is an answer. "`ZADD` something" is not.

| Type | What the key holds | A design that fits |
| --- | --- | --- |
| String | One value, or a counter | Cache entry, rate-limit token bucket, session |
| Hash | Named fields on one object | Cached profile, cached short-link metadata |
| List | Ordered values you push and pop | Recent items, a single-consumer queue |
| Set | Distinct members | Room membership, unique ids |
| Sorted set | Members ordered by score | Leaderboard, feed ids by time |
| Stream | Appended entries and consumer groups | Fan-out of jobs to workers |

Name the one row you are using. Walk the list only if they ask what else Redis can do. A bitmap, a HyperLogLog, and a geo index exist; mention them only for unique counts or nearby points.

## Cache, lock, and stream as three different jobs

The same process can do more than one job. The jobs still have different failure stories. Name the job. Then name the guarantee.

Cache is the first job. You keep a copy of a value that already lives in a database. A miss loads the store and fills the key. A TTL bounds staleness. Eviction bounds memory. The cache is allowed to be wrong. Cache-aside is the pattern you say first. If you need a write story, say write-through or invalidation as a separate sentence.

A hot short link is a cache. [Design URL shortener for the interview](/blog/design-url-shortener) is a read-heavy lookup. Redis holds the long URL under the short code. The table still owns creates and expiry.

Lock is the second job. `SET key token NX EX seconds` is the usual sketch. Expiry stops a dead holder from locking forever. A lock is not a transaction and does not fence a late writer by itself. If two workers can still both do the side effect after expiry, you need a fencing token or you should stop using a lock. Say the expiry. Then stop.

Stream is the third job. You append an event. Workers read it. A consumer group tracks pending entries. [Message queues for system design interviews](/blog/message-queues-for-interviews) is where you compare a broker, a log, and this lighter option. Streams help when the backlog is small and you can accept a weaker restart story. They are the wrong answer when you need days of retained traffic you cannot rebuild.

Do not use one key for two jobs. A cache key with a TTL is a bad lock. A list used as a queue is a bad durable log. A stream used as the only copy of an order is a bad database.

A short script you can say:

"This key is a cache. The row in Postgres is the truth. I will take a short lock around the stampede on this id. The thumbnail job goes on a stream, or on the queue we already have. Those are three keys and three failure modes."

## Persistence you should not pretend is a database

Redis keeps the working set in memory. That is why it is fast. It is also why you must say what happens when the process dies.

Two persistence modes exist. A snapshot writes the data set to disk on a schedule or on a trigger. An append-only file records commands as they run. You can combine them. You can turn both off. None of those modes makes Redis your system of record for data you cannot rebuild.

A snapshot that runs every minute can lose the last minute. An append-only file that fsyncs every second can lose the last second. A replica that has not caught up can lose more. If the product cannot lose a charge, a follow, or a short-link create, those writes commit in a database first. Redis then caches or fans out.

Interviewers like the phrase "Redis is durable." Push back with the rebuild test. If the Redis node is empty tomorrow, which writes come back from another store, and which are gone? Cache entries come back on the next miss. A lock comes back as unlocked, which is correct if the work is idempotent. A stream of jobs comes back only if you persisted it and the file survived. An order that lived only on a hash is gone.

Use Redis as a database only when the data is disposable or easily rebuilt. Leaderboards, feed indexes, and rate-limit counters usually are. User uploads, payments, and the short-link mapping are not.

If the working set does not fit, you evict, you shard, or you leave.

## Clustered Redis and the slot that moves

A single Redis process has one memory limit and one CPU. A cluster spreads keys across nodes.

Redis Cluster maps every key to one of 16384 hash slots. The slot is a function of the key. A node owns a subset of the slots. A client that talks to the wrong node is redirected. You do not invent a percentage. You say "the key hashes to a slot, the slot lives on a node."

Resharding moves a slot. The cluster copies the keys in that slot to the destination node. During the move, a client may be told to ask the new owner. After the move, that slot no longer lives on the old node. The unit that moves is the slot, not an arbitrary key and not the whole node.

This is why you care about the key name. Related keys that must be read together need the same slot. A hash tag in the key, `{user:42}.profile` and `{user:42}.feed`, pins those keys to one slot. Without a tag they can land on different nodes. A multi-key command then fails.

While the slot migrates, some keys are in flight. A client with a stale slot map is redirected. Say that you expect `MOVED` and that you refresh the map.

[Consistent hashing explained for the interview](/blog/consistent-hashing-explained) is the general placement story. Redis Cluster uses slots rather than a ring you draw by hand. Only a slice of keys should move, and a bad key design creates a hot slice.

A hot key is one slot on one node. Clustering does not split a celebrity feed or a viral short code. You then need a local cache, a split key, or a different store.

Replicas are failover, not a query planner. A replica can serve reads if you accept lag. During failover the slots are not writable. Say the window exists. Do not invent its length.

## When to pick something else

Start with the access pattern, not the product name. Redis wins when the lookup key is known, the working set fits in memory, and the data can be rebuilt or dropped.

Pick a relational database when several records must commit together, when you need constraints, or when the next query is one you have not listed. [SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) is that choice. Redis is not on the relational side.

Pick object storage when the value is a photo, a video, or any blob that should not sit in memory or in a row. Redis can hold a URL. It should not hold the file.

Pick a log or a broker when you need retained history, many independent consumers, or a backlog that must survive a Redis restart. A stream is a tool. It is not Kafka.

Pick a time series database when the write is an append of points you will range-scan and roll up. A Redis sorted set can hold a short window of points. It is a poor years-long metrics store.

Pick a disk-backed key-value store when the data is larger than memory and every lookup still has a key. Redis with eviction is a cache in front of that store, not a replacement for it.

A sentence you can reuse:

"I use Redis for the hot read and for short-lived coordination. The source of truth stays in Postgres. Files stay in object storage. The durable log stays in the queue. If the Redis node is empty in the morning, I can refill the cache and I have not lost a write I cannot replay."

Keep the order straight.

1. Name the structure.
2. Name the job. Cache, lock, and stream are not the same job.
3. Say what a restart loses.
4. If you cluster, say that a key maps to a slot and that a slot can move.
5. Leave when the working set, the query, or the durability does not fit.

Drill those five lines until they come out before a product tour.

Start on the [fundamentals study page](/study/fundamentals).
