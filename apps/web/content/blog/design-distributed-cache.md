---
slug: design-distributed-cache
title: Design distributed cache for the interview
description: Design distributed cache for the interview. Placement, eviction, a stampede, a stale write, and the node that melts on a hot key.
primaryKeyword: design distributed cache
secondaryKeywords:
  - cache aside
  - hot keys
category: worked-designs
tags:
  - scalability
  - caching
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

When you design distributed cache clusters, start from the contract. The cache is a performance layer. Losing it must make reads slower, not wrong. Keys are spread across nodes with consistent hashing. Each shard has a replica. Memory is bounded, so eviction and TTLs are part of the design, not an afterthought. A miss storm, a stale write, and a hot key are the three failures you should be ready to walk. The [distributed-cache card](/cards/distributed-cache) is the rubric. This post is the spoken version.

## What the cache guarantees, and what it does not

The API is small. `get`, `set` with a TTL, `delete`, a multi-get, maybe `incr` and a compare-and-swap. Callers expect a sub-millisecond hop. The cluster should hold terabytes across nodes, keep serving when one node dies, and accept a new node without flushing the rest. Those are the requirements on the card.

What it guarantees. A hit returns the bytes last written to that key, or a replica's slightly older copy if you chose availability over a sync write. A miss returns nothing. The caller then loads the source of truth. Adding a node moves about `1/N` of the keys if you placed them with a ring, not almost all of them.

What it does not guarantee. It is not the system of record. A power cut that empties memory must not empty the product. Most interview caches are cache-aside and allow a short stale window. It does not grow without bound. Swap to disk destroys the latency you bought the cache for. Memory is capped. Eviction is how you stay inside the cap.

Cache-aside is the default contract. The application reads the cache. On a miss it reads the database and then `set`s the cache. On a write it writes the database and then `delete`s the cache key. Deleting on write is the usual choice. A `set` of the new value from the writer races with a slower reader that still holds the old database result and writes that old result back. A delete leaves a miss. The next reader fills from the database that already has the new row.

Read-through is the other contract. The cache itself loads the database on a miss. The application only talks to the cache. Use it when many callers should share one loader. Say which contract you are on. The follow-up on the card asks for that sentence.

A partition is allowed to serve stale data. The card prefers availability here. An error from a partitioned replica is worse than a slightly old value, because the database is still the truth and the cache is allowed to be wrong for a TTL. Never make a billing balance or a unique short code live only in this cluster.

## Placement, eviction, and replication

Placement is a ring or a slot map. Hash the key. Walk to a node. [Consistent hashing explained for the interview](/blog/consistent-hashing-explained) is the ring, the `1/N` move, and the virtual nodes that keep arcs even. Redis Cluster's 16,384 slots are the same idea with a fixed table. Clients cache the map and refresh it on a `MOVED` response or a topology notification. A proxy such as mcrouter or twemproxy can hold the map instead. Nodes do not gossip on the get path. The client, or that proxy, picks the node.

The card's size picture is the one you should reuse. 500 GB of hot objects at about 1 KB each is about 500 million keys. A 64 GB machine with about 50 GB usable is about 10 primaries, plus a replica each. Two million gets per second across the cluster is about 200,000 per node. That is inside what a single-threaded Redis or a multi-threaded Memcached node can serve. Do not invent a different cluster QPS. If the interviewer changes the working set, recompute from those densities.

Replication is per shard, primary to replica, usually asynchronous. On primary death the replica is promoted and the map updates. A get during the promotion may miss. Coalesce those misses so the database sees one refresh per key, not one per waiter. Adding capacity migrates slots live. Clients follow `ASK` and `MOVED`. Hash-mod-N is the distractor. Changing N remaps almost every key and flushes the cluster in practice.

Eviction is how a node stays in RAM. Exact LRU wants a linked list per key. Redis samples a handful of keys and evicts the coldest among them. That is close enough. Memcached cuts memory into slab classes so a 100-byte object does not sit in a 1 KB hole. Always set a max-memory policy. LFU is the other approximation when a scan of once-read keys would push hot keys out. TTL is independent of both. An unused key with a minute left still occupies RAM until it expires or loses an eviction race.

A 10 MB value on a single-threaded node blocks other gets. Cap the value. The shortener design in [Design URL shortener for the interview](/blog/design-url-shortener) keeps the long URL as a small cache object and puts the viral load on that one key's node, which is the next section's problem.

| Piece | What you say | What you refuse |
| --- | --- | --- |
| Placement | Ring or slots, client or proxy picks the node | `hash mod N` when N will change |
| Replica | One async spare per shard, promote on death | Crossing the cluster on every get to "stay consistent" |
| Eviction | Bounded RAM, sampled LRU or LFU, TTL | Swap, or unbounded growth |
| Fill | Cache-aside, delete on write | Treating a full cache as the database |

## A stampede and a stale write

A stampede is many misses on one key at once. The TTL ends. A node dies. A deploy flushes a shard. Thousands of requests find nothing and all go to the database. The database is sized for the miss rate you planned, not for the full read QPS. Two million gets per second hitting storage because a hot key expired is an outage.

Single-flight is the first fix. One request per key is allowed to load the database. The others wait for that fill. The cache becomes a small lock, or a single in-process group, per key. The database sees one query.

A lease is the distributed version. The cache hands the first misser a token. Everyone else gets "retry in a few milliseconds" or a wait. The token holder fills and sets. A crashed holder drops the lease. Another misser takes a new one.

Stale-while-revalidate serves the expired value while one request refreshes. Probabilistic early expiration gives each get near the TTL a chance to reload, so the herd never forms on a single clock tick.

A stale write is a different race. Alice updates a row. Her process writes the database and deletes the cache key. Bob, who started a miss before the delete, is still in the database read. He then `set`s the cache with the old row. Alice's next read sees Bob's set. The delete did not save you, because Bob's set arrived later.

Leases fix this too. The fill that Bob is doing carries a token. A `set` without a current token is ignored. Compare-and-swap on a version works the same way. The database row's version must beat the cache version. If you cannot do that, shorten the TTL so the wrong value dies quickly, and say the window.

Node loss is a stampede with a larger blast radius. Every key on that shard misses. Replicas shrink the window. Gradual warm-up and coalescing keep the database alive. If the replica was async, a handful of keys may be empty after promotion. They refill. The product stays correct because the database still has them.

## Hot keys and the node that melts

Consistent hashing puts one key on one primary. Virtual nodes spread key counts. They do not split one key. A key that is read far out of proportion to the others lands on one process. That process melts. The rest of the ring is bored.

The card's hot-key tools are the ones you should name. Put a short-TTL copy in the application process. That L1 cache answers the next thousand reads from the same instance without crossing the network. The TTL is small, so a write's delete becomes visible soon. This is the first lever.

Replicate the hot key on purpose. Store `key#1` through `key#N` and pick one at random on read. Writes update all of them, or invalidate all of them. You have traded write cost for read fan-out. Use it when one key is a celebrity and the others are ordinary.

Split the key if the value can be split. A counter can be sharded into partial counters and summed. A huge object can be chunked. A boolean flag cannot. Do not pretend a split works when the read always needs the whole value on one node.

A viral short code is this problem in a product you already know. [Design URL shortener for the interview](/blog/design-url-shortener) puts millions of redirects an hour on one code, about 300 requests a second on that key at a million an hour. The shared cache serves it after the first miss. A short TTL at an edge hop can absorb a burst. The remaining point is the same: one key, one node, unless you copy it.

Client discovery belongs in the same breath as a melt. Clients need a current map. A dead node that still looks alive will collect heat and then drop it. Health checks and a config service publish the map. On failure, clients stop sending to that address. On a `MOVED`, they update the slot. A client that ignores `MOVED` is how you keep melting a node you already drained.

## What the distributed-cache card already asks you to say

Speak the card's points before you draw a logo.

Shard with consistent hashing in the client or in a proxy. Keep a replica per shard so a death is a promotion, not a flush. Adding a node must not remap the world.

Bound memory. Name an eviction approximation, LRU or LFU, and a TTL. "The operating system will swap cold pages" is the failure the card lists.

Protect the database from a herd. Name one of coalescing, a lease, or stale-while-revalidate. "Let every waiter query at once so the entry fills faster" is the other listed failure.

Handle a hot key with an in-process cache, extra copies, or a split. Do not stop at "the ring is fair." The ring is fair across keys, not across popularity.

Define the contract. Cache-aside plus delete on write is the default. Say what a dead node does to readers. Say what a new node does to the map. Prefer availability on a cache partition. Never call the cache authoritative.

The estimates you may use are on the card. 500 GB, 1 KB objects, 500 million keys, about 10 primaries of 50 GB usable, two million gets per second, about 200,000 per node.

Follow-ups. How a client learns the map and reacts to a death. Answer with a config service, health checks, and `MOVED`. When look-aside beats read-through. Answer with "the application already knows how to load the row" versus "many callers should share one loader."

Drill the card on the [classic designs study page](/study/designs) until the contract, the ring, the herd, and the hot key come out in that order. Then run the consistent-hashing card until `1/N` is automatic.

[Start drilling](/study/designs).
