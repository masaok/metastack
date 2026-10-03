---
id: server-count-from-qps
deck: estimation
type: estimation
difficulty: 2
tags: [estimation, scalability, availability]
prompt: >
  Your API must serve 60,000 peak QPS with a p99 under 200 ms. Each request
  takes ~50 ms of service time on one core. How many servers do you need?
keyPoints:
  - Little's law, concurrency = throughput × latency, 60,000 × 0.05 s = 3,000 requests in flight at peak
  - One core at 100% utilisation does 1 / 0.05 = 20 req/s, so 3,000 cores at full load
  - Never plan for 100% utilisation, target 50-70% so queueing delay stays low, giving ~4,500-6,000 cores
  - With 32-core servers that is ~150-200 servers, plus N+1 or N+2 per availability zone for failure headroom
  - Verify by load testing, the 50 ms figure hides I/O waits that let one core overlap many requests
eli5:
  - Requests in progress at any moment equal how many arrive per second times how long each one takes
  - One processor core that is never idle finishes twenty of these a second, so the peak needs three thousand cores
  - Aim to keep machines about half to two-thirds busy, or requests start queueing, which raises the core count
  - Divide the cores by cores per server, then add one or two spare servers in each location
  - Test under real load, because a request that mostly waits on other things does not occupy a core the whole time
distractors:
  - A core that needs 50 ms per request handles 200 requests per second
  - Plan for 100% CPU utilisation so that no capacity is wasted
  - 60,000 QPS at 50 ms each means 300 requests in flight
followUps:
  - How does the estimate change if 40 of the 50 ms are spent waiting on a database call?
  - Why does p99 latency explode as utilisation approaches 100%?
references:
  - title: Wikipedia, Little's law
    url: https://en.wikipedia.org/wiki/Little%27s_law
  - title: Google SRE Book, Chapter 2, Handling overload
    url: https://sre.google/sre-book/handling-overload/
updated: 2026-10-02
reviewed: true
---

Server counts come from one formula and one rule: Little's law, and never run hot.

**Little's law**
Concurrency (L) = arrival rate (λ) × time in system (W).
L = 60,000 req/s × 0.05 s = **3,000 requests in flight** at peak.

**Cores at full utilisation**
If each request consumes 50 ms of a core, a core handles 1 / 0.05 = 20 req/s.
60,000 / 20 = **3,000 cores** at 100% busy.

**Headroom**
Queueing theory says latency grows roughly as 1 / (1 − utilisation). At 50% utilisation requests wait on average one extra service time; at 90% they wait nine. To hold a 200 ms p99 with 50 ms service time you want utilisation around 50–70%.
3,000 / 0.6 ≈ **5,000 cores**.

**Servers**
On 32-core machines: 5,000 / 32 ≈ **~160 servers**. Spread across 3 availability zones, add capacity so losing a zone still leaves you under 70% utilisation: ~160 × 1.5 ≈ **240 servers**, or 80 per zone.

**CPU-bound vs I/O-bound**
The estimate above assumes the 50 ms is CPU time. If 40 ms of it is waiting on a database or downstream call, a core can overlap many requests (async or threaded), and the real limit becomes the number of concurrent requests you allow per server and the downstream's capacity. Then each server might handle 1,000 concurrent requests, and 3,000 in flight needs only a handful of servers plus a database that can absorb 48,000 QPS, which is the harder problem. Always ask which resource the 50 ms is consuming.

**Sanity check**
160–240 mid-size servers for 60,000 QPS is reasonable for a service doing real work per request. If the math had come out at 10,000 servers you would go back and question the 50 ms, and if it came out at 5 you would question the QPS.

End by saying you would confirm the per-request cost with a load test before buying anything.
