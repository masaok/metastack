---
id: powers-of-two-and-data-sizes
deck: estimation
type: estimation
difficulty: 1
tags: [estimation, storage]
prompt: >
  Give the powers of two that matter for capacity planning, and typical sizes
  for common objects such as an integer, a UUID, a tweet, a web page and a
  photo.
keyPoints:
  - 2^10 ≈ 1 thousand (KB), 2^20 ≈ 1 million (MB), 2^30 ≈ 1 billion (GB), 2^40 ≈ 1 trillion (TB)
  - 2^32 ≈ 4.3 billion fits in 4 bytes, 2^64 is effectively unlimited for ids
  - Small objects, char 1 byte, int 4 bytes, long and timestamp 8 bytes, UUID 16 bytes
  - Medium objects, a short text post ~300 bytes, a JSON API response ~1-10 KB, a web page ~2 MB with assets
  - Media, a compressed photo ~200 KB to 3 MB, a minute of 1080p video ~50-100 MB
eli5:
  - Every ten doublings is roughly a thousand times more, which gives thousand, million, billion and trillion at 10, 20, 30 and 40
  - Four bytes can count to about four billion, and eight bytes can count higher than you will ever need
  - A letter takes one byte, a whole number four, a big number or a timestamp eight, and a random id sixteen
  - A short post is a few hundred bytes, an API reply is a few thousand, and a full web page is a couple of million
  - A photo is from a fifth of a megabyte to a few megabytes, and a minute of sharp video is fifty to a hundred
followUps:
  - Why do ids often use 8 bytes even when 4 would do today?
  - How does the 2 MB web page figure affect CDN and bandwidth estimates?
references:
  - title: HTTP Archive, Page weight report
    url: https://httparchive.org/reports/page-weight
  - title: Wikipedia, Power of two
    url: https://en.wikipedia.org/wiki/Power_of_two
updated: 2026-10-02
reviewed: true
---

Estimation is multiplication, and multiplication is easy when you round to powers of ten and know a few object sizes by heart.

**Powers of two**

| Power | Exact | Approximate | Name |
| --- | --- | --- | --- |
| 2^10 | 1,024 | 1 thousand | kilo (KB) |
| 2^20 | 1,048,576 | 1 million | mega (MB) |
| 2^30 | 1.07 × 10^9 | 1 billion | giga (GB) |
| 2^40 | 1.1 × 10^12 | 1 trillion | tera (TB) |
| 2^50 | 1.1 × 10^15 | 1 quadrillion | peta (PB) |

Also useful: 2^32 ≈ 4.3 billion (an unsigned 32-bit id runs out faster than you think), 2^64 ≈ 1.8 × 10^19 (never runs out).

**Primitive sizes.** `char` 1 byte; `int` 4 bytes; `long`, `double` and a millisecond timestamp 8 bytes; UUID 16 bytes (36 as a string). A row with ten such columns plus overhead is roughly 100 bytes.

**Typical objects**

| Object | Size |
| --- | --- |
| Short text post or chat message | 100–500 bytes |
| Email without attachments | 10–75 KB |
| JSON API response | 1–10 KB |
| Thumbnail image | 10–30 KB |
| Compressed photo (phone camera) | 1–3 MB |
| Full web page with all assets | ~2 MB |
| One minute of 1080p video | 50–100 MB |
| One hour of 4K video | ~20 GB |

**Using them.** 500 million posts per day × 300 bytes ≈ 150 GB/day of text, ≈ 55 TB/year. The same users uploading one 2 MB photo each is 1 PB/day, three orders of magnitude more. Media dominates storage; text dominates nothing. That single comparison tells you where the storage design effort goes.
