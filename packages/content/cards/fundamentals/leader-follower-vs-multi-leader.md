---
id: leader-follower-vs-multi-leader
deck: fundamentals
type: tradeoff
difficulty: 3
tags: [replication, consistency, availability]
prompt: >
  Compare single-leader, multi-leader and leaderless replication. When does
  each topology fit?
keyPoints:
  - Single leader serialises writes through one node, simple conflict-free ordering but writes cannot survive leader partition
  - Multi-leader accepts writes in several datacenters, lowering write latency and surviving a DC outage, but needs conflict resolution
  - Leaderless (Dynamo-style) writes to a quorum of replicas and reconciles on read with vector clocks or last-writer-wins
  - Conflict handling options, last-writer-wins, application merge, CRDTs
  - Choose by write locality, tolerance for conflicts, and whether clients can retry against another leader
eli5:
  - One machine takes every write, so order is never in doubt, but writes stop if that machine is cut off
  - Several machines in different regions take writes, which is quicker for nearby users and survives a region failing, but two edits can clash
  - With no leader at all, a write goes to most of the copies and differences are settled when someone reads
  - Clashes are settled by keeping the latest, by letting the app merge them, or by data types built to merge themselves
  - Choose by where the writes come from, how much clashing you can live with, and whether a client can try another leader
distractors:
  - Multi-leader replication never has write conflicts, because each leader owns its own rows
  - Single-leader replication keeps accepting writes on both sides of a partition
  - Leaderless replication depends on one coordinator node that orders every write
followUps:
  - Why is last-writer-wins dangerous and when is it acceptable?
  - How does a quorum (W + R > N) give you read-your-writes?
references:
  - title: Amazon, Dynamo paper (SOSP 2007)
    url: https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf
  - title: Apache Cassandra docs, Dynamo architecture
    url: https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html
updated: 2026-10-02
reviewed: true
---

**Single leader.** One node accepts all writes and streams them to followers; followers serve reads. There is one total order of writes so there are never conflicts, and most relational databases work this way. Weaknesses: write latency equals distance to the leader, write availability depends on one node, and failover needs care to avoid two leaders.

**Multi-leader.** Each datacenter (or each device, in offline-first apps) has its own leader that accepts writes and exchanges changes with the others asynchronously. Users write locally, the system keeps running if a region is cut off, and write throughput scales out. The cost is that two leaders can accept conflicting writes to the same record and you must decide what "wins":

- *Last-writer-wins* using timestamps: simple, but silently discards data and depends on clock sync.
- *Application-level merge*: store both versions and let code or the user merge (shopping carts, calendars).
- *CRDTs*: data types designed so concurrent updates merge deterministically (counters, sets, text).

**Leaderless.** Any replica accepts writes. A client writes to N replicas and considers the write successful after W acknowledge; reads ask R replicas and take the newest. With W + R > N at least one replica in every read overlaps a successful write. Stale replicas are fixed by *read repair* and *anti-entropy* background sync. Dynamo, Cassandra and Riak use this model to stay writable through node failures and network partitions.

**Picking one.** Single-region OLTP with strong consistency: single leader. Global app that must keep accepting writes in each region: multi-leader with a real merge strategy. Always-writable key-value store with tunable consistency and simple records: leaderless.
