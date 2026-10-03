---
id: distributed-rate-limiting
deck: fundamentals
type: tradeoff
difficulty: 3
tags: [rate-limiting, caching, consistency]
prompt: >
  Your API runs on 50 instances behind a load balancer. How do you enforce a
  per-customer rate limit across all of them? Compare the options.
keyPoints:
  - A centralised counter in Redis (atomic INCR or a Lua token bucket script) is accurate but adds a network hop and a dependency to every request
  - Local in-memory limits per instance are fast but let a client get N times the limit, acceptable if traffic is evenly spread
  - Hybrid, each instance takes a local allowance and periodically syncs with the central store, trading exactness for latency
  - Sticky routing by customer key makes a local limiter accurate but creates hot instances
  - Decide fail-open or fail-closed when the limiter store is unreachable
eli5:
  - One shared counter is exact, but every request has to make a trip to it and depends on it being up
  - A counter on each server is fast, but a caller spread over ten servers gets ten times the limit
  - In between, each server takes a small allowance and checks in with the shared counter now and then, giving up some exactness for speed
  - Always sending a customer to the same server makes its local counter correct, but busy customers overload that server
  - Decide ahead of time whether to let everyone in or block everyone when the counter cannot be reached
distractors:
  - Per-instance in-memory limits enforce the global limit exactly, however requests are spread
  - A central Redis counter adds no latency or failure mode, because it is in memory
  - When the limiter store is down the only safe behaviour is to reject every request
followUps:
  - How do you make the Redis check-and-decrement atomic?
  - What happens to your limits during a Redis failover?
references:
  - title: Stripe blog, Scaling your API with rate limiters
    url: https://stripe.com/blog/rate-limiters
  - title: Redis docs, Rate limiting pattern
    url: https://redis.io/glossary/rate-limiting/
updated: 2026-10-02
reviewed: true
---

A single-process limiter is easy. Fifty processes that each see a random slice of a customer's traffic is where the design questions start.

**Option 1: centralised store.** Every instance checks a shared counter in Redis before serving a request. Use `MULTI`/`EXEC` or a Lua script so the read-check-decrement is atomic; a token bucket fits in a hash with `tokens` and `updated_at`. Accuracy is exact and limits are enforced globally. Costs: a round trip (~0.5–1 ms in-region) on the hot path, and Redis becomes a tier-1 dependency. Shard Redis by customer key for throughput.

**Option 2: local limiters.** Each instance enforces `limit / 50` in memory. Zero latency, no dependency. If the balancer spreads a customer's requests evenly, the aggregate is right; if not (a customer with few connections, or instances that scale in and out), the effective limit swings from under to several times the target. Fine for coarse protection, poor for a billed quota.

**Option 3: hybrid.** Instances claim a batch of tokens from the central store (say 10% of the customer's limit) and spend them locally, returning to the store when the batch runs out. Most requests pay no network cost, and the global error is bounded by the batch size. Stripe and many gateways run this kind of scheme.

**Option 4: sticky routing.** Hash the customer key at the load balancer so all of a customer's traffic hits one instance, making a local limiter exact. Works until a single huge customer overwhelms one box.

**Failure policy.** When the store is down, do you fail open (serve everyone, risk overload) or closed (reject everyone, guaranteed outage)? Most APIs fail open for a short time with alerts, while protecting themselves with a conservative local backstop limit.

Lay out the tradeoff triangle (accuracy, latency, dependency), pick the hybrid for billed quotas, and say what happens when Redis dies.
