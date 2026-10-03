---
id: rate-limiting-algorithms
deck: fundamentals
type: concept
difficulty: 2
tags: [rate-limiting, api, data-structures]
prompt: >
  Compare token bucket, leaky bucket, fixed window and sliding window rate
  limiting. Which would you pick for a public API and why?
keyPoints:
  - Token bucket refills tokens at a steady rate up to a capacity, allowing short bursts while bounding the long-run rate
  - Leaky bucket processes at a fixed output rate and queues or drops excess, smoothing traffic but adding latency
  - Fixed window counters are cheap but allow double the limit at window boundaries
  - Sliding window log is exact but memory-heavy, sliding window counter approximates it with two buckets
  - For a public API, token bucket per client key with clear headers (limit, remaining, reset) is the usual choice
eli5:
  - A bucket slowly fills with tokens and each request spends one, so short bursts are fine but the long-run pace is capped
  - A bucket that drips at a fixed pace lets requests out evenly and makes extras wait or drops them
  - Counting per clock minute is cheap, but a caller can spend a full quota just before the minute turns and another just after
  - Remembering every request time is exact but costly, and blending the current and previous counts comes close for far less
  - For a public API the usual pick is a token bucket per caller, with headers that say how much is left and when it refills
distractors:
  - A token bucket forbids bursts, requests always leave at a constant rate
  - Fixed window counters are exact and never admit more than the limit around a window boundary
  - A sliding window log uses the least memory of the four, because it stores a single counter
followUps:
  - How do you communicate limits to clients and what status code do you return?
  - How would you implement token bucket with only a counter and a timestamp?
references:
  - title: Cloudflare blog, How we built rate limiting capable of scaling to millions of domains
    url: https://blog.cloudflare.com/counting-things-a-lot-of-different-things/
  - title: Stripe blog, Scaling your API with rate limiters
    url: https://stripe.com/blog/rate-limiters
updated: 2026-10-02
reviewed: true
---

Rate limiting protects a service from abusive or accidental overload and keeps one client from starving others. The algorithms differ in how they treat bursts and how much state they keep.

**Token bucket.** A bucket holds up to *capacity* tokens and refills at *r* tokens per second. Each request takes a token; no token, no request. Clients can burst up to the capacity after an idle period, but over time cannot exceed *r*. State per key: a token count and a last-refill timestamp, which makes it cheap and lazy to compute. This is what most API gateways use.

**Leaky bucket.** Requests enter a queue that drains at a fixed rate. Output is perfectly smooth, which is ideal when a downstream can only take N per second, but excess requests wait (adding latency) or are dropped once the queue is full.

**Fixed window.** Count requests per key in each wall-clock minute. Trivial to implement with `INCR` and `EXPIRE`, but a client can send the full limit at 12:00:59 and again at 12:01:00, doubling the intended rate at the boundary.

**Sliding window log.** Store a timestamp per request and count those within the last window. Exact, but memory grows with the limit and the number of keys.

**Sliding window counter.** Keep the current and previous fixed-window counts and weight the previous one by how much of it still overlaps the sliding window. Nearly exact with two integers per key; Cloudflare uses this.

**Public API recommendation.** Token bucket keyed by API key (and perhaps a second, larger bucket per IP for unauthenticated traffic). Return `429 Too Many Requests` with `Retry-After`, and expose `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` headers so well-behaved clients can back off before hitting the wall.

Name the algorithm, its burst behaviour, its state size, and how the client finds out.
