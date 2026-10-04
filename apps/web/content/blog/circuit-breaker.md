---
slug: circuit-breaker
title: Circuit breaker pattern for interviews
description: Circuit breaker pattern for interviews. Closed, open, and half-open, what trips the breaker, honest fallback, and where it lives next to retries.
primaryKeyword: circuit breaker
category: traffic-and-reliability
tags:
  - availability
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the circuit breaker answer an interviewer wants. A breaker stops calling a dependency that is already failing, so your threads and the dependency both get a pause. Closed means calls go through. Open means calls fail fast. Half-open means a few probes decide whether to close again. You then say what trips it, what a fallback is allowed to return, and why it is not a retry. The rest of this post is that state machine, the trip rule, an honest fallback, the neighbouring tools, and where the breaker sits in a mesh.

## Closed, open, and half-open

Closed is the working state. Calls go to the dependency. Successes keep it closed. Failures count toward a trip rule. The caller still uses its timeout. The breaker is watching, not blocking.

Open is the tripped state. Calls do not reach the dependency. They fail immediately, or they take the fallback path. A clock starts. Until that clock ends, even a healthy dependency is left alone. That is the point. A service that is already falling over should not receive a retry storm from every caller.

Half-open is the probe. The open clock expired. The breaker lets a small number of calls through. If those probes succeed, it closes. If they fail, it opens again. The probe count is small on purpose. Half-open is not "send all traffic and see".

| State | What a call does | How you leave |
| --- | --- | --- |
| Closed | Goes to the dependency | Trip rule fires, then open |
| Open | Fails fast or uses fallback | Timer ends, then half-open |
| Half-open | A few probes go through | Success closes. Failure opens |

Draw the three boxes. Interviewers want the names. They also want the reason for half-open. Without it you flap. You open, wait, dump the full queue onto a dependency that is still sick, and open again. The probe is how you notice recovery without recreating the load that caused the trip.

The breaker is per dependency, and often per endpoint, not one switch for the whole process. A payments client that is failing should not open the breaker in front of a local cache. Name the scope when you draw it.

Open does not mean the dependency is down. It means this caller has decided to stop talking. The half-open probe is how this caller checks its own path.

## What trips the breaker, and what does not

Trip on a signal that the dependency cannot do useful work right now. Consecutive timeouts. A high error rate in a short window. Connection refused. `503` and `504` from that hop. A budget of outstanding calls that is already full. Those say the next call is unlikely to help.

Do not trip on a bad request. `400`, `401`, `403`, `404`, and `422` are the caller's problem, or the user's. Sending the same body again will fail the same way. Counting them as failures makes a chatty client open the breaker for everyone else. Filter them out of the error rate.

Do not trip on one timeout. A single slow call is a blip. The timeout already bounded it. A breaker that opens on one failure flaps. Use a threshold. Ten failures in twenty calls, or five consecutive timeouts, or an error ratio above a line you can say out loud. The exact integers are less important than the idea of a window and a floor.

Do not trip on a slow success if you only measure errors. A dependency that answers in 2 seconds with `200` can still pin your threads. If the risk is saturation, count timeouts and deadline misses, or cap outstanding calls. A breaker that only watches HTTP status will stay closed while every thread waits.

Do not trip because a deploy is in progress unless the health check says so. The breaker is not a feature flag. If you need to stop traffic for a release, use the release mechanism. The breaker is for observed failure.

A worked window. Twenty calls. Timeout is 200 ms. Twelve of the twenty miss the deadline. Eight return `200`. The error ratio is 12 / 20. If the trip line is half, the breaker opens. The next call does not wait 200 ms. It fails in a millisecond and takes the fallback. After an open interval, three probes go through. Two succeed inside 200 ms. One still times out. You stay open or you close only on a clean probe set. Say which rule you chose. A sloppy half-open that closes on the first success will flap if the dependency is still dying.

[Rate limiting for system design interviews](/blog/rate-limiting-for-interviews) is a different tool. A limiter decides whether this client is allowed more work. A breaker decides whether this dependency is safe to call. A client that is under its rate limit can still trip a breaker. A healthy dependency can still reject a client that blew its bucket.

## Fallback that is honest

Fallback is what you return while the breaker is open. Honest means the user can tell the path is degraded, or the data is clearly old, or the write did not happen. Dishonest means you return `200` with an empty cart and let checkout continue, or you claim a payment succeeded.

Reads can fall back to a cached last value. Stamp it as stale. A product page that shows yesterday's price with a banner is a product decision. A product page that shows yesterday's price as if it were live is a lie. If you have no cache, fail the read. A blank slot is better than a number you invented.

Writes should not pretend. If the charge path is open, do not tell the user the charge went through. Queue the write only if the user can live with "we will retry" and you have a durable place to put the intent. Otherwise return an error and let the user retry when the path is closed.

A default that is safe can be a fallback. Feature flags off. Recommendations empty. A map tile from a coarser zoom. The test is whether acting on that default can spend money, delete data, or grant access. If it can, do not default.

Timeouts still apply to the fallback. A fallback that calls a second slow store can recreate the pile-up. Prefer a local cache, a static default, or a fail. If the fallback is another hop, give it a tighter deadline and its own breaker.

Say the fallback out loud when you draw the breaker. Interviewers treat a breaker without a fallback as an error path you have not finished. "Fail fast" is a valid fallback if the caller can surface the error. "Return success" is not.

## Breakers versus retries and timeouts

Timeouts come first. A call with no deadline can hang forever and pin a worker. Every outbound call gets a timeout derived from the remaining budget. The breaker cannot save you from an unbounded wait. It never sees the end of a call that never ends.

Retries absorb a blip. One timeout, one connection reset, one `503`. Retry only when the operation is idempotent, or is made idempotent with a key. Back off. Add jitter. Cap the retry share of traffic. [The retries, timeouts, and backoff card](/cards/retries-timeouts-and-backoff) is that list. A breaker sits next to it. When almost every call is already failing, retries become a storm. The breaker opens and the retries stop reaching the dependency.

Stacked tools multiply. Three retries at the client, three at the gateway, and a closed breaker that is not yet open turn one user action into many calls. Decide the layer. Usually the caller with the most context retries. The breaker at that same layer sees the same failures. Downstream layers pass the error through.

| Tool | Question it answers | What it does not do |
| --- | --- | --- |
| Timeout | How long may this attempt run? | It does not stop the next attempt |
| Retry | May I try again after a transient fault? | It does not notice that the dependency is gone |
| Breaker | Should I stop calling for a while? | It does not fix the request |
| Rate limit | Has this client used its budget? | It does not know if the server is sick |

[Load balancing for system design interviews](/blog/load-balancing-for-interviews) removes a dead instance from a pool with a health check. That is membership. A breaker in the caller still helps when the whole pool is sick, or when the next hop is another service, not a replica of the same one. Health checks and breakers can agree. They are not the same box.

A retry budget and a breaker work together. The budget says retries may be at most a fraction of calls. The breaker says this dependency is past the point where retries help. When the breaker is open, the budget is not spent, because the call never leaves.

## Where the breaker lives in a service mesh

A library breaker lives in the process. The code that opens the connection also increments the failure count. That is simple. Each language and each client must implement it. Two services in the same binary can still have two breakers if they wrap two clients.

A mesh breaker lives in the sidecar or the proxy next to the process. Outbound calls leave through the proxy. The proxy counts failures, opens, and fails fast. The application sees an error. Many services then share one implementation. The application must still handle the error and choose a fallback. The mesh does not know that a stale cache is acceptable on the product page and unacceptable on the charge.

Put the breaker on the outbound side of the caller, closest to the dependency you are protecting. An inbound breaker on the callee is a different tool. The callee can shed load, refuse work, or return `503`. That is the callee protecting itself. The caller's breaker protects the caller from waiting on a callee that is already shedding.

One breaker per hop. A sidecar that opens, plus a library that opens, plus a gateway that opens, can hide recovery. The first probe that should have closed the library breaker never reaches the sidecar if the gateway is still open. Pick the mesh or the library for a given call path. Do not stack them "for defence".

The mesh can key the breaker on destination and route. That is the scope from the first section. `checkout → payments` is one circuit. `checkout → catalog` is another. A wide key that lumps every outbound call into one counter will open the world because one hop failed.

What you say in the room.

1. Closed lets calls through. Open fails fast. Half-open probes.
2. Trip on a window of timeouts or server errors, not on one blip and not on `4xx`.
3. Fallback is stale, default, or error. Never a fake success on a write.
4. Timeouts bound an attempt. Retries absorb a blip. The breaker stops the storm.
5. Put it on the outbound path, once. Mesh or library, not both on the same hop.

Drill the [retries, timeouts, and backoff card](/cards/retries-timeouts-and-backoff) until the breaker is the sentence you add after the retry budget. Start on the [fundamentals study page](/study/fundamentals).
