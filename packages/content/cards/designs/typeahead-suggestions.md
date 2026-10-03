---
id: typeahead-suggestions
deck: designs
type: design
difficulty: 2
tags: [search, caching, data-structures]
prompt: >
  Design a search autocomplete (typeahead) service that returns the top 10
  suggestions for a prefix within 100 ms, updated from recent query popularity.
keyPoints:
  - Serves from a precomputed prefix → top-k structure (trie with cached top-k per node, or a sorted key-value table) rather than computing at query time
  - Separates the offline pipeline that aggregates query logs and builds the data from the online read path
  - Shards by prefix and replicates heavily since the workload is read-only and extremely hot
  - Caches aggressively at the edge and in the browser, and debounces client requests
  - Handles freshness with periodic rebuilds plus a small real-time layer for trending terms, and filters offensive content
eli5:
  - Work out the best completions for every beginning of a word ahead of time, so answering is a lookup and not a calculation
  - A background job counts past searches and builds the lookup, and the live service only reads it
  - Split the lookup by starting letters and keep many copies, because it is read constantly and never written by users
  - Keep answers near the user and in the browser, and wait until typing pauses before asking
  - Rebuild the lookup on a schedule, add a small fast layer for what is suddenly popular, and remove offensive suggestions
followUps:
  - How do you personalise suggestions without destroying cache hit rates?
  - How would you support typo tolerance or mid-word matching?
stages:
  - name: Requirements
    keyPoints:
      - Return top 10 suggestions for a typed prefix, ranked by popularity, under 100 ms end to end
      - Updated daily or hourly, with trending terms surfacing faster, safe-for-work filtering
  - name: Estimates
    keyPoints:
      - e.g. 10M searches/day × ~5 keystrokes each → 50M prefix lookups/day, ~600/s average, peak several thousand per second
      - Vocabulary of ~100M distinct queries with top-k per prefix stored, a few tens of GB
  - name: API
    keyPoints:
      - GET /suggest?q=prefix&limit=10 → list of strings, heavily cacheable
      - Client debounces (~50-100 ms) and cancels stale requests
  - name: Data model
    keyPoints:
      - Trie where each node stores its top-k completions, or a flat table prefix → [top-k] in a key-value store
      - Aggregated query frequencies with time decay
  - name: High-level design
    keyPoints:
      - Offline, logs → aggregation (batch) → trie/table build → publish to serving nodes
      - Online, CDN/edge cache → suggestion service (in-memory data) sharded by prefix
  - name: Deep dives
    keyPoints:
      - Precomputing top-k at every node makes queries O(prefix length) with no traversal of subtrees
      - Sharding by first one or two characters with weight-aware splits for hot prefixes
      - Trending layer that counts recent queries in a stream and merges into results
  - name: Bottlenecks and failure
    keyPoints:
      - Hot prefixes like "a" or "the" handled by replication and edge caching
      - Rebuild swaps must be atomic (double buffer) to avoid serving partial data
      - Offensive or private terms filtered at build time with a blocklist
references:
  - title: Wikipedia, Trie
    url: https://en.wikipedia.org/wiki/Trie
  - title: Facebook engineering, The life of a typeahead query
    url: https://engineering.fb.com/2010/05/17/web/the-life-of-a-typeahead-query/
updated: 2026-10-02
reviewed: true
---

## Requirements

As the user types, show the ten most popular queries starting with what they have typed so far, ranked by popularity, with results arriving fast enough to feel instant (under 100 ms including network). Popularity should reflect recent behaviour, with hourly or daily refreshes and a faster path for trending terms. Offensive or private strings must never appear.

## Estimates

With 10 million searches/day and ~5 keystrokes per search, there are ~50 million prefix lookups/day: ~600/s average, peaks of a few thousand per second. If there are 100 million distinct queries and we store the top 10 completions for every prefix up to, say, 20 characters, the structure is tens of gigabytes: fits in memory across a small cluster.

## API

`GET /suggest?q=des&limit=10` returns `["design patterns", "design system", ...]`. Responses depend only on the prefix (no user state), so they cache perfectly at the CDN with a short TTL. The client debounces keystrokes (50–100 ms), cancels in-flight requests when a new key arrives, and caches results locally for backspacing.

## Data model

Two equivalent choices:

1. **Trie with per-node top-k.** Each node represents a prefix and stores its ten best completions with scores. Lookup walks the prefix (O(length)) and returns the stored list; no subtree traversal at query time.
2. **Flat key-value table** `prefix → [top-k]` for every prefix. Simpler to shard and serve from Redis or a wide-column store; costs more storage because prefixes repeat completions.

Both are built offline from an aggregated `query → weighted count` table where weights decay over time.

## High-level design

```mermaid
flowchart LR
  subgraph offline[Offline pipeline]
    L[(Query logs)] --> AGG[Aggregate + decay + filter]
    AGG --> B[Build trie / prefix table]
    B --> ART[(Published snapshot)]
  end
  subgraph online[Online path]
    C[Browser] --> E[CDN edge cache]
    E --> S[Suggest service, in-memory shards]
    T[(Trending counts)] --> S
  end
  ART --> S
```

The offline job runs hourly, applies the blocklist, computes decayed popularity, builds the structure, and publishes a new snapshot. Serving nodes load the snapshot into memory with a double-buffer swap so no request sees a half-built structure.

## Deep dives

**Why precompute top-k.** Computing the top 10 completions under a trie node at query time means traversing possibly millions of descendants. Storing the answer at each node makes every lookup a few pointer hops; the cost moves to the build step, which is offline and parallel.

**Sharding.** Hash on the first character or two. "a", "s" and "t" prefixes are far hotter than "x" or "z", so split hot shards further (e.g. "a" → "aa"–"am", "an"–"az") and replicate every shard several times; the data is read-only so replication is trivial.

**Trending.** A streaming job counts queries over the last few minutes. The serving node merges a small trending list into results when a recent term's velocity exceeds a threshold, so "earthquake" appears within minutes rather than after the next hourly build.

**Personalisation.** Keep the global results cacheable and let the client (or a thin layer) re-rank or prepend the user's own recent searches, which it already has locally.

## Bottlenecks and failure modes

- **Hot prefixes:** single-letter prefixes dominate traffic; edge caching with a 60-second TTL absorbs most of it.
- **Snapshot publish:** load the new structure in the background and swap atomically; keep the old one until all requests using it finish.
- **Bad data:** blocklist at build time, plus a kill switch to remove a term from serving immediately without a rebuild.
- **Latency budget:** network ~30–50 ms, edge or service ~5 ms, client render ~10 ms. Most of the budget is the network, which is why the CDN matters more than the data structure.
