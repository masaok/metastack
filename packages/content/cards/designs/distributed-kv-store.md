---
id: distributed-kv-store
deck: designs
type: design
difficulty: 3
tags: [storage, replication, consistency]
prompt: >
  Design a distributed key-value store like DynamoDB or Cassandra that stays
  available under node failures and scales horizontally.
keyPoints:
  - Partitions keys across nodes with consistent hashing and virtual nodes, replicating each key to N successors
  - Uses quorum reads and writes (W + R > N) with tunable consistency per request
  - Resolves concurrent writes with vector clocks or last-writer-wins and repairs divergence with read repair and anti-entropy (Merkle trees)
  - Handles temporary failures with hinted handoff and detects membership changes with gossip
  - Builds the storage engine on an LSM tree (memtable, commit log, SSTables, compaction) for write throughput
eli5:
  - Place keys on a ring of machines and copy each key to the next few machines along
  - Ask several copies and trust the answer once enough agree, with the caller choosing how many is enough
  - When two writes collide, use version tags or the latest timestamp to pick a winner, and quietly fix copies that drifted apart
  - If a machine is briefly down a neighbour holds its mail, and machines gossip to learn who is alive
  - Writes go to memory and an append-only journal first, then get sorted into files that are merged later, which keeps writes fast
distractors:
  - text: Route every write through a single leader node, which keeps the system available under any failure
    why: A single leader is a single point of failure for writes, which contradicts staying available under node failures
  - text: Use quorums with W + R ≤ N so that reads always see the latest write
    why: The read and write sets overlap only when W + R is greater than N. Otherwise a read can miss the latest write
  - text: Build the storage engine on a B-tree updated in place, since that gives the best write throughput
    why: In-place B-tree updates need random writes. An LSM tree turns writes into sequential appends, which is faster
followUps:
  - How does a client know which node to talk to, and what happens if it picks the wrong one?
  - How would you add secondary indexes or range queries to a hash-partitioned store?
stages:
  - name: Requirements
    keyPoints:
      - get(key), put(key, value), delete(key) with values up to ~1 MB, horizontal scalability, high availability
      - Tunable consistency, low latency (single-digit ms p99), durable, no single point of failure
  - name: Estimates
    keyPoints:
      - e.g. 100 TB of data with 3x replication on nodes with 2-4 TB usable → ~100-150 nodes
      - 1M ops/s spread over the cluster, ~10k ops/s per node
  - name: API
    keyPoints:
      - get(key, consistency) → value(s) with version, put(key, value, context), delete(key)
      - Consistency level per call, ONE, QUORUM, ALL
  - name: Data model
    keyPoints:
      - Opaque binary keys and values, each with a version (vector clock or timestamp) and TTL
      - Partition ring metadata, token ranges per node, replication factor per keyspace
  - name: High-level design
    keyPoints:
      - Any node accepts requests as coordinator, hashes key to the ring, forwards to N replicas, waits for W or R acks
      - Gossip for membership, failure detector, hinted handoff for down replicas
  - name: Deep dives
    keyPoints:
      - Consistent hashing with vnodes for balanced distribution and incremental rebalancing
      - Vector clocks to detect concurrent versions, returned to the client to reconcile, vs LWW simplicity
      - LSM storage, writes to commit log and memtable, flushed to SSTables, Bloom filters per SSTable, compaction
  - name: Bottlenecks and failure
    keyPoints:
      - Node failure handled by replicas and hinted handoff, permanent loss by streaming from replicas
      - Hot keys mitigated by client-side caching or key salting
      - Compaction and GC pauses causing latency spikes, tune and schedule
references:
  - title: Amazon, Dynamo paper (SOSP 2007)
    url: https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf
  - title: Apache Cassandra docs, Architecture overview
    url: https://cassandra.apache.org/doc/latest/cassandra/architecture/overview.html
updated: 2026-10-02
reviewed: true
---

## Requirements

A store exposing `get`, `put` and `delete` on opaque keys with values up to about a megabyte. It must scale by adding commodity nodes, keep serving reads and writes when nodes fail or the network partitions, offer single-digit-millisecond latency, and let callers choose between stronger consistency and lower latency per request.

## Estimates

100 TB of logical data at replication factor 3 is 300 TB on disk. With 2–4 TB usable per node (leaving room for compaction), that is 100–150 nodes. One million operations per second across the cluster is ~10,000 per node, which an LSM-based node handles comfortably.

## API

```text
put(key, value, context?) -> ok
get(key, consistency=QUORUM) -> [{ value, version }]   // may return siblings
delete(key)
```

`consistency` is `ONE`, `QUORUM` or `ALL`, trading latency and availability for recency.

## Data model

Keys and values are bytes. Each stored value carries a version (vector clock or timestamp), optional TTL, and a tombstone flag for deletes. Cluster metadata holds the ring (token ranges per node) and the replication factor.

## High-level design

```mermaid
flowchart LR
  C[Client] --> N1[Node A, coordinator]
  N1 -->|hash key → ring| N2[Replica 1]
  N1 --> N3[Replica 2]
  N1 --> N4[Replica 3]
  N1 -. gossip .- N2
  N2 -. gossip .- N3
  N3 -. gossip .- N4
```

Any node can coordinate. It hashes the key onto the ring, identifies the N replicas (the next N distinct nodes clockwise), sends the request to all, and responds once W (writes) or R (reads) have acknowledged. Membership and liveness spread by gossip; each node runs a failure detector.

## Deep dives

**Partitioning.** Consistent hashing with virtual nodes: each physical node owns many small token ranges, so adding a node pulls a sliver from everyone and a failed node's load spreads across the cluster rather than onto one neighbour.

**Quorums.** With N = 3, W = 2, R = 2, every read overlaps every successful write on at least one replica. W = 1 gives the fastest, most available writes at the cost of possibly reading stale data; W = 3 makes writes fail if any replica is down. Expose this per request.

**Conflicts.** Under availability-first writes, two replicas can accept different values for the same key. Vector clocks (one counter per coordinator) let the store detect concurrency and hand both versions ("siblings") back to the client to merge; shopping carts are the classic example. Last-writer-wins by timestamp is simpler and what most deployments choose, accepting silent loss on true conflicts.

**Repair.** *Read repair* writes the newest version back to stale replicas on each read. *Anti-entropy* compares Merkle trees between replicas in the background and streams differing ranges. *Hinted handoff* keeps a write destined for a down replica on another node and delivers it when the replica returns.

**Storage engine.** Writes append to a commit log and an in-memory memtable; memtables flush to immutable sorted files (SSTables). Reads check the memtable, then SSTables newest-first, skipping files whose Bloom filter says the key is absent. Compaction merges SSTables and drops tombstones.

## Bottlenecks and failure modes

- **Node loss:** replicas keep serving; a replacement node streams its ranges from peers.
- **Hot keys:** one celebrity key overwhelms its three replicas; cache at the client or salt the key into several sub-keys.
- **Latency spikes:** compaction I/O and JVM-style pauses show up at p99; throttle compaction and size heaps carefully.
- **Tombstone accumulation:** heavy deletes slow reads until compaction; set `gc_grace` thoughtfully.
- **Split brain:** without a leader there is none to split, but a partitioned minority will accept writes that must be reconciled later; that is the chosen tradeoff and you should say so.
