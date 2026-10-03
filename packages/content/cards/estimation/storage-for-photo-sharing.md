---
id: storage-for-photo-sharing
deck: estimation
type: estimation
difficulty: 2
tags: [estimation, storage]
prompt: >
  A photo-sharing app has 50 million daily active users; 10% upload two
  photos a day at ~2 MB each. Estimate daily and five-year storage, including
  thumbnails and replication.
keyPoints:
  - Uploads per day, 50M × 10% × 2 = 10 million photos per day
  - Raw storage, 10M × 2 MB = 20 TB per day, about 7 PB per year
  - Derivatives add ~10-20% (a few thumbnails at 20-200 KB each)
  - Replication factor of 3 (or erasure coding ~1.5x) multiplies the total, so plan roughly 25-60 PB over five years
  - Metadata is negligible by comparison, 10M × ~500 bytes ≈ 5 GB per day
eli5:
  - Multiply users by the share who upload by photos each to get photos per day
  - Multiply photos by their size for a day's storage, then by 365 for a year
  - Small preview versions of each photo add a little on top
  - Keeping several copies for safety multiplies everything, so the five-year total runs to tens of petabytes
  - The facts about each photo take almost no room next to the photos themselves
followUps:
  - How would lifecycle tiering to cold storage change the cost estimate?
  - What does the per-day write bandwidth come to, and does it stress the network?
references:
  - title: AWS docs, Amazon S3 storage classes
    url: https://aws.amazon.com/s3/storage-classes/
  - title: Facebook, Finding a needle in Haystack (OSDI 2010)
    url: https://www.usenix.org/legacy/event/osdi10/tech/full_papers/Beaver.pdf
updated: 2026-10-02
reviewed: true
---

Storage estimates are about finding the one term that dominates and then applying multipliers honestly.

**Uploads per day**
50 × 10^6 DAU × 0.10 uploaders × 2 photos = 10 × 10^6 = **10 million photos/day**, about 115 per second on average, maybe 400/s at peak.

**Raw bytes per day**
10^7 × 2 MB = 2 × 10^7 MB = **20 TB/day**.

**Per year and five years**
20 TB × 365 ≈ 7.3 PB/year → **~36 PB in five years**, raw, assuming flat growth (real products grow, so this is a floor).

**Derivatives**
Each photo gets, say, three resized versions: 20 KB, 100 KB and 400 KB ≈ 0.5 MB total, about 25% of the original. Call derivatives **+25%** → 25 TB/day, ~45 PB over five years.

**Replication and durability**
Three full replicas: ×3 → ~135 PB. Erasure coding (e.g. 10+4 Reed–Solomon) gives similar durability at ~1.4×, so ~63 PB. Managed object stores hide this but you pay for it in price per GB.

**Metadata**
10 million rows/day × ~500 bytes (ids, owner, timestamps, dimensions, object key, a few indexes) ≈ 5 GB/day, ~9 TB over five years. Trivial next to the blobs, but it lives in a database that must handle ~400 inserts/s and billions of rows, so it still needs sharding by user or by photo id eventually.

**Bandwidth check**
20 TB/day ≈ 230 MB/s average inbound, ~2 Gbps; peak perhaps 8 Gbps. Easily absorbed by object storage, but a reminder that uploads should go straight to the bucket via presigned URLs rather than through your API servers.

**Reading the result.** Blobs dominate by three orders of magnitude, so the design effort is in object storage, CDN and lifecycle tiering (photos older than a year are rarely viewed and can move to cheaper storage), not in the database.
