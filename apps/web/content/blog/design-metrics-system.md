---
slug: design-metrics-system
title: Design metrics system for the interview
description: Design metrics system for the interview. Emit, transport, store, and query time series, then keep cardinality and alerting off the dashboard path.
primaryKeyword: design metrics system
category: observability-and-ops
tags:
  - observability
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

When you design metrics system collection for an interview, treat every sample as a named time series with a label set. The work is emit, a buffer, a store built for appends, and a query path. Alerting is a second path on recent data. Cardinality is the limit that sinks the rest. The [metrics-monitoring card](/cards/metrics-monitoring-system) already asks for that shape. This post is how you say it.

## Emit, transport, store, query

A point is a name, labels, a timestamp, and a value. `http_requests_total{service="api",code="500"}` at time T with value 19 is a point. The series is the name plus the sorted labels. Samples append. They do not update an old row.

Emit is how the point leaves the process. An agent records counters, gauges, and histograms. A counter only goes up. A gauge is a level. A histogram holds observations you later turn into percentiles. Say those three. Do not invent a fourth.

Transport is how the point reaches a writer. A gateway accepts a batch, checks the tenant, and rejects a label set that would explode the index. It writes the batch to a stream. [Message queues for system design interviews](/blog/message-queues-for-interviews) is why the producer should finish without waiting on the slow hop. Here that hop is the time-series disk. A deploy that restarts every agent is a burst. The stream absorbs it.

Store is a time-series database. Writers shard by a hash of the series id. Samples sit in time-partitioned blocks. Compression uses regular timestamps and slowly changing values. Name delta-of-delta timestamps and XOR of values. You need "append, compress, shard by series."

Query is a language over those series. A selector picks by name and labels. A function turns a counter into a rate. An aggregation sums by `service` or takes a histogram quantile. Dashboards are saved queries. Ad hoc queries are the same path with worse cache behaviour. Put a limit on range and series count. A year-long `rate()` across every series is a denial of service on yourself. Boxes, left to right: agents or scrapers, gateway, stream, writers, hot store, compactor, cold store, query service. Dashboards talk to the query service. They do not talk to the writers.

Follow [Back-of-the-envelope estimation for system design](/blog/back-of-the-envelope-estimation). The card's load is 100,000 hosts, 100 series each, one sample every 10 seconds. That is 1 million samples per second. A raw sample of a timestamp and a float is 16 bytes. That is 16 MB/s, about 1.4 TB/day before compression. The card's compression lands near 1 to 2 bytes per sample, so a few hundred GB/day of hot data, not a few TB. Ten million series each need an index entry and an open write buffer. Say both numbers. Then say what they do. Writers scale by series hash. The index must stay a size you can hold.

## Cardinality and aggregation

Cardinality is the number of series, not the number of samples. One metric name with a `user_id` label is one series per user. Each series needs writer memory and an index posting. The store dies from unique label values, not from QPS.

"Put the user id on every metric so we can chart any user" is a log. Metrics answer how the api service is in one region. They do not answer how user 17 is. User 17 belongs on a log line with a trace id. Protect the gateway. Set a per-tenant series limit. Reject or drop a label you did not allow. Surface the top offenders so a team can find the `user_id` they shipped. Count requests by `service` and `code`, not by user. If you need a per-user error, sample it or write a log.

Aggregation at query time is different. `sum by (service)` folds series at read time. It is cheap when the selector already cut the set. Downsampling is aggregation in advance. A job writes 1-minute and 1-hour rollups with count, sum, min, and max. A raw p99 cannot be rebuilt from three averages. The card's retention is raw for days, 1-minute for weeks, 1-hour for years. Nobody needs second-level points from last year. A long-range dashboard should read the coarse tier.

| Grain | What it is for | What it cannot do |
| --- | --- | --- |
| Raw samples | Incidents, last few days, alerting | Cheap year-long charts. |
| 1-minute rollup | Weekly dashboards | Exact per-second spikes last month. |
| 1-hour rollup | Capacity over a year | A 5-minute incident last winter. |
| Label at emit | A series you will query | A user id, a request id, a raw path. |

If the store melted after a release, look for a new unbounded label before you look for a bigger disk. Name that before you name more writers. A second writer does not fix an index that holds a series per user. The gateway should have refused that label on the way in. Say that refusal as part of the ingest path, not as a later cleanup job on the store.

## Pull versus push

Ingestion is either pull or push. Say both. Pick one and know what you gave up.

Push means the agent sends batches to `POST /write`. You see a new host as soon as it sends. You also see a burst when every host restarts. The stream is how you survive that. Hosts behind a NAT can push. The system does not need to reach them.

Pull means the system scrapes `/metrics` on a schedule. Discovery is the hard part. A host the scraper cannot reach does not exist. A missed scrape is a gap, not a retry buffer. Pull gives you a central schedule and a simple process endpoint. You can name Prometheus. You still have to say scrape, discovery, and gap.

I pick push through a gateway and a stream when the prompt is millions of points per second across many teams. That is the card's path. I pick pull when one fleet is reachable. A hybrid is normal if you say why. Agents push because tenants sit on networks you do not enter. You scrape your own writers so you know ingest is alive.

A pushed timestamp far in the future breaks block boundaries. Reject it at the gateway. A pull sample uses the scraper's clock, which is easier to keep honest. Either way, a bad timestamp is refused. The metrics system must not page through itself alone. A tiny independent check that ingest bytes dropped to zero lives outside the pipeline. The card lists that failure. Mention it. A silent pipeline is the outage you will not see on your own dashboard.

## Alerting that is not the same system

Dashboards and alerts share a store. They do not share a path.

A dashboard query can wait a second. It can be cached or refused. An alert rule is `error rate > 1% for 5 minutes`. It must still evaluate when a team opens a year-long graph. Put the evaluator on the hot store with its own schedule. Hand firing alerts to a notification system with grouping and dedup. Pager routing is another design.

State for "for 5 minutes" lives on the evaluator. One sample above the bar is not a page. A rule that has been true across successive evaluations is. If you run the rule through the dashboard queue, a slow panel delays the page. That is the card's distractor. Do not take it. Write the split on the board. Query service reads hot and cold for humans. Alert evaluator reads hot only. Notification is downstream of the evaluator, not of the dashboard. When dashboards overload, alerts still run. When writers are behind, the newest minute may be stale. Prefer a late alert to a silent one, and a skipped dashboard to a skipped alert.

Recording rules precompute a heavy panel. They are not alerts. They write new series back into the store. Use them when the same aggregation runs on every refresh. Keep them off the alert path unless the alert reads that recorded series on purpose. Refuse a query or a rule that fans out to tens of millions of series. Cardinality control keeps both paths alive. Independence keeps the page alive when the humans are the load.

## What the metrics-monitoring card already asks you to say

Open the [metrics-monitoring card](/cards/metrics-monitoring-system) and walk it in order.

Requirements. Numeric series from a large fleet. Range queries with aggregations. Alert rules. Millions of points per second. Recent queries under a second. Years of retention at falling resolution.

Estimates. The card's 100,000 hosts, 100 series, 10-second interval. Land on 1 million samples per second and about 1.4 TB/day raw. Then compress. Series count, about 10 million, is the other axis. [Back-of-the-envelope estimation](/blog/back-of-the-envelope-estimation) is the method.

API. Push `POST /write` or scrape `/metrics`. A query language. Alert rule CRUD. Series identity is name plus labels.

Data model. Hash of name and sorted labels. Inverted index from `label=value` to series ids. Time-partitioned compressed blocks. Rollup tiers with count, sum, min, max.

High-level design. Agents or scrapers, gateway, stream, sharded writers, hot store, compactor, cold store, query service, alert evaluator, notification. The stream is the buffer the [message queues post](/blog/message-queues-for-interviews) defends.

Deep dives. Compression. Downsampling. Cardinality at the gateway. Alerting on a small hot path. If you only have time for one, take cardinality. User ids as labels are the trap. Failure. Ingest spikes wait in the stream. Bad queries are limited. A dead writer replays from the stream. A tiny monitor watches ingest from outside.

The card's rejects. Do not use user id as a free label. Do not keep raw samples forever. Do not evaluate alerts through the dashboard queue. Time series in, stream, compressed store, two outbound paths. One draws charts. The other pages. Labels stay bounded.

Drill that card on the [classic designs study page](/study/designs) until emit, buffer, store, query, and a separate alert path come out in order. Rerun the estimate until 1 million samples per second and 1.4 TB/day raw show up without a stall. Start that loop from [/study](/study).
