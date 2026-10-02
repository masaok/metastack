---
id: rate-limiter
deck: designs
type: design
difficulty: 2
tags: [rate-limiting, caching, api]
prompt: >
  Design a distributed rate limiter that enforces per-client limits across a
  fleet of API servers with low latency.
keyPoints:
  - Clarifies where it sits (gateway middleware vs library vs sidecar) and what the key is (API key, user, IP)
  - Picks an algorithm, typically token bucket or sliding window counter, and justifies the burst behaviour
  - Stores counters in a shared in-memory store (Redis) with atomic Lua scripts, sharded by client key
  - Returns 429 with Retry-After and RateLimit headers so clients can self-regulate
  - Handles store failure explicitly (fail open with a local backstop) and discusses the accuracy versus latency tradeoff
followUps:
  - How do you support tiered limits (free vs paid) and per-endpoint limits at the same time?
  - How would you rate limit by IP for unauthenticated traffic without punishing users behind one NAT?
stages:
  - name: Requirements
    keyPoints:
      - Limit requests per client per time window, across all servers, with configurable rules
      - Add under 1-2 ms latency, be highly available, and tell clients why they were limited
  - name: Estimates
    keyPoints:
      - Fleet handling 100k QPS means 100k limiter checks per second, each a tiny Redis op
      - Millions of active keys at ~100 bytes each is hundreds of MB, fits in memory
  - name: API
    keyPoints:
      - Internal, allow(key, rule) → allowed, remaining, resetAt
      - External, 429 Too Many Requests with Retry-After and RateLimit-Limit/Remaining/Reset headers
  - name: Data model
    keyPoints:
      - Rules, per client tier and endpoint, cached in each server and refreshed from a config store
      - Counters, Redis hash or sorted set per key with TTL slightly above the window
  - name: High-level design
    keyPoints:
      - Middleware in the API gateway calls a limiter client that talks to a sharded Redis cluster
      - Rules service pushes config, metrics emitted for throttled requests
  - name: Deep dives
    keyPoints:
      - Token bucket in a Lua script, read tokens and timestamp, refill, decrement, all atomically
      - Sliding window counter as the memory-cheap alternative to a sorted-set log
      - Hot keys and single-client floods handled by local pre-limiting
  - name: Bottlenecks and failure
    keyPoints:
      - Redis unavailability, fail open briefly with a conservative local limit and alert
      - Clock skew across servers if timestamps come from app servers, use Redis TIME
      - Race conditions avoided by atomic scripts, not read-then-write
references:
  - title: Stripe blog, Scaling your API with rate limiters
    url: https://stripe.com/blog/rate-limiters
  - title: Cloudflare blog, How we built rate limiting capable of scaling to millions of domains
    url: https://blog.cloudflare.com/counting-things-a-lot-of-different-things/
updated: 2026-10-02
reviewed: true
---

## Requirements

Enforce limits such as "1,000 requests per minute per API key" and "10 login attempts per hour per IP" consistently across every API server. Checks must add about a millisecond, the limiter must not become the outage, and clients need enough information to back off intelligently. Rules change without redeploys.

## Estimates

If the API fleet serves 100,000 requests/s, the limiter performs 100,000 checks/s. Each check is one small Redis command on one key, which a modest Redis cluster handles. With 10 million active keys at ~100 bytes each, counters take ~1 GB of memory.

## API

Internally the middleware calls `allow(key, rule) → { allowed, remaining, resetAt }`. Externally a rejected request gets `429 Too Many Requests` with `Retry-After: <seconds>` and `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` headers on every response.

## Data model

Rules live in a config store and are cached in every server: `{ scope: apiKey | ip | user, endpoint pattern, limit, window, burst }`. Counters live in Redis keyed by `rl:{ruleId}:{clientKey}` with a TTL slightly longer than the window so idle keys disappear.

## High-level design

```mermaid
flowchart LR
  C[Client] --> GW[API gateway + limiter middleware]
  GW -->|allow?| R[(Redis cluster, sharded by key)]
  GW --> S[Backend services]
  CFG[Rules config] --> GW
  GW --> M[Metrics]
```

The gateway loads rules, hashes the client key to a Redis shard, and runs an atomic script. Allowed requests proceed; rejected ones return 429 immediately.

## Deep dives

**Token bucket in Lua.** Store `tokens` and `last_refill` in a hash. The script reads both, adds `rate × elapsed` tokens up to `capacity`, and if `tokens ≥ 1` decrements and returns allowed. One round trip, atomic, and the bucket's state is two numbers. Use Redis `TIME` inside the script so app server clocks do not matter.

**Sliding window counter.** Keep counts for the current and previous fixed windows. Estimate = `current + previous × (overlap fraction)`. Two integers per key and smooth behaviour at boundaries; slightly approximate, which is fine for API quotas.

**Local pre-limiting.** A single abusive client can generate more checks than Redis wants to see. Each server keeps a tiny in-memory limiter per key as a first filter and only consults Redis when the local limiter allows.

**Multiple rules.** A request may match several (per key, per endpoint, per IP). Evaluate all; reject if any fails; report the most restrictive remaining count.

## Bottlenecks and failure modes

- **Redis down.** Decide explicitly: fail open (serve traffic, protect yourself with a local backstop) for a bounded time with loud alerts, or fail closed for abuse-sensitive endpoints like login.
- **Hot shard.** One client key always hashes to one shard; if a single client is 20% of traffic, that shard is hot. Local pre-limiting and giving huge clients dedicated limits mitigate it.
- **Accuracy vs latency.** A central store is exact; local-only is fast but allows N× the limit across N servers. The hybrid (lease batches of tokens) is the usual production answer.
- **Observability.** Count throttled requests per rule and per client; a sudden rise usually means a client bug or an attack.
