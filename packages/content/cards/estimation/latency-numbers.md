---
id: latency-numbers
deck: estimation
type: estimation
difficulty: 1
tags: [estimation, latency]
prompt: >
  Recite the latency ladder from an L1 cache hit to a cross-continent round
  trip, to within an order of magnitude. Which steps change a design?
keyPoints:
  - L1 cache ~1 ns, main memory ~100 ns, so memory is about 100x slower than L1
  - SSD random read ~100 µs, HDD seek ~10 ms, so disk is 1,000 to 100,000x slower than memory
  - Same-datacenter round trip ~0.5 ms, cross-continent round trip ~100-150 ms
  - Reading 1 MB sequentially, memory ~10 µs, SSD ~1 ms, over a 1 Gbps network ~10 ms
  - Design consequences, keep hot data in memory, batch disk and network calls, and never put a cross-region hop on a synchronous path
followUps:
  - Why is a single cross-region call often worse than ten in-region calls?
  - How does compression change the network row of this table?
references:
  - title: Jeff Dean, Numbers everyone should know (via Jonas Bonér's gist)
    url: https://gist.github.com/jboner/2841832
  - title: Colin Scott, Interactive latency numbers every programmer should know
    url: https://colin-scott.github.io/personal_website/research/interactive_latency.html
updated: 2026-10-02
reviewed: true
---

You will never be asked for exact figures, but you will be expected to know the *shape* of the ladder: each rung is roughly 10 to 1,000 times slower than the one before.

| Operation | Approximate time | Relative |
| --- | --- | --- |
| L1 cache reference | 1 ns | 1 |
| Branch mispredict | 3 ns | 3 |
| L2 cache reference | 4 ns | 4 |
| Mutex lock/unlock | 20 ns | 20 |
| Main memory reference | 100 ns | 100 |
| Compress 1 KB (fast codec) | 2 µs | 2,000 |
| Send 1 KB over 10 Gbps network | 1 µs | 1,000 |
| Read 1 MB sequentially from memory | 10 µs | 10,000 |
| SSD random read (4 KB) | 100 µs | 100,000 |
| Read 1 MB sequentially from SSD | 1 ms | 1,000,000 |
| Round trip within a datacenter | 0.5 ms | 500,000 |
| HDD seek | 10 ms | 10,000,000 |
| Read 1 MB sequentially from HDD | 20 ms | 20,000,000 |
| Round trip California to Netherlands | 150 ms | 150,000,000 |

**Human scale.** If an L1 hit took one second, memory would take two minutes, an SSD read a day, a datacenter round trip a week, a disk seek four months, and a transatlantic round trip five years.

**What it means for design**

- Anything served from memory (caches, in-process data) is effectively free compared to anything that touches disk or network. This is why caching dominates read-path design.
- A request that makes ten sequential same-region calls spends ~5 ms in network alone; do them in parallel.
- One synchronous cross-region call costs as much as 300 in-region ones. Replicate data to where the users are instead.
- Sequential disk reads are fast; random ones are not. Log-structured storage exists because of this row.
- Sending a megabyte across a 1 Gbps link takes ~10 ms, so compressing payloads is worth it over WAN but rarely within a rack.

Say the ladder in three groups: nanoseconds (CPU and memory), microseconds (SSD, LAN), milliseconds (disk, WAN).
