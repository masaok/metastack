---
id: cache-eviction-policies
deck: fundamentals
type: concept
difficulty: 1
tags: [caching, data-structures]
prompt: >
  Explain LRU, LFU and TTL-based eviction. How do you decide which to use and
  how would you implement LRU in O(1)?
keyPoints:
  - LRU evicts the least recently used item, good for temporal locality, implemented with a hash map plus doubly linked list
  - LFU evicts the least frequently used item, better when a stable hot set exists but needs aging to forget old popularity
  - TTL expires items after a fixed time regardless of use and bounds staleness rather than memory
  - Mentions scan resistance, a one-time bulk read can flush an LRU cache
  - Production caches often combine policies or use approximations such as sampled LRU
eli5:
  - Throw out whatever has gone longest without being touched, which works when recent things get asked for again
  - Throw out whatever is asked for least often, which suits steady favourites but must let old fame fade
  - Throw things out once they reach a set age no matter how popular, which limits how old data gets and not how much room it takes
  - Reading through everything once can push all the useful items out of a recency-based cache
  - Real caches mix these rules or use cheap approximations of them
distractors:
  - text: LFU adapts instantly when popularity shifts, so it needs no aging of old counts
    why: LFU remembers old counts, so an item that was once popular lingers unless counts decay
  - text: A TTL caps how much memory the cache can use
    why: A TTL limits how long an item lives, not how many items there are. Memory still needs a size limit
  - text: An O(1) LRU cache is built on a min-heap keyed by last access time
    why: A heap costs O(log n) per access. The O(1) design is a hash map plus a doubly linked list
followUps:
  - Why does Redis use approximated LRU instead of exact LRU?
  - What is the problem with a naive LFU under a changing workload?
references:
  - title: Redis docs, Key eviction
    url: https://redis.io/docs/latest/develop/reference/eviction/
  - title: Wikipedia, Cache replacement policies
    url: https://en.wikipedia.org/wiki/Cache_replacement_policies
updated: 2026-10-02
reviewed: true
---

A cache has less room than the data it fronts, so when it fills something has to go. The eviction policy is a bet about which item you are least likely to need again.

**LRU (least recently used)** evicts the item that has gone longest without being touched. It assumes temporal locality: what you used recently you will use again. The classic O(1) implementation is a hash map from key to a node in a doubly linked list; every access moves the node to the head and eviction pops the tail. Its weakness is a one-off scan (a batch job reading every record) that pushes the genuinely hot items out.

**LFU (least frequently used)** keeps a hit counter per item and evicts the lowest. It protects a stable hot set from scans, but without decay an item that was hot last week can squat in the cache forever. Real implementations age counters over time or use probabilistic counters.

**TTL (time to live)** attaches an expiry to each entry. It is not really about memory pressure; it bounds how stale data can be and is usually combined with LRU or LFU for capacity.

**In practice**

- Redis offers `allkeys-lru`, `allkeys-lfu`, `volatile-ttl` and others, using sampling rather than exact ordering because exact LRU costs memory per key.
- CDNs and browser caches lean on TTL via `Cache-Control`.
- Admission policies (TinyLFU, W-TinyLFU in Caffeine) decide whether a new item should even enter the cache, which beats pure eviction on many workloads.

Name the policy, its data structure, its failure mode, and the fix.
