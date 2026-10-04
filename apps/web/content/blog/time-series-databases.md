---
slug: time-series-databases
title: Time series databases for interviews
description: Time series databases for interviews. Append-heavy writes, range queries, rollups, and why a general store starts to hurt at ingest.
primaryKeyword: time series databases
category: caching-and-storage
tags:
  - databases
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the time series databases answer an interviewer wants. A time series is a named measurement with a timestamp and a value. Writes are appends. Reads are ranges, not joins. You keep raw points for a short window, then you downsample and you expire. Metrics and events are different shapes. A general store can hold the first million points. It starts to hurt when ingest, compression, and retention become the product. That is the whole case. The rest of this post is the write path, the range query, rollups, the metrics-versus-events split, and the signals that you have outgrown a table.

## Append-heavy writes and rollups

A point is a series id, a timestamp, and a value. The series id is a metric name plus a label set, or a device id plus a channel. The write does not update an old row. It appends a new point. That is the access pattern you say first.

Ingest is the load. Hosts and services emit points on an interval. Agents push, or a scraper pulls. A buffer sits in front of the writers so a spike does not land on the disk in one burst. Writers shard by series so one series lands in one place. The next point for that series is packed next to the last one.

Compression is why a specialist store exists. Consecutive timestamps differ by a regular interval. Consecutive values often change slowly. Encodings that store deltas, and deltas of those deltas, shrink a point to a couple of bytes. A general row store stores a timestamp and a float as separate columns and repeats the series id on every row. That is fine until the row count is the problem.

A rollup is a write that turns many points into one. Every minute you take the raw points for that minute and you store min, max, sum, and count. Every hour you roll the minutes. The raw append and the rollup append are both writes. The rollup is how you stay fast on a year-long chart without reading a year of raw samples.

Do not invent a points-per-second number unless the interviewer gives you one. If they want a size, use the inputs they gave. Hosts times series times interval. Leave the arithmetic on the board. The design does not depend on a famous benchmark.

A sketch of one series:

```
series  api_requests{service=feed,code=200}
raw     (t0, 40), (t0+10s, 44), (t0+20s, 41)
minute  (t0, min=40 max=44 sum=125 count=3)
```

The raw line answers a ten-second graph. The minute line answers a day graph. Both are appends. Neither is an update of a mutable cell.

## The query that is a range, not a join

The read is "give me this series between these two times, then aggregate." You already know the series, or you know a label selector that expands to a set of series. You do not join to a customers table to find the points. You do not walk a foreign key. You scan a time range.

That scan wants the points for one series laid out in time order on disk. A store that partitions by time and by series can read one block and stop. A store that holds each point as a row keyed by an auto-increment id must filter. The filter becomes the plan.

Typical questions:

- Sum this counter over the last five minutes, grouped by service.
- The 99th percentile of latency for one endpoint over the last hour.
- The last value of a gauge.

All three are range plus aggregation. The first two are rollup-friendly. The last is a tail read.

Joins show up as a smell. If you need to join points to a slowly changing table of service owners, do that after the range, in the application, on a small result. If you need to join two high-volume series on time, you are in stream-processing territory. A time series database may align two series on timestamp buckets. It is still not a relational join planner.

[SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) starts from the access pattern. This pattern is known: append by series, read by series and time. A relational table can model it. The specialist store exists because that pattern is almost the only pattern.

Cardinalities matter on the query side too. A label selector that matches a million series will try to open a million streams. The store needs an inverted index from label values to series ids. That index is how "service=feed" becomes a list of series, not a table scan. Unbounded labels break the index. A user id as a label creates a series per user. The selector then explodes. Say that before you add the label.

## Downsampling and retention

Raw points grow without a bound. Nobody needs ten-second resolution from last year. Downsampling and retention are how you say that out loud.

Keep raw data for a short window. Keep a one-minute rollup for a longer window. Keep a one-hour rollup for years. Drop each tier when its policy says so. The dashboard picks the tier that matches the requested range. A fifteen-minute chart reads raw or one-minute data. A six-month chart reads hourly data.

| Tier | Resolution | Kept for | Answers |
| --- | --- | --- | --- |
| Raw | The scrape or push interval | Hours to a few days | Debug a deploy, page a spike |
| Short rollup | One minute | Weeks | Daily dashboards |
| Long rollup | One hour or one day | Months to years | Capacity history |

Retention is a delete. Downsampling is a write that lets you delete. If you only expire raw points and you never wrote a rollup, the old chart is empty. If you keep raw points forever, the disk is the product.

Compression and retention work together. A compressed block of raw points is already small. It is still larger than the rollup of those points. The rollup is what makes a year cheap.

The interviewer may ask whether downsampling loses data. Yes. You choose which statistics to keep. Min, max, sum, and count rebuild an average. They do not rebuild every original sample. That is the trade. You keep the question you will still ask.

[Database partitioning explained simply](/blog/database-partitioning-explained) is the related warning about time as a shard key. A table partitioned only by timestamp writes every new point to the newest partition. That partition is hot. A time series store still partitions by time, but it also partitions by series, and it expects the newest window to be the write window. The hot partition is a designed hot partition. You size the writers for it. You do not use `created_at` as the only shard key of a general table and hope.

## Metrics versus events

Metrics are regular measurements you intend to aggregate. CPU, queue depth, request count, error count. The label set is small and closed. The interval is known. The point is a number. Dashboards and alerts consume them.

Events are things that happened. A request log line, a purchase, a click, an audit record. The shape varies. The rate is bursty. You often need the raw payload later. You filter and group, but you do not always reduce the event to a float.

Interviewers mix the words. Separate them.

A metric system wants a time series database. An event system wants a log, a warehouse, or both. You can derive metrics from events. You count purchases per minute and you store that count as a series. You do not store every purchase in the time series database.

High cardinality is the usual mistake that collapses the two. Putting a user id, a request id, or a raw path with ids into a metric label turns a metric into an event stream that the series index cannot hold. The store then spends its memory on series metadata, not on points.

| | Metrics | Events |
| --- | --- | --- |
| Shape | Name, small labels, a number | A payload with many fields |
| Time | Regular interval | Irregular |
| Read | Range and aggregate | Filter, search, replay |
| Store | Time series database | Log or warehouse |
| Failure | Unbounded labels | Using the metrics store as the log |

A metrics pipeline still has events inside it. An agent emit is an event. The write into the series store is the reduction. Alerting reads recent series, not the warehouse. Dashboards may read both tiers. Keep alerting off the ad hoc query path so a heavy chart cannot silence a page.

If the prompt is "design a metrics system," say emit, buffer, write, roll up, query, and alert as separate pieces. This post is the store in the middle. The buffer is a stream. The alert path is a consumer of recent data. The series store is not the notification system.

## Why a general store starts to hurt

A Postgres table of `(series_id, ts, value)` works for a demo and for a small product. Indexes on `series_id` and `ts` answer the range. You can even partition by week. The hurt arrives in layers.

The write rate fills the newest partition and the WAL. Every point is a row. Vacuum and indexes follow those rows. Compression is per row, not per series run. Disk grows faster than the charts need.

The query planner treats your range as a filter, not as the native layout. A dashboard that opens fifty series for a day becomes fifty index range scans and a merge. A specialist store opens fifty compressed blocks.

Retention is a large delete. Deleting last month's rows is a heavy operation on a general store. On a time series store it is dropping a time partition or a tier.

Rollups become application jobs you write yourself. You will write them. You will forget one. A store that treats rollups as a first-class policy keeps the job next to the data.

Cardinality has no guard. Nothing stops a caller from inserting a series per user. A specialist store can refuse or aggregate those labels at ingest.

None of this means "never use Postgres." It means you start there, you measure ingest and disk and query time, and you move when those three are the pain. [SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) says the same thing about specialised stores. Time series databases are one of those stores. You add them for this access pattern, not because the prompt said "scale."

A sentence you can reuse:

"Writes are appends of points. Reads are ranges on a series. I keep raw data briefly, then I downsample and I expire. User ids do not become labels. If this is still a small table, I stay on Postgres. When ingest and retention are the product, I take a time series store and I keep events in a log."

Keep the order straight.

1. Name the point and the series.
2. Say append, not update.
3. Say range, not join.
4. Give a retention ladder.
5. Separate metrics from events.
6. Leave the general store when ingest, compression, and deletes are the work.

Start on the [fundamentals study page](/study/fundamentals).
