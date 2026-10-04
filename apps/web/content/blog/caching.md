---
slug: caching
title: Caching for system design interviews
description: Caching for system design interviews. What a cache may get wrong, write policies in one table, and invalidation you can run.
primaryKeyword: caching
category: caching-and-storage
tags:
  - caching
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Caching for system design interviews is the question of what a copy is allowed to get wrong. A cache answers a read without touching the source of truth. That is the gain. The copy can be stale, missing, or lost. Say which of those you will accept before you draw the box.

## What a cache is allowed to get wrong

A cache is not a second primary. It does not have to survive a node death unless you chose a write policy that acknowledged the write only in the cache. It does not have to return the latest value unless you chose a policy that updates or deletes the copy on every write.

Staleness is the usual allowance. A redirect target that is a few seconds old is fine. A balance that is a few seconds old is not. Name the object. Name the window. A TTL is a bound on that window, not a promise of freshness. Data can change the moment after you store the copy.

A miss is also allowed. The source of truth still has the row. A miss is slower, not wrong, if you can take the load. Size the store for a short cache outage, or fail some reads on purpose. The [URL shortener](/blog/design-url-shortener) design does this on the read path. The database must survive the full read load for a few minutes, or you shed.

Loss is allowed only when the write already landed in the store, or when losing the write is acceptable. A write-behind cache that dies before flush loses acknowledged writes. That is not an allowed miss. That is data loss. Say so.

Cache-aside is the default read pattern. The application checks the cache. On a miss it reads the store and fills the cache. The store remains the source of truth. Interviewers expect that pairing unless you name a different policy and why.

What you must not claim. That a short TTL means readers never see stale data. That a cache makes writes faster under write-through. That personalised pages cache like public images. Those three claims fail cards.

## Aside, through, and behind in one table

The write policy decides what happens to the cache when data changes. That single decision is your consistency, write latency, and durability story. Cache-aside is the read side. Write-around, write-through, and write-behind are the write side. Aside usually pairs with write-around.

| Policy | Where the write goes | Read after the write | If the cache dies |
| --- | --- | --- | --- |
| Aside with write-around | Store only. Cache fills on read. | First read misses, then fills. | Durable. The store has the write. |
| Write-through | Cache and store, both before ack. | Hit. The copy is fresh. | Durable. The store has the write. Writes are slower. |
| Write-behind | Cache first. Store later, often batched. | Hit. The copy is fresh. | Unflushed writes are gone unless you replicated the cache or kept a log. |

Write-through fits read-heavy data that is updated and then read again soon. The extra write latency buys a warm, correct copy. You may also cache keys nobody will read.

Write-behind fits write-heavy counters, metrics, or cart-style data where losing a few seconds is acceptable, or where you can replicate the cache. The store sees fewer writes because you coalesce. The crash story has to be in the same breath.

Write-around, with cache-aside reads, fits write-once bulk data and high write volume where most keys are never read again. Logs and uploads belong here. They must not evict the hot set.

The [caching-write-strategies card](/cards/caching-write-strategies) asks you to tie the choice to the read/write ratio and to the cost of losing a write. Then say how you recover from cache failure under each policy. Write-through and write-around recover by reading the store. Write-behind recovers only if the cache was replicated or the write log survived.

A burst of writes to one key under write-through hits both systems on every request. Under write-behind the cache can coalesce. Under write-around the cache stays out of the way and the store takes the burst. Pick from that, not from a favourite product.

## Where a cache sits in a typical drawing

Put the cache where the repeated read is. Do not put it on a path that must be correct on the first write.

On a URL shortener the cache sits on `GET /{code}`. The value is the long URL and the expiry. A hit returns 302. A miss loads the primary key and fills. Creates do not have to warm the cache. The first redirect can. Drop the entry when the link changes, disappears, or expires. A 301 would hide later clicks from you and freeze an old target in browsers. That is a cache you do not control.

On a news feed the cache is the per-user list of post ids, plus a post-body cache used at hydrate time. The durable post lives in the post store. Copying bodies into every follower list multiplies storage by the follower count. The [news feed](/blog/design-news-feed) post is the drawing. Ranking still runs after you have a candidate set. The cache is not the ranker.

On a notification or a payment path the cache is usually not the first box. Those designs are about queues, keys, and a ledger. A preference cache is fine. A cached ledger balance needs a version. Do not hide the book behind a cache and call the cache the source of truth.

On a typical HTTP drawing the cache may appear three times. A browser cache. A CDN or edge. An application cache such as Redis in front of the store. They have different keys, different TTLs, and different owners. Name which one you mean. Invalidating your Redis key does not purge the edge.

Placement follows the hash of the key when the cache is a cluster. A hot key still lives on one node unless you add a local layer or a CDN in front. Virtual nodes move about `1/N` of keys when you add a node. They do not split one viral key.

If the whole cache tier is down, say what the store will see. Either it can take the full read load for a short time, or you return a degraded response. Silence on that point is a hole.

## Invalidation you can actually run

Every cache is a copy, and copies drift. Three ways to manage the drift. Good answers combine them.

TTL expiry. Each entry has a lifetime. No coordination. Works across teams. This is HTTP `Cache-Control: max-age`. The staleness window is as long as the TTL. Keys filled together expire together if the TTL is identical. That is a stampede. Jitter the TTL. Serve stale while one worker refills. Coalesce concurrent misses for the same key so the store sees one read.

Explicit invalidation. On write, delete or update the cached entry. Freshness is milliseconds if every writer remembers. Distributed writers introduce a race. A reader can miss, load the old value slowly, and fill after a writer has already put the new value in the store and deleted the key. The late fill puts v1 back. The [cache-invalidation-and-ttl card](/cards/cache-invalidation-and-ttl) walks that order. Delete-then-write and write-then-delete both lose under concurrency. A short TTL is still the backstop. Leases, as in the memcache paper the card cites, let a delete invalidate outstanding fill tokens so a late set is rejected.

Versioned or hashed keys. Put a version in the name. `user:42:v17`. `app.3f9a1c.js`. Writers bump a small authoritative version. Readers learn the version, then fetch an immutable value that can live forever. Old keys stop being requested. They age out. You do not invalidate them. Static assets work this way.

Pick by asking how stale the data may be, who writes it, and whether readers can cheaply learn the current version. A public profile can use a TTL. A username change can delete a key. A built JavaScript bundle should use a hash in the filename.

Multi-region and CDN invalidation are slower cousins of the same three tools. A purge has to reach every PoP. A short TTL plus a versioned URL is often faster than a global delete you cannot prove finished. The CDN post is the place for edge TTL. Here, say that an application delete does not reach the browser.

What you can actually run is a delete on the keys you know, a TTL on everything, and versions on objects you can rename. A design that requires every microservice to remember every cache key will miss one writer. Prefer versions when you control the name. Prefer TTL when you do not.

## The MetaStack cache cards, in the order to drill them

Drill write policy first. The [caching-write-strategies card](/cards/caching-write-strategies) compares write-through, write-back, and write-around. Hit these points. Write-through updates cache and store before ack, so reads are consistent and writes are slower. Write-back acknowledges from the cache and flushes later, so writes are fast and a crash can lose data. Write-around writes the store only and fills on read, so write-once data does not pollute the cache. Tie the pick to read/write ratio and durability. Mention that write-around usually pairs with cache-aside reads.

Follow-ups on that card. How you make write-back safe against a cache node crash. What happens to write-through under a burst to one key. Replication or a durable log is the crash answer. Two synchronous writes per request is the burst answer.

Then drill invalidation. The [cache-invalidation-and-ttl card](/cards/cache-invalidation-and-ttl) asks how you keep a cache consistent with its source of truth. TTL bounds staleness with no coordination and causes synchronized misses. Explicit invalidation is fresher and requires every write path to know the cache. Versioned keys sidestep invalidation. Races can restore stale data. Jitter and coalescing prevent stampedes.

Follow-ups there. Walk the race where a reader repopulates stale data after an invalidation. How you would invalidate across a multi-region CDN. Speak the timeline. Then say purge plus TTL, or versioned URLs.

Later cards in this cluster sit beside these two. Eviction policy is a different question. Redis as a product is a different question. A distributed cache design is a different prompt. Do not fold them into this answer. Get the write policy and the invalidation race clean first.

Start on the [fundamentals study page](/study/fundamentals). Run write strategies until the table above comes out in your own words. Run invalidation until the late-fill race comes out without looking. Then [open the study page](/study) and keep both cards in the same week as the shortener and the feed.
