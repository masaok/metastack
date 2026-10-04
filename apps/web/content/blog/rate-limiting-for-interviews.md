---
slug: rate-limiting-for-interviews
title: Rate limiting for system design interviews
description: Rate limiting for system design interviews. Token bucket, leaky bucket, and fixed windows, plus how a limit stays correct across more than one server.
primaryKeyword: rate limiting
secondaryKeywords:
  - design rate limiter
  - token bucket
category: traffic-and-reliability
tags:
  - fundamentals
  - designs
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

A rate limiter decides whether this request is allowed right now. Rate limiting applies that decision before the work runs. Offer a token bucket as the default. A full bucket allows a short burst. A steady refill then holds the long-run rate. The bucket fails when the next hop cannot absorb a burst. A leaky bucket is the smoother choice there. The bucket also fails to stay exact once many servers each keep a private copy.

## What each algorithm allows

Rate limiting protects a service from abusive or accidental overload. It also keeps one client from starving the others. Name the algorithm, the burst, the state size, and how the client finds out.

A token bucket holds up to a capacity of tokens. It refills at a steady rate. Each allowed request spends one token. An empty bucket rejects the request. Idle time lets the client burst up to the capacity. Over a long run the client cannot beat the refill rate. You store a token count and a last-refill timestamp. Most API gateways use this pair.

A leaky bucket queues requests and drains them at a fixed rate. Output is smooth. Use it when a downstream can take only N per second. Waiting requests add latency. A full queue drops the rest.

A fixed window counts requests per key inside each wall-clock interval. `INCR` and `EXPIRE` are the whole implementation. A client can spend the full limit at the end of one window and again at the start of the next. The rate doubles at that tick.

A sliding window log stores a timestamp per request. You count the timestamps inside the last window. The count is exact. Memory grows with the limit and with the number of keys.

A sliding window counter keeps the current count and the previous count. You weight the previous count by the fraction that still overlaps the sliding window. Two integers come close to the log. Cloudflare uses this approximation.

For a public API, use a token bucket per API key. Add a larger bucket per IP for callers with no key. The [token bucket and window comparison](/cards/rate-limiting-algorithms) is the card for this choice.

## A token bucket with a burst of 20

Allow the client 10 requests per second. Allow a burst of 20. The refill rate is 10 tokens per second. The capacity is 20.

Start the client idle. The bucket is full. It holds 20 tokens.

The client sends 20 requests at one instant. Each request takes one token. The bucket hits 0. You allow all 20. A 21st request at that same instant finds an empty bucket. You reject it.

Refill is lazy. The next request adds `rate × elapsed`, capped at capacity.

Idle for 1 second from empty. Added tokens are 10. The bucket holds 10. The client can send 10 requests. The 11th request fails until more time passes.

Idle for 2 seconds from empty. Added tokens are 20. The capacity holds the bucket at 20. Further idle time adds nothing. The client can burst 20 again.

Keep the client busy after the opening burst. That burst already spent 20 stored tokens. Over the next 10 seconds the refill adds 100 tokens. Spending them brings the total to 120 requests. The long-run rate sits on 10 per second.

Store `tokens` and `last_refill`. On each check, add `rate × elapsed` and cap at the capacity. Subtract one when a token remains. Make that one atomic update. A separate read and a later write race. Two requests can both pass on the last token.

## Why a fixed window lets 20 through

Keep the same promise of 10 requests per second. Implement it as a fixed window of 1 second with a limit of 10.

Second 0 runs from t = 0 up to t = 1. Second 1 starts at t = 1. Each window owns a counter that starts at 0.

At t = 0.9 the client sends 10 requests. The counter for second 0 becomes 10. You allow all 10. Another request in that second fails.

At t = 1.0 the window rolls. The new counter is 0. The client sends 10 more requests. You allow all 10.

The service accepted 20 requests between t = 0.9 and t = 1.0. That span is a tenth of a second. The promised rate was 10 per second. The boundary let 20 through. A one-minute window has the same hole. A client spends the full limit in the last second of a minute and again in the first second of the next minute.

A fixed window stores one integer and a TTL. Use it as a coarse shield. A customer who learns the tick can take twice the plan at every boundary.

The token bucket refills from elapsed time. An empty bucket gains 10 tokens after one second. A fresh burst of 20 needs two idle seconds. A new wall-clock window leaves an empty bucket empty.

A sliding window log rejects that second batch of 10. At t = 1.0 it still holds the timestamps from t = 0.9. A timestamp from t = 0.9 falls out at t = 1.9. You store one timestamp per request.

A sliding window counter uses two integers. At full overlap the estimate is the previous count. With that count at 10, the estimate is 10. You reject the burst. Halfway through the window the weight is one half. The estimate falls to 5. The gap versus a true log is small enough for an API quota.

## What you return when you block

Return `429 Too Many Requests`. Include `Retry-After` as a number of seconds. On every response, send `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`. A careful client reads the remaining count and slows down before the next call fails.

Middleware calls `allow(key, rule)`. The limiter returns allowed, remaining, and the reset time. The gateway turns that into the status and the headers.

Pick the key before the store. An API key fits authenticated traffic. A user id fits one person with many keys. An IP fits anonymous traffic, including a rule of 10 login attempts per hour per IP. One request can match several rules. Evaluate every match. Reject the request if any rule fails. Report the most restrictive remaining count.

A free tier and a paid tier are two rule rows. They differ in limit, window, and burst. Cache the rules on each server. Refresh them from a config store.

Many users can share one NAT address. A tight per-IP bucket punishes the whole office for one loud client. Prefer the API key when you have one. Keep the IP bucket larger. Use it as the backstop for traffic with no key.

## One limit across many servers

One process and one bucket is easy. Fifty instances behind a load balancer each see a slice of a customer. A private counter then misses that customer's real rate.

Local counters drift. A full limit on every instance lets a customer on all 50 boxes take 50 times the allowance. Give each instance the limit divided by 50. The check stays in memory. That share is right only when the customer's traffic spreads evenly. Few connections land the customer on fewer boxes. A fleet that scales in and out does the same. The effective limit then swings from under the target to several times the target. Treat local limits as a coarse shield. A billed quota needs a shared count.

A central store adds a hop. Every instance checks a shared counter before it serves the request. Redis is the usual store. A token bucket fits in a hash of `tokens` and an update timestamp. The read, the refill, and the decrement have to be one atomic step. Use a Lua script, or `MULTI` and `EXEC`. Two instances will otherwise spend the same token. The global count is exact. You pay a round trip of about 0.5 to 1 millisecond in the same region. Redis becomes a tier-1 dependency. Shard it by customer key.

Consistent hashing can pin a key to one limiter. Hash the customer key at the load balancer. Send all of that customer's traffic to one instance. No other instance spends that key. The local bucket stays exact. One huge customer can overwhelm that single box.

A hybrid sits between the local bucket and the central store. Each instance claims a batch of tokens from the central store and spends the batch in local memory. A workable batch is about 10 percent of the customer's limit. Most requests pay no network cost. The global error stays inside the batches still outstanding. An empty local batch sends the instance back to the store. Stripe and many gateways run this scheme. Pick the hybrid for a billed quota. Pick a central script when the count must be exact and you can pay the hop. Pick a local limit for a coarse shield.

Write the failure policy before the store dies. Fail open serves traffic. The risk is overload. Fail closed rejects traffic. That rejection is the outage. Most APIs fail open for a short time. They raise an alert. They keep a conservative local backstop. Fail closed on login. A store failover uses that same policy.

Use one clock. If each app server stamps the refill with its own clock, a fast clock refills early. Call `TIME` inside the script. The store's clock owns the timestamp.

## How to design rate limiter answers

When the prompt is to design rate limiter behaviour for a fleet, start with placement and the key. The check can live in gateway middleware, in a library, or in a sidecar. Pick gateway middleware. It rejects the request before the backend runs. Name the key next. Choose an API key, a user, or an IP. Then pick a token bucket or a sliding window counter. Say what a burst is allowed to do.

Put numbers on the requirements. A typical rule is 1,000 requests per minute per API key, on every server. Operators change rules without a redeploy. A check should add about a millisecond.

Estimate the hot path out loud. [Back-of-the-envelope estimation for system design](/blog/back-of-the-envelope-estimation) is the method for that step. At 100,000 requests per second the limiter does 100,000 checks per second. Each check is one small command on one key. Ten million active keys at about 100 bytes each is about 1 GB. That fits in memory. A TTL a little longer than the window drops idle keys.

Keep rules and counters apart. A rule has a scope, an endpoint pattern, a limit, a window, and a burst. Servers cache those rules from a config store. Counters sit in a shared store, sharded by client key. A Lua script reads `tokens` and `last_refill`. It adds `rate × elapsed` up to capacity. It decrements when a token remains. It returns allowed, remaining, and the reset time. That is one round trip. The script calls `TIME` on the store.

Shield the store from one flooding client. Each server applies a small in-memory limiter first. Only a request that passes the filter calls the store. One client key still hashes to one shard. The design card uses a client at 20 percent of traffic for that case. That shard runs hot. Give a huge client its own limit. Count throttled requests per rule and per client. A spike usually means a client bug or an attack. The [distributed rate limiter design](/cards/rate-limiter) walks this path.

## Drill until you can draw the bucket

Draw capacity 20 and a rate of 10. Empty the bucket with a burst of 20. Show 10 tokens after one idle second. Show the cap of 20 after two idle seconds. Then mark a one-second window with a limit of 10. Put 10 requests at t = 0.9 and 10 at t = 1.0. The boundary total is 20. Drill until you can draw the bucket from a blank box.

Answer the card follow-ups from that drawing. Return 429 with `Retry-After` and the three rate-limit headers. Build the bucket from a counter and a timestamp. Make the decrement atomic. On failover, follow the fail-open or fail-closed policy. Apply every matching rule. Report the tightest remaining count. Keep an IP limit from punishing a shared NAT.

On the fundamentals deck, compare the algorithms and pick one for a public API. Then hold a per-customer limit across 50 instances. On the designs deck, design the low-latency distributed limiter. The [rate limiting algorithms card](/cards/rate-limiting-algorithms) is the bucket math.

[System design interview flashcards that actually stick](/blog/system-design-interview-flashcards) is the grading loop. Say the answer before you reveal the back. Tick only the points you actually said.

Drill on the [fundamentals study page](/study/fundamentals). The full design sits on the [designs deck](/study/designs). [Start drilling](/study/fundamentals).
