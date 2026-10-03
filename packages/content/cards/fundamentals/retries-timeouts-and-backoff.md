---
id: retries-timeouts-and-backoff
deck: fundamentals
type: concept
difficulty: 2
tags: [availability, api, latency]
prompt: >
  How should a client retry a failed call to a dependency? Cover timeouts,
  backoff, jitter, retry budgets and what must not be retried.
keyPoints:
  - Set an explicit timeout on every call, derived from the caller's own deadline, and propagate deadlines downstream
  - Retry only idempotent operations and only on errors that indicate a transient fault (timeouts, 503, connection reset), not on 4xx
  - Use exponential backoff with full jitter so retries from many clients do not synchronise into waves
  - Cap retries with a budget (e.g. retries at most 10% of requests) so a struggling dependency is not hammered into collapse
  - Retry at one layer only, stacked retries multiply load exponentially
eli5:
  - Never wait forever, so give each call a time limit that fits inside your own and pass the remaining time along
  - Only try again when repeating is harmless and the failure looks temporary, never when the request itself was wrong
  - Wait longer after each failure and add randomness, so a crowd of clients does not all come back at the same instant
  - Limit retries to a small share of traffic, so a struggling service is not pushed over the edge
  - Retry in one place only, because retries stacked at every layer multiply each other
distractors:
  - Retry every failed request, including 400 and 404 responses, since any failure may be transient
  - Retry immediately and at a fixed interval, so that recovery is as fast as possible
  - Add retries at every layer of the stack for defence in depth
followUps:
  - Why does a retry storm often make an outage longer, and what is a circuit breaker's role?
  - How do you choose the initial timeout for a new dependency?
references:
  - title: AWS Architecture Blog, Exponential backoff and jitter
    url: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
  - title: AWS Builders' Library, Timeouts, retries, and backoff with jitter
    url: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
updated: 2026-10-02
reviewed: true
---

Retries are the most common way a small failure becomes a big one. Done well they absorb blips; done badly they turn a slow dependency into a dead one.

**Timeouts first.** A call with no timeout can hang forever and pin a thread or connection. Set one on every outbound call. Derive it from the caller's own budget: if your endpoint promises 500 ms and you have already spent 200, the downstream call gets at most 300. Pass that deadline along (gRPC does this natively) so the whole chain gives up together instead of doing work nobody will read.

**What to retry.** Only operations that are idempotent, or are made idempotent with a key. Only on faults that are plausibly transient: connection refused, connection reset, timeout, `502/503/504`, throttling. Never on `400`, `401`, `403`, `404` or `422`; those will fail the same way again.

**Backoff with jitter.** Wait before retrying and grow the wait exponentially: 100 ms, 200, 400, 800. Without randomness, a thousand clients that failed at the same moment retry at the same moment, four times in a row. Full jitter (`sleep = random(0, base × 2^attempt)`) spreads them out and empirically finishes faster with fewer total calls.

**Retry budgets.** Per-call retry caps (three attempts) still allow 3× load during an outage. A budget caps *total* retries as a fraction of traffic, for example retries may be at most 10% of requests in any window. When the budget is exhausted, fail fast. Combine with a **circuit breaker** that stops calling a dependency that is failing almost every request and probes it occasionally.

**One layer retries.** If the client retries 3×, the API gateway retries 3×, and the service retries 3×, one failure generates 27 requests. Decide where retries live (usually closest to the caller with the most context) and make the other layers pass errors through.

Interviewers want: timeout, idempotent-only, exponential backoff with jitter, a budget, and the retry-amplification warning.
