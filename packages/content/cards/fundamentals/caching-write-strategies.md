---
id: caching-write-strategies
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [caching, consistency, durability]
prompt: >
  Compare write-through, write-back and write-around caching. When would you
  pick each?
keyPoints:
  - Write-through writes to cache and store synchronously, so reads are consistent but writes are slower
  - Write-back (write-behind) acknowledges after writing the cache and flushes later, fast writes but data-loss risk on cache failure
  - Write-around writes to the store only and lets the cache fill on read, avoiding pollution from write-once data
  - Ties the choice to the read/write ratio and the durability the data needs
  - Mentions the usual pairing of write-around with cache-aside reads
eli5:
  - Write to the cache and the database together, so reads are always right but each write takes longer
  - Write to the cache now and the database later, which is fast but loses data if the cache dies first
  - Write only to the database and let the cache fill when someone reads, so data nobody reads never takes up cache room
  - Choose by how often data is read compared with written, and by how bad it would be to lose a write
  - Writing only to the database usually pairs with reads that check the cache and fill it on a miss
distractors:
  - Write-back is the safest choice for data that must never be lost, because the cache holds a second copy
  - Write-through makes writes faster because the cache absorbs them before the store
  - Write-around guarantees that a read straight after a write is served from the cache
followUps:
  - How would you make write-back safe against a cache node crash?
  - What happens to a write-through cache under a burst of writes to the same key?
references:
  - title: AWS ElastiCache docs, Caching strategies
    url: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html
  - title: Wikipedia, Cache (computing), Writing policies
    url: https://en.wikipedia.org/wiki/Cache_(computing)#Writing_policies
updated: 2026-10-02
reviewed: true
---

The write policy decides what happens to the cache when data changes, and that single decision controls your consistency, write latency and durability story.

**Write-through.** Every write goes to the cache and the backing store before the client gets an acknowledgement. Reads that follow always see fresh data and nothing is lost if the cache dies. The price is write latency equal to the slower of the two systems, and you may cache data that is never read.

**Write-back (write-behind).** The write lands in the cache, the client is acknowledged immediately, and the cache flushes to the store asynchronously, often batching and coalescing writes to the same key. Writes are very fast and the store sees less traffic. If a cache node is lost before flushing, so is the data, so this policy needs replication of the cache or a durable write log.

**Write-around.** Writes skip the cache and go straight to the store; the cache is only populated when something is read (cache-aside). This keeps write-once, read-rarely data such as logs or uploads from evicting hot items, at the cost of a guaranteed miss on the first read after a write.

**How to choose**

- Read-heavy with hot data that is updated and then re-read soon: write-through.
- Write-heavy counters, metrics, shopping-cart style data where losing a few seconds is acceptable or you can replicate the cache: write-back.
- Write-once bulk data, or a very high write volume where most keys are never read again: write-around.

Interviewers usually want to hear you tie the policy to the read/write ratio and the cost of staleness, then mention how you would recover from cache failure under each policy.
