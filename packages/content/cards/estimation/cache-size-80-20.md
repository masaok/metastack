---
id: cache-size-80-20
deck: estimation
type: estimation
difficulty: 2
tags: [estimation, caching]
prompt: >
  A news feed service serves 10 billion post reads a day across 500 million
  posts of ~1 KB each. Size a cache to serve 80% of reads from memory, and
  estimate the database read load that remains.
keyPoints:
  - Apply the 80/20 rule, 20% of posts get 80% of reads, so cache 20% × 500M = 100M posts
  - 100M × 1 KB = 100 GB of cache data, plus ~30-50% overhead for keys and metadata, call it 150 GB
  - That fits in a few large Redis or Memcached nodes, or one node with replicas for availability
  - Reads per second, 10B / 86,400 ≈ 115,000 per second, 20% miss rate leaves ~23,000 per second for the database, ~60,000 at peak
  - Daily-churn posts dominate reads, so caching the last 24-48 hours of posts may hit even higher than 80%
eli5:
  - A fifth of the posts get most of the reads, so only that fifth needs to be kept in fast memory
  - A hundred million small posts take about a hundred gigabytes, and bookkeeping pushes that to around one hundred fifty
  - That amount fits on a handful of big cache machines, with spare copies in case one fails
  - Spread ten billion daily reads over a day to get the per-second rate, and the share the cache misses is what the database must handle
  - Most reading is of posts from the last day or two, so caching just those may catch even more
followUps:
  - How do you keep the cache from being flushed by a bulk backfill job?
  - What TTL would you choose and why?
references:
  - title: Facebook, Scaling Memcache at Facebook (NSDI 2013)
    url: https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala
  - title: Wikipedia, Pareto principle
    url: https://en.wikipedia.org/wiki/Pareto_principle
updated: 2026-10-02
reviewed: true
---

Cache sizing is where you convert a vague "we'll cache it" into a number of nodes.

**Reads per second**
10 × 10^9 / 86,400 ≈ 1.16 × 10^5 → **~115,000 reads/s average**, ~300,000 at peak. No relational database serves that directly; the cache is not optional.

**How much to cache**
Access is skewed. The Pareto heuristic (20% of items get 80% of reads) is a reasonable default for content; real feeds are usually *more* skewed because recent posts dominate.

Hot set = 20% × 500 × 10^6 = **100 million posts**.
Payload = 100 × 10^6 × 1 KB = **100 GB**.
Add overhead for keys, pointers, expiry metadata and fragmentation, typically 30–50%: **~150 GB**.

**Nodes**
Memory per cache node is commonly 64–256 GB usable. 150 GB fits in **2–3 nodes**, or one large node, but you want at least 3 for availability and to spread the ~300,000 peak requests per second (a Redis node handles roughly 100,000–200,000 simple GETs per second). Use consistent hashing across nodes and a replica per shard.

**Remaining database load**
Misses = 20% × 115,000 ≈ **23,000 reads/s average**, ~60,000 at peak. Still heavy: this points at read replicas (each handling perhaps 10,000–20,000 point reads per second) or a wide-column store designed for the volume. If the cache hit rate reaches 95%, the database sees ~6,000/s average, which is a very different infrastructure bill, so measuring and improving hit rate pays off directly.

**A better partition.** Instead of "20% of all posts", cache **everything from the last 48 hours**: if posting rate is ~5 million/day, that is 10 million posts, 10 GB, and likely serves >90% of reads because feeds show recent content. Cheaper and a higher hit rate. Say both approaches and pick the recency-based one.

**Protecting the cache.** A nightly backfill reading all 500 million posts would evict the hot set. Bypass the cache for batch jobs, or use an admission policy that only caches items on their second request.
