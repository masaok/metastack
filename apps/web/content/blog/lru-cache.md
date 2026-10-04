---
slug: lru-cache
title: LRU cache for system design interviews
description: LRU cache for system design interviews. A hash map plus a doubly linked list, constant-time get and put, and the scan that flushes the working set.
primaryKeyword: lru cache
category: caching-and-storage
tags:
  - caching
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the LRU cache answer an interviewer wants. Least recently used eviction drops the entry that has gone longest without a touch. The structure is a hash map plus a doubly linked list. Get and put are constant time. The failure mode is a scan: a one-off pass over cold keys can push the hot set out. LFU and TTL are the alternatives you name next. That is the whole policy. The rest of this post is the structure, the two operations, scan resistance, the other policies, and what the MetaStack eviction card already asks you to say.

## The map and the list

An LRU cache has a capacity. When it is full, the next insert must remove something. The bet is temporal locality. What you used recently you will use again. What you have not used in a long time is the thing you can drop.

Two structures make that bet cheap.

The hash map takes a key to a node. Lookup is constant time. The node holds the key, the value, and two pointers.

The doubly linked list orders those nodes by recency. The head is the most recently used entry. The tail is the least recently used entry. Every hit moves its node to the head. Eviction pops the tail.

A singly linked list is the wrong list. You need to pull a node out of the middle when it is hit, and you need to do that without walking from the head. The node must know its neighbours. A heap keyed by timestamp is the other wrong structure. A heap makes each access logarithmic.

```
capacity 3
map   a → node(a), b → node(b), c → node(c)
list  head: c ↔ b ↔ a :tail
```

After a get of `a` the list is `a ↔ c ↔ b`. After a put of `d` that exceeds capacity, `b` leaves. The list is `d ↔ a ↔ c`.

Draw the boxes. Interviewers want to see the two pointers and the map arrow, not a library name.

The list is the recency order. The map is the index. Neither structure alone is enough. A list without a map makes get linear. A map without a list makes eviction a scan for the oldest timestamp.

Capacity is a count of entries, or a count of bytes if values vary. Say which one you are using. A cache of short-link URLs can count entries. A cache of rendered pages should count bytes.

## A get and a put in constant time

Write the operations as pointer updates. That is the proof that they are O(1).

Get:

1. Look up the key in the map. If it is missing, return a miss.
2. The map gives you the node.
3. Unlink the node from its current neighbours.
4. Link it at the head.
5. Return the value.

Each step touches a constant number of pointers. No walk.

Put:

1. Look up the key. If it exists, update the value and do the same move-to-head as get.
2. If it is new, allocate a node, insert it in the map, and link it at the head.
3. If the size is now above capacity, take the tail node, unlink it, and delete it from the map.

Again, no walk. Eviction is "remove the tail," not "search for the minimum timestamp."

A small trace you can redo.

Start empty, capacity 2.

- `put(1, A)` — list `1`. Map holds 1.
- `put(2, B)` — list `2 ↔ 1`.
- `get(1)` — list `1 ↔ 2`. Returns A.
- `put(3, C)` — capacity exceeded. Tail is 2. Evict 2. List `3 ↔ 1`.

Ask yourself what `get(2)` does after that. It misses. That is the point of the tail.

Concurrency is a follow-up. A single process can lock the map and the list together. A sharded cache locks per shard. Do not claim wait-free magic. Say that the move-to-head is a write, so a hot key contends on its node.

Distributed LRU is a different design. Each node holds a shard of the keys. [Consistent hashing explained for the interview](/blog/consistent-hashing-explained) is how a key finds its node. Eviction is then local to that node. A hot key still lives on one node. Placement and eviction are separate sentences.

A URL shortener read path is a good home for this cache. [Design URL shortener for the interview](/blog/design-url-shortener) is a lookup from code to URL. An LRU of hot codes sits in front of the table. A viral link stays at the head. An old unused code falls off the tail.

## Scan resistance

Scan resistance is the reason LRU is not always the right policy. A scan is a one-time pass over many keys that will not be read again. A nightly job that reads every user, a backup that walks the table, a migration that touches every id.

Each of those reads is a get. Each get moves that key to the head. If the scan is larger than the cache, every hot key that was in the cache is pushed to the tail and then evicted. After the job finishes, the cache holds the last page of the scan. The working set is gone. The next user requests miss.

That is the failure you must name. LRU assumes that recent equals useful. A scan makes recent equal to "just read once."

Fixes you can say, in order of how much you change.

Do not send the scan through the cache. The batch job reads the database. The user path uses the cache. One line of discipline.

Admit a new key only if it deserves a slot. Admission policies keep a one-hit wonder from entering. The scan then fails to enter, and the hot set stays. Name the idea. Do not invent a hit rate.

Use LFU, or a mix, when a stable hot set matters more than recency. The next section is that comparison.

Approximate LRU instead of exact LRU when you have millions of keys. Exact LRU stores two pointers per key. A sampler that checks a few random keys and evicts the oldest among them is cheaper. Production caches do this. The interview still wants the exact structure first, then the approximation as a cost note.

A worked scan.

Cache holds `{session, profile, feed}` and they are all hot. Capacity is 3. A job then gets `u1` through `u100`. After `u3` the three user keys have replaced the hot set. After `u100` the cache holds `{u98, u99, u100}`. The next `get(session)` misses.

Say that sequence. It is clearer than the phrase "scan resistance" alone.

## LFU and TTL as the alternatives

Least frequently used eviction keeps a hit count and drops the lowest. A stable favourite survives a scan. A key that was hot last week and is idle today can squat unless you age the counts. Aging is the follow-up. Decay the counters, or use a windowed count. Without decay, LFU remembers old fame.

TTL is not an eviction policy for memory. It is a staleness bound. Each entry dies at a deadline whether it is hot or not. A TTL of five minutes means no reader sees a value older than five minutes, unless you refresh it. Memory can still fill with entries that have not expired. You still need a size limit, and that size limit still needs LRU, LFU, or a sample.

| Policy | Drops | Wins when | Loses when |
| --- | --- | --- | --- |
| LRU | The entry unused for the longest time | Recent keys are the ones you will read | A scan walks past the working set |
| LFU | The entry with the lowest hit count | A stable hot set must survive noise | Counts do not decay and old hits linger |
| TTL | The entry whose deadline passed | You must bound staleness | You treat it as a memory cap |

In the room, pick one and say the failure. "I use LRU for the short-link cache. I keep the batch exporter off that path so a scan cannot flush it. I also set a TTL so a deleted link does not live past a minute."

Production caches mix these. A TTL plus LRU is common. An admission filter plus LRU is common. Sampled LRU is common when the key count is huge. You still start from the map and the list.

Do not use a min-heap of timestamps and call it O(1) LRU. That is O(log n) per access. The card's distractor is that heap. If you hear yourself say heap, stop and go back to the list.

## What the cache-eviction card already asks you to say

[The cache-eviction-policies card](/cards/cache-eviction-policies) asks you to explain LRU, LFU, and TTL, to choose among them, and to implement LRU in O(1).

The card wants these lines said out loud.

LRU evicts the least recently used item. It is the right default when recent access predicts the next access. The O(1) implementation is a hash map from key to a node in a doubly linked list. Every access moves the node to the head. Eviction pops the tail.

LFU evicts the least frequently used item. It is better when a stable hot set exists. It needs aging so last week's popularity does not occupy space forever.

TTL expires items after a fixed time regardless of use. It bounds staleness. It does not bound memory. You still need a size policy.

Scan resistance is a required mention. A one-time bulk read can flush an LRU cache. That sentence is easy to skip and it is one of the key points.

Production caches often combine policies or use approximations such as sampled LRU. Exact pointers per key cost memory. A sample of a few keys is enough to evict something old.

The distractors on the card are the traps. LFU does not adapt instantly; old counts linger. A TTL does not cap memory. A heap is not the O(1) design.

Follow-ups you should already have a sentence for. Why approximate LRU at scale? Pointers per key. What goes wrong with naive LFU when the workload shifts? The old hot set never leaves.

A short answer you can reuse:

"LRU is a map plus a doubly linked list. Get and put move a node to the head in constant time. A full cache evicts the tail. A scan can flush that cache, so I keep bulk reads off the path or I use LFU with aging. TTL bounds how stale a hit may be, not how many keys I store."

Tick a line only when you said it.

Start on the [fundamentals study page](/study/fundamentals).
