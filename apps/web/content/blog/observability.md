---
slug: observability
title: Observability for system design interviews
description: Observability for system design interviews. Logs, metrics, and traces as three signals, the question each answers, and cardinality that blows a bill.
primaryKeyword: observability
category: observability-and-ops
tags:
  - observability
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Observability in a system design interview is the ability to ask a new question about a running system and get an answer from the signals you already emit. It is not a vendor name on the side of the board, and it is not "we will add monitoring" written under the last box. The interviewer wants three signals named, a question each one is for, a cardinality limit you will not blow, and the same three lines added every time you draw a new service. This post is that answer, and it points at the neighbouring tracing and metrics-system write-ups for the parts that need their own hour.

## Logs, metrics, and traces as three signals

A log is a record of an event. A line, preferably structured fields, with a timestamp, a service name, a request id, and the facts you will search for later: user id, error code, the key that missed the cache. Logs are wide. They hold the payload you did not know you would need. They are also expensive to store and slow to scan if you treat them as the only signal.

A metric is a number over time, identified by a name and a small label set. Request count, error count, latency histogram, queue depth, CPU, hit rate. Metrics are cheap to aggregate and cheap to alert on. They are a bad place for a user id. Each distinct label value is another time series. A million users times a handful of names is a million series, and the store and the bill both fall over.

A trace is the path of one request across services. A shared trace id, a span per hop, timestamps and status on each span. Traces answer "why was this call slow" when the call crossed three processes. They are sampled, because keeping every request at this width does not fit. Sampling is why traces are a poor fleet-wide rate.

The three signals are complementary because they compress different things. Metrics compress many events into one series. Logs keep a single event in full. Traces keep the causal chain of one request. An interview answer that names only logs cannot alert cheaply. An answer that names only metrics cannot explain one user's failed checkout. An answer that names only traces cannot tell you the error rate for the last five minutes without a sampling story.

Write them as a table so the board stays honest.

| Signal | What you store | What it is for | What it is bad at |
| --- | --- | --- | --- |
| Log | One event, structured fields | The exact failure, the payload, the audit | Cheap fleet-wide rates and long retention |
| Metric | A named number plus low-cardinality labels | SLIs, alerts, dashboards, capacity | Explaining one request, or a high-cardinality breakdown |
| Trace | A request's spans across services | Where time went on one path | Complete counts, unless you keep 100 percent and can afford it |

Structured logs belong from the first drawing. `printf` strings that you grep in an incident are not a design. Fields you can filter are. The request id on the log line is the join key to the trace. The same id on the metric exemplar, if you have one, is the join key back. Observability is those join keys, not three separate piles.

## The question each signal answers

Start from the question, then pick the signal. Interviewers grade the match.

"Is the product broken right now?" That is a metric. Success rate, p99 latency, saturation of the primary, queue age. You need an SLI you already defined, and an alert on that SLI, not a person watching a tail of logs. [Rate limiting for system design interviews](/blog/rate-limiting-for-interviews) already produces a reject count. That reject count is a metric. It tells you whether the limiter is doing its job or whether a client is drowning the fleet.

"Is this dependency the reason we are slow?" That is still a metric first: latency and error rate on the outbound call, broken by dependency name, not by user. If one dependency is red, you have the broken hop. You do not yet have the one request that started the page.

"Why did this user, or this request id, fail?" That is a log, then a trace. The log has the error and the inputs. The trace has the hops. If you only have logs, you reconstruct the path by timestamp and hope the clocks agree. If you only have a trace, you see that the payment span failed and you still need the log line for the provider code.

"Where did the 800 ms go?" That is a trace. The gateway span was 20 ms. The feed service span was 40 ms. The ranking span was 700 ms. Metrics can tell you that ranking p99 is 700 ms. The trace tells you this request spent its time there and not in the database.

"Are we about to run out of something?" That is a metric on a resource: disk, connections, queue depth, thread-pool utilisation, cache hit rate. [Load balancing for system design interviews](/blog/load-balancing-for-interviews) depends on health checks. Those checks should move a metric, not only a boolean on a balancer. A pool that is losing members is a capacity story before it is an incident.

"What happened in this deploy?" Logs for the new error, metrics for the rate that changed, traces for the new hop. A deploy without a metric rollback signal is a hope. When you add a queue, ask depth and age. When you add a cache, ask hit rate. When you add a service, add the three signals.

## Cardinality that blows up a metrics bill

Cardinality is the number of unique time series. A series is a metric name plus a full set of label values. `http_requests_total` with labels `method`, `route`, `status`, and `region` is fine if routes are a closed list. The same metric with a `user_id` or a raw URL including query strings is a new series per user or per URL. That is the blow-up.

Work a small example. 50 services, 20 metric names each, 5 label keys, each key with 10 values, already a lot but maybe survivable if the keys are things like `status` and `region`. Add `user_id` with 10 million values and you have just invented 10 million series per metric that carries it. Ingestion, indexing, and memory on the time-series store all grow with series count, not with sample count. A 10-second scrape of a huge series set is a different problem from a 10-second scrape of a small one.

The interview rule is a closed vocabulary on metric labels. Method, status class, route template, region, version, dependency name. Never user id, never email, never a full URL, never a post id, never a trace id. Those belong on logs and on traces, where one event is one row, not one series forever.

"Latency for this user" is a log or a trace, not a metric. A handful of customer tiers can be a label. Ten thousand tenants usually cannot. Aggregate first.

Protect the store with a series limit and by dropping offending labels. Downsample old data. The metrics-monitoring card is the full pipeline. This post only needs the sentence that keeps the series count finite. Logs and span attributes blow up the same way: sample successes, keep errors, cap payloads.

## What you add when you draw a new service

Every new box on the board gets the same three lines. If you cannot name them, the box is not designed.

Metrics. Golden signals for that box: incoming rate, error rate, latency histogram, and saturation. Saturation is the resource that runs out here: CPU, threads, connections, disk, or in-flight requests. Outbound metrics to each dependency, so a slow neighbour shows up as that neighbour, not as "the service is slow". If the box is a balancer, the extra metric is pool size and healthy members, which is the load-balancing health-check story again. If the box is a limiter, the extra metric is allowed versus rejected.

Logs. Structured, with the request id, the service name, and the fields you will need at 3 a.m. Errors are required. Start-of-request debug is optional and sampled. Do not log secrets. Do not log access tokens. Do not log the full payment card path; log the last four and the provider reference.

Traces. Create a span for the inbound request. Propagate the trace id and parent span id on every outbound call. If you take work from a queue, read the trace context from the message and continue the trace, or start a linked trace so the produce and the consume still join. A service that emits metrics and logs and drops the context is a hole in the path.

Alerts. One or two on the SLI, not twelve on CPU. Page on user-visible errors and latency. Alerting is a separate consumer of the same metrics, not the dashboard path. Dashboards last, and only if they tie to an SLI.

## Linking to the metrics and tracing posts

This post is the triangle. The other two posts, and the cards behind them, are the deep dives. Do not restate them on this board. Point at them and keep moving.

Tracing is its own hour: the trace id, spans, head versus tail sampling, what traces cannot do, and a three-span chat or payment path. That write-up lives at [Tracing in system design interviews](/blog/tracing). Open it when the interviewer stays on one request and asks how you follow it across services. The fundamentals you need before that hour are still timeouts, retries, and the load-balancing health checks that tell you which hop disappeared.

The metrics pipeline is a design prompt of its own: agents or scrapes, a buffer, a time-series store, downsampling, and an alert evaluator that does not sit behind the same query fan-out as a dashboard. That write-up is slated as `/blog/design-metrics-system`. Until it ships, the metrics-monitoring card in the designs deck and the time-series storage discussion are the source. Cardinality, the rule you already said, is the constraint that design exists to survive.

A limiter without allowed-versus-rejected is a silent gate. A balancer without a healthy-pool metric is a silent single point. Link those posts when the drawing includes those boxes.

The [fundamentals deck](/study/fundamentals) makes the triangle automatic. When the interviewer adds a service, write rate, errors, duration, saturation, a structured log, and a span.
