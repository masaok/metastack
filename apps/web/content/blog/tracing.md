---
slug: tracing
title: Tracing in system design interviews
description: Tracing in system design interviews. A trace id that follows the request, spans and sampling, what traces miss, and OpenTelemetry as vocabulary.
primaryKeyword: tracing
category: observability-and-ops
tags:
  - observability
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Tracing in a system design interview is how you follow one request across the boxes you just drew. A trace id is minted at the edge, each hop records a span, and a later lookup shows where the time and the error sat. It is not a metrics replacement, and it is not a vendor bake-off. The interviewer wants the id on every call, a sampling sentence that does not hide the slow tail, an admission of what traces cannot do, and a three-span path you can draw in a minute. This post is that answer, with OpenTelemetry as the shared vocabulary rather than a product pitch.

## A trace id that follows the request

A trace is one user request, or one unit of work that you decide is the request, as it moves through services. The trace id is a unique identifier for that whole journey. The first service that accepts the work creates it, or it accepts an id the caller already sent. Every outbound call, every message, every follow-up RPC carries that same id. Without the id, you have three log piles and a hope that timestamps line up.

A span is one unit of work inside the trace. The inbound HTTP handler is a span. The database call is a child span. The enqueue of a follow-up job is a span. Each span has its own span id, a parent span id, a start time, an end time, a status, and a small set of attributes: route, status code, peer service. The parent pointers make a tree. The tree is the drawing of that one request.

Propagation is the part people skip and the part that breaks the tree. HTTP carries the context in headers. The usual pair is a trace id and a parent span id, plus a flags field that says whether this request is being recorded. When a service takes work off a queue, the context has to be in the message, or the consumer starts an orphan trace that will never join the produce. When a worker fans out to twenty chat connections, each outbound send is a child, or a link, of the fan-out span. Drop the headers once and the rest of the path is invisible.

The id also belongs on the log line. A trace without logs is a skeleton. A log without a trace id is a needle. [Idempotency keys in system design](/blog/idempotency-keys) already stores one key per logical write. That key is not the trace id. The client may retry with the same idempotency key and a new trace. Keep both. The idempotency row tells you the write happened once. The traces tell you how many times the network tried and where the lost response sat.

Mint the id at the edge you control. For an internal mesh, continue a caller context. For a public client, you may start a new trace and link the incoming id so a caller-chosen collision cannot poison you. Say which you are doing.

## Spans, sampling, and the tail

If you stored every span of every request, tracing would become the most expensive log you have. Sampling decides which traces are kept. The interview answer names the two common policies and the failure of the first one.

Head-based sampling decides at the start of the request, usually at the edge. A fraction p, often 1 percent or 10 percent, is marked recorded. The decision travels with the context so every hop keeps or drops together. The cost is predictable. The failure is the tail. A rare 5-second request is almost never in the 1 percent. The traces you have are the fast, boring ones. The incident you are debugging is not.

Tail-based sampling decides at the end, once the trace is complete enough to know it was slow, or it erred, or it hit a route you care about. A collector holds spans for a short window, then keeps the ones that match a rule: status error, duration above a threshold, a particular route, a particular tenant tier. The tail is no longer invisible. The cost is the collector's buffer and a more honest bill that grows when the system is sick, which is when you need the data.

A practical mix is the interview default. Keep a low head sample so you always have some representative traces. Keep all errors. Keep a higher sample, or all, of traces that exceed a latency SLO. Keep a higher sample of the payment path than of the static asset path. Say the numbers as assumptions. "I keep 1 percent of all traces, 100 percent of errors, and 100 percent of traces over 1 second on checkout." Then say you would adjust after you see volume.

Span count is the other cost. One span per inbound request, outbound dependency, and important queue hop is enough. Keep attributes low-cardinality. User ids are search fields, not group-by dimensions. Durations inside one span are trustworthy. Cross-host comparisons can be off by clock skew. Do not design NTP on the board.

## What traces are bad at

Traces are a sample of trees. They are bad at being a complete count. "How many requests failed in the last five minutes?" is a metric. If you answer from traces, you are dividing by the sample rate and hoping the sample was unbiased. Head samples hide the failures you most need. Tail samples bias toward errors and make a raw count worse. Keep the golden signals on metrics. Use traces to explain a request you already know was bad.

Traces are bad at cheap fleet-wide trends. A p99 from a 1 percent sample is a noisy metric. Histograms on the request path exist for this.

Traces are bad at payloads. Store the id, the size, and the status. [Design news feed for the interview](/blog/design-news-feed) puts post text in the post store. Tracing follows the ids.

Traces are bad at work that has no request: compaction, a replica rebuild, a disk that filled. Those are logs and metrics. They are also bad when sampling hides a tiny canary that is 100 percent errors. Pair traces with an unsampled error-rate metric.

Traces are not the idempotency store. A retried payment can have two traces and one charge. The [idempotency keys](/blog/idempotency-keys) row is the source of truth. If you dedupe from traces, you will double-charge on a missing sample.

## A chat or payment path with three spans

Draw three spans. That is enough to prove you understand the tree. More boxes can be children later.

Chat, 1:1 send. Span A is the API gateway or the connection-tier handler that accepted the send. It records route, caller, and the conversation id. Span B is the chat service writing the message to the store. It is a child of A. Span C is the fan-out: enqueue for the recipient's connection server, or the push onto that server if you are drawing it in-process. C is a child of B, or of A if fan-out is parallel to the store. The trace id is created in A and written into the queue message so the consumer that actually pushes to the socket continues the same tree. If the recipient is offline, C ends with a status that says "queued", not with a missing span.

If the sender got an ack and the recipient did not, the tree tells you which hop failed. Slow B is the store. Missing C is dropped fan-out. A new trace id on C is forgotten propagation.

Payment. Span A is `POST /payments`. Span B is the ledger write. Span C is the provider call. The idempotency key sits in A and in the row [the idempotency post](/blog/idempotency-keys) already described. A timeout on C errors C and A. The client retry is a new trace with the same key.

A feed read is the same shape. A is `GET /feed`. B is the timeline cache. C is post bodies or the ranker. [Design news feed for the interview](/blog/design-news-feed) is the fan-out choice. The trace shows whether this read hit the cache.

| Path | Span A | Span B | Span C |
| --- | --- | --- | --- |
| Chat send | Edge accept | Persist message | Fan-out or enqueue |
| Payment | `POST /payments` | Ledger write | Provider charge |
| Feed read | `GET /feed` | Timeline cache | Post bodies or ranker |

Stop at three unless the interviewer asks for the database as its own span. Adding a fourth child under B for the SQL is fine. Adding a span per helper function is not.

## OpenTelemetry as the vocabulary, not a vendor pitch

OpenTelemetry is a set of names, APIs, and wire formats for this. It is not the backend. You can emit OpenTelemetry and store the spans in any collector that understands them. In the interview, the value is that you and the interviewer share words: trace, span, parent, attribute, context, exporter, collector. You do not need a vendor logo. You need those words used correctly.

The [OpenTelemetry traces signal](https://opentelemetry.io/docs/concepts/signals/traces/) is the public description of that model. A trace is a directed acyclic graph of spans. A span has a name, a timespan, a status, and attributes. Context propagation uses a standard that HTTP can carry. An SDK records spans in process. An exporter sends them to a collector. The collector samples, batches, and forwards to storage. That pipeline is the design. Jaeger, Zipkin, or a commercial store is an implementation of the last hop.

Say what you would emit, not what you would buy. Create a span for inbound HTTP. Inject context on outbound calls and queue produce. Extract on consume. Export via the collector. Sample with the mix you already named. Do not spend the last five minutes on agent versus sidecar. The requirement is that the trace id still follows the request, including through the queue.

The [fundamentals deck](/study/fundamentals) is still the daily drill. Timeouts and retries create the failures traces explain. Heartbeats create the dead hop you will look for. Tracing is how you see one request's path through those cards. When the interviewer asks how you debug a slow send, draw three spans and put the same trace id on all of them.
