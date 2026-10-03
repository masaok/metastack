---
id: unique-id-generator
deck: designs
type: design
difficulty: 2
tags: [databases, scalability, consistency]
prompt: >
  Design a service that generates unique, roughly time-ordered 64-bit ids
  across many datacenters at millions per second with no single point of
  failure.
keyPoints:
  - Rejects a central auto-increment and UUIDv4 for the stated requirements (SPOF, no ordering, 128 bits)
  - Proposes a Snowflake-style layout, timestamp bits, datacenter and machine bits, per-millisecond sequence bits
  - Explains how uniqueness holds without coordination because each generator owns its machine id
  - Handles clock skew and clocks moving backwards by waiting or refusing to generate
  - Discusses alternatives, database ticket servers with ranges, ULID/UUIDv7, and the tradeoffs on sortability and leakage
eli5:
  - One shared counter is a single thing that can break, and random ids are long and carry no order, so neither meets the brief
  - Build each id from the current time, a number for the machine, and a small counter that restarts every millisecond
  - No two machines share a machine number, so they can never produce the same id and never need to ask each other
  - If a machine's clock jumps backwards, it waits or refuses instead of risking a repeat
  - Other choices include handing each server a block of numbers or newer time-ordered id formats, and each trades sortability against revealing information
distractors:
  - Use one database auto-increment sequence shared by all datacenters
  - Random UUIDv4 values meet the requirements, since they fit in 64 bits and sort by time
  - If the clock moves backwards, keep generating, because the sequence bits prevent duplicates
followUps:
  - How do you assign machine ids safely when instances autoscale?
  - What information does a Snowflake id leak and when does that matter?
stages:
  - name: Requirements
    keyPoints:
      - Globally unique, fit in 64 bits, sortable by creation time, generated locally with very low latency
      - Multi-datacenter, horizontally scalable, no single point of failure
  - name: Estimates
    keyPoints:
      - e.g. 10k ids/ms per node needs 12-14 sequence bits, 41 timestamp bits in ms gives ~69 years
      - 10 bits for node identity → 1,024 generators
  - name: API
    keyPoints:
      - nextId() → int64 local library call, or GET /ids?count=n for a service
      - Optionally decode(id) → timestamp, node, sequence
  - name: Data model
    keyPoints:
      - 1 sign bit, 41 timestamp bits (ms since custom epoch), 5 datacenter + 5 machine bits, 12 sequence bits
      - Node id registry (ZooKeeper/etcd lease or config) to prevent duplicate node ids
  - name: High-level design
    keyPoints:
      - Each service instance embeds a generator with a leased node id, no network call per id
      - Fallback central ticket service handing out id ranges for systems that cannot embed
  - name: Deep dives
    keyPoints:
      - Clock handling, refuse or spin if the clock moves backwards, use monotonic clocks plus NTP
      - Sequence overflow in a hot millisecond, spin until the next ms
      - Comparison with UUIDv7/ULID (128-bit, sortable, no coordination) and database ranges (simple, less ordered)
  - name: Bottlenecks and failure
    keyPoints:
      - Duplicate node ids after misconfiguration are the main risk, use leases and verify on startup
      - Large clock drift on a node produces out-of-order ids, monitor NTP offset
      - Epoch exhaustion after ~69 years, choose a recent custom epoch
references:
  - title: Twitter engineering, Announcing Snowflake
    url: https://blog.x.com/engineering/en_us/a/2010/announcing-snowflake
  - title: RFC 9562, Universally Unique IDentifiers (UUIDs), including UUIDv7
    url: https://datatracker.ietf.org/doc/html/rfc9562
updated: 2026-10-02
reviewed: true
---

## Requirements

Ids must be unique across every datacenter, fit in a signed 64-bit integer (database-friendly), sort roughly by creation time so indexes and pagination work well, and be generated at millions per second with microsecond latency. No central service may be on the critical path.

## Estimates

A node generating up to ~4,000 ids per millisecond needs 12 sequence bits (4,096). Supporting 1,024 nodes needs 10 bits. That leaves 41 bits for a millisecond timestamp: 2^41 ms ≈ 69 years from a custom epoch.

## API

In-process library: `nextId() → int64`, plus `decode(id) → { timestamp, datacenterId, machineId, sequence }` for debugging. For systems that cannot embed, a small HTTP service `GET /ids?count=100` that returns a batch.

## Data model

The id layout (Snowflake):

```text
| 1 bit unused | 41 bits timestamp (ms since epoch) | 5 bits datacenter | 5 bits machine | 12 bits sequence |
```

A node-id registry (etcd, ZooKeeper, or a config table) assigns each generator a unique `(datacenter, machine)` pair via a lease.

## High-level design

```mermaid
flowchart LR
  REG[(Node id registry, leased)] --> S1[Service instance + generator]
  REG --> S2[Service instance + generator]
  S1 -->|nextId, no network| ID1[id]
  S2 -->|nextId, no network| ID2[id]
```

Every instance obtains a node id at startup, then generates ids entirely locally. Uniqueness follows from (timestamp, node id, sequence) being unique per node per millisecond and node ids being unique across the fleet.

## Deep dives

**Clock problems.** Generators depend on wall-clock time. If NTP steps the clock backwards, a naive generator could reuse a timestamp and collide with ids it already issued. Fixes: remember the last timestamp used and if `now < last`, either wait until the clock catches up (for small drifts) or refuse to generate and alert (for large ones). Never issue ids with a timestamp earlier than one already used.

**Hot milliseconds.** If the sequence overflows within a millisecond, spin until the next millisecond. At 4,096 per ms per node that is rare.

**Node id assignment.** Static config breaks under autoscaling. Use a lease in etcd or ZooKeeper: an instance claims a free id, renews periodically, and the id is reclaimed if the lease lapses. Verify on startup that no other live instance holds the same id.

**Alternatives.**
- *UUIDv4:* unique without coordination but random, 128 bits, and terrible for B-tree locality.
- *UUIDv7 / ULID:* time-ordered 128-bit ids with no coordination. Great when 128 bits is acceptable; they are the modern default for many systems.
- *Database ticket server:* a table with an auto-increment column handing out ranges to clients (Flickr's approach). Simple, but a central component and ordering only within a range.
- *Database per-shard sequences with shard prefix:* ordered within a shard, but requires knowing the shard at generation time.

## Bottlenecks and failure modes

- **Duplicate node ids** from misconfiguration are the realistic failure; leases plus startup verification prevent them.
- **Clock skew across nodes** means ids are only *roughly* ordered globally; within a node they are strictly ordered. Say this explicitly.
- **Information leakage:** ids reveal creation time and approximate rate; if that matters (public URLs), hash or encrypt them at the API boundary.
- **Epoch exhaustion:** 69 years; pick a recent epoch and document it.
