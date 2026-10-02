---
id: distributed-cache
deck: designs
type: design
difficulty: 2
tags: [caching, availability, scalability]
prompt: >
  Design a distributed in-memory cache like Memcached or Redis Cluster that
  applications use to offload reads from their databases.
keyPoints:
  - Shards keys across nodes with consistent hashing in the client or via a proxy, with replicas per shard for availability
  - Implements eviction (LRU/LFU approximations) and TTLs, and bounds memory per node
  - Protects the database from thundering herds on misses with request coalescing, locks or stale-while-revalidate
  - Addresses hot keys with client-side caching, replication of hot shards or key splitting
  - Defines the consistency contract (cache-aside, invalidation on write) and what happens when a node dies or is added
followUps:
  - How does a client discover the cluster topology and react to a node failure?
  - When would you choose a look-aside cache versus a read-through cache?
stages:
  - name: Requirements
    keyPoints:
      - get, set with TTL, delete, maybe atomic increment and multi-get, sub-millisecond latency
      - Scale to terabytes across nodes, survive node failures, add capacity without a full cache flush
  - name: Estimates
    keyPoints:
      - e.g. 500 GB of hot data at ~1 KB per object is 500M keys, on 64 GB nodes about 10 nodes plus replicas
      - 2M gets/s cluster-wide → ~200k per node, within a single node's capability
  - name: API
    keyPoints:
      - get(key), mget(keys), set(key, value, ttl), delete(key), incr(key, n), cas(key, value, version)
      - Cluster topology endpoint or client-side ring configuration
  - name: Data model
    keyPoints:
      - In-memory hash table per node, values as byte arrays with expiry and LRU metadata
      - Slot or ring assignment mapping key hashes to primary and replica nodes
  - name: High-level design
    keyPoints:
      - Smart client (or proxy like twemproxy/mcrouter) hashes keys to nodes, nodes are independent, replication primary → replica per shard
      - Config/coordination service publishes topology, health checks drive failover
  - name: Deep dives
    keyPoints:
      - Eviction with sampled LRU, memory accounting, slab allocation to avoid fragmentation
      - Cache stampede prevention, single-flight per key, lease tokens, probabilistic early expiration
      - Hot key handling, local L1 cache in the application with short TTL, or replicate the key to multiple shards
  - name: Bottlenecks and failure
    keyPoints:
      - Node loss means a miss storm for that shard, replicas and gradual warm-up protect the database
      - Resharding moves keys, consistent hashing limits movement, migrate slots live
      - Network partitions, prefer availability, treat the cache as best effort and never the source of truth
references:
  - title: Facebook, Scaling Memcache at Facebook (NSDI 2013)
    url: https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala
  - title: Redis docs, Scale with Redis Cluster
    url: https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/
updated: 2026-10-02
reviewed: true
---

## Requirements

Applications call `get`, `set` (with TTL), `delete`, a few atomic operations and multi-key reads, and expect sub-millisecond responses. The cache must hold terabytes across many nodes, keep working when a node fails, and allow adding capacity without flushing everything. It is a performance layer, not a system of record: losing it must degrade latency, not correctness.

## Estimates

Caching 500 GB of hot objects averaging 1 KB means ~500 million keys. With ~50 GB usable per 64 GB node, that is ~10 primaries plus a replica each. Two million gets per second cluster-wide is ~200,000 per node, which a single-threaded Redis or multi-threaded Memcached node can serve.

## API

```text
get(key) -> value | nil          mget(keys[]) -> values[]
set(key, value, ttl)             delete(key)
incr(key, n)                     cas(key, value, version)   // compare-and-swap
cluster.slots() -> [{ range, primary, replicas }]
```

## Data model

Each node is an in-memory hash table from key to `{ bytes, expiresAt, lruClock }`. Cluster metadata maps hash slots (Redis uses 16,384) or ring positions to a primary node and its replicas. Clients cache this map and refresh it on `MOVED` responses or topology change notifications.

## High-level design

```mermaid
flowchart LR
  APP[Application + smart client] -->|hash(key) → slot → node| N1[Shard 1 primary]
  APP --> N2[Shard 2 primary]
  APP --> N3[Shard 3 primary]
  N1 --> R1[Replica]
  N2 --> R2[Replica]
  N3 --> R3[Replica]
  CFG[(Topology / health)] --> APP
  APP -- miss --> DB[(Database)]
```

Nodes do not talk to each other on the request path; the client (or a proxy such as mcrouter) picks the node. Replication within a shard is asynchronous; on primary failure the replica is promoted and the topology update propagates.

## Deep dives

**Eviction and memory.** Exact LRU costs a linked list per key; Redis samples a handful of keys and evicts the least recently used among them, which approximates LRU well. Memcached uses slab classes to avoid fragmentation. Always set `maxmemory` and a policy so the node never swaps.

**Stampede prevention.** When a hot key expires, thousands of requests miss simultaneously and all hit the database. Options: *single-flight* (one request per key fetches, others wait), *leases* (the cache hands a token to the first misser and tells others to retry briefly), *stale-while-revalidate* (serve the expired value while one request refreshes), or *probabilistic early expiration* so refreshes spread out before the TTL.

**Hot keys.** A single key read a million times per second saturates one node. Add a short-TTL in-process L1 cache in the application, or replicate the key under several suffixes (`key#1`..`key#N`) and read a random one.

**Consistency contract.** Cache-aside: the app reads cache, on miss reads the database and sets the cache; on write it updates the database and *deletes* the cache key. Document the staleness window and use leases to prevent the stale-set race.

## Bottlenecks and failure modes

- **Node loss:** the shard's keys all miss until refilled; replicas limit this, and request coalescing keeps the database alive during warm-up.
- **Resharding:** adding nodes with consistent hashing or slot migration moves only a fraction of keys; migrate slots live and have clients follow `ASK`/`MOVED` redirects.
- **Partitions:** a cache should favour availability; a partitioned replica serving slightly stale data is better than errors. Never make the cache authoritative for anything.
- **Large values:** a 10 MB value blocks a single-threaded node; cap value sizes and compress or chunk big objects.
