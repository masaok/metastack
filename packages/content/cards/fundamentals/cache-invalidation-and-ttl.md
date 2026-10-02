---
id: cache-invalidation-and-ttl
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [caching, consistency]
prompt: >
  How do you keep a cache consistent with its source of truth? Compare TTL
  expiry, explicit invalidation and versioned keys.
keyPoints:
  - TTL bounds staleness with zero coordination but serves stale data until expiry and causes synchronized misses
  - Explicit invalidation (delete on write) gives fresher data but every write path must know about the cache
  - Versioned or content-hashed keys sidestep invalidation entirely, old versions simply stop being requested
  - Delete-then-write and write-then-delete races can leave stale data in the cache under concurrency
  - Jittered TTLs and request coalescing prevent stampedes when many keys expire together
followUps:
  - Walk through the race where a reader repopulates stale data after an invalidation.
  - How would you invalidate across a multi-region CDN?
references:
  - title: Facebook, Scaling Memcache at Facebook (NSDI 2013)
    url: https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala
  - title: MDN, HTTP caching
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching
updated: 2026-10-02
reviewed: true
---

Every cache is a copy, and copies drift. There are three broad ways to manage that drift, and good answers combine them.

**1. TTL expiry.** Each entry carries a lifetime. Simple, needs no coordination, and works across organisational boundaries (this is how HTTP `Cache-Control: max-age` works). The downside is a staleness window as long as the TTL, plus thundering-herd behaviour when many entries expire at once. Mitigations: jitter the TTL, serve stale while revalidating in the background, and coalesce concurrent misses for the same key.

**2. Explicit invalidation.** When the source changes, delete (or update) the cached entry. Data is fresh within milliseconds, but now every writer has to know the cache exists, and distributed writers introduce races:

```text
Reader: miss, reads v1 from DB (slow)
Writer: writes v2 to DB, deletes cache key
Reader: finally sets cache = v1   <- stale until TTL
```

Facebook's memcache paper handles this with *leases*: a miss hands the reader a token, and a delete invalidates outstanding tokens so a late set is rejected. Short TTLs as a backstop are still wise.

**3. Versioned keys.** Put a version or content hash in the key (`user:42:v17`, `app.3f9a1c.js`). Writers bump the version in a small, authoritative place; readers look the version up and then fetch an immutable value that can be cached forever. Nothing is ever invalidated, old entries just age out. This is why static assets use hashed filenames.

Pick by asking: how stale can this data be, who writes it, and can readers cheaply learn the current version?
