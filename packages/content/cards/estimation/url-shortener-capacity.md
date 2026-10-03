---
id: url-shortener-capacity
deck: estimation
type: estimation
difficulty: 1
tags: [estimation, storage, databases]
prompt: >
  A URL shortener creates 100 million links a month with a 100:1 read-to-write
  ratio. Estimate write and read QPS, storage for 10 years, and how many
  characters the short code needs.
keyPoints:
  - Writes, 100M / (30 × 86,400 s) ≈ 40 per second, reads ≈ 4,000 per second, both modest
  - Storage, 100M × 12 × 10 = 12 billion rows at ~500 bytes ≈ 6 TB over ten years
  - Short code, base62 with 7 characters gives 62^7 ≈ 3.5 trillion codes, enough for centuries, 6 characters gives 57 billion which is tight
  - Read path is cache-friendly, a cache of the hottest 20% of links (a few hundred GB) covers most reads
  - The numbers argue for a simple design, one database with replicas and a cache, not a distributed system
eli5:
  - Spread a month's new links over the seconds in a month and you get a few dozen a second, with clicks a hundred times that, and neither is much
  - Ten years of links at half a kilobyte each comes to a few terabytes
  - Seven characters drawn from sixty-two symbols give trillions of codes, while six characters would run short
  - A small share of links get most of the clicks, so keeping those in fast memory answers most requests
  - Numbers this small call for one database with copies and a cache, and nothing fancier
distractors:
  - text: 100 million links a month is about 4,000 writes per second
    why: 100 million divided by about 2.6 million seconds in a month is about 40 per second. 4,000 is the read rate
  - text: Four base62 characters give 62^4, about 15 billion codes, which is plenty
    why: 62^4 is about 15 million, which would run out in days. Seven characters give 3.5 trillion
  - text: These numbers call for a sharded, multi-region database from day one
    why: 40 writes and 4,000 reads a second fit one database with replicas and a cache
followUps:
  - If you used an auto-incrementing id encoded in base62, what would you leak and how would you avoid it?
  - At what scale does this design need sharding?
references:
  - title: Wikipedia, Base62
    url: https://en.wikipedia.org/wiki/Base62
  - title: Donne Martin, System design primer, Design Pastebin
    url: https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/pastebin/README.md
updated: 2026-10-02
reviewed: true
---

The URL shortener is the canonical warm-up because the math shows it is small, and recognising that is the point.

**Write QPS**
100 × 10^6 per month / (30 days × 86,400 s ≈ 2.6 × 10^6 s) ≈ **40 writes/s**. Peak maybe 100/s.

**Read QPS**
100:1 → **~4,000 reads/s**, peak ~10,000/s. A single well-cached service handles this comfortably.

**Storage over ten years**
100M × 12 months × 10 years = 1.2 × 10^10 = **12 billion rows**.
Per row: short code (7 bytes), long URL (~200–500 bytes), user id, created and expiry timestamps, click count ≈ **~500 bytes**.
12 × 10^9 × 500 B = 6 × 10^12 B = **6 TB**. Large for one disk, trivial for object or distributed storage, and fine for a sharded relational database or a key-value store.

**Short code length**
Base62 (a–z, A–Z, 0–9):

| Length | Combinations |
| --- | --- |
| 5 | 62^5 ≈ 916 million |
| 6 | 62^6 ≈ 57 billion |
| 7 | 62^7 ≈ 3.5 trillion |

Ten years needs 12 billion codes, so 6 characters is possible but leaves little headroom and makes random generation collide often. **7 characters** is the usual answer: random codes rarely collide (12 × 10^9 / 3.5 × 10^12 ≈ 0.3% occupancy) and the URL stays short.

**Cache sizing**
If 20% of links get 80% of reads, caching the hot 20% of one year's links (240M × 500 B ≈ 120 GB) fits a modest Redis cluster and shaves most reads off the database.

**Conclusion to state out loud.** "Tens of writes and thousands of reads per second with single-digit terabytes: this is one primary database with read replicas and a cache in front. The interesting parts are id generation, the 301 vs 302 redirect choice, and analytics, not scale."
