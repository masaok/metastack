---
id: sharding-strategies
deck: fundamentals
type: concept
difficulty: 2
tags: [sharding, scalability, databases]
prompt: >
  Explain horizontal partitioning (sharding). Compare range, hash and
  directory-based sharding.
keyPoints:
  - Sharding splits one dataset across many nodes so storage and write throughput scale beyond one machine
  - Range sharding keeps adjacent keys together and supports range scans but creates hot spots on monotonically increasing keys
  - Hash sharding spreads load evenly but destroys key ordering and makes range queries scatter-gather
  - Directory (lookup table) sharding is flexible and supports rebalancing but adds a lookup hop and a component that must be highly available
  - Cross-shard joins and transactions are expensive, so the shard key should match your main access pattern
followUps:
  - How do you resplit a shard that has grown too large without downtime?
  - Where would you put a secondary index in a sharded system?
references:
  - title: MongoDB docs, Sharding
    url: https://www.mongodb.com/docs/manual/sharding/
  - title: Vitess docs, Sharding
    url: https://vitess.io/docs/reference/features/sharding/
updated: 2026-10-02
reviewed: true
---

Vertical scaling ends at the biggest machine you can buy. Sharding (horizontal partitioning) splits the rows of a table across many machines so each holds a slice. Every row is assigned to a shard by a function of its **shard key**.

**Range sharding.** Shard 1 holds keys A–F, shard 2 holds G–M, and so on. Range queries ("all orders from this week") touch one or a few shards and keys stay sorted. The trap is a key that grows monotonically, such as a timestamp or auto-increment id: every insert lands on the last shard and you have a single hot node. HBase and Bigtable are range-partitioned.

**Hash sharding.** Apply a hash to the key and take it modulo the number of shards (or better, use consistent hashing). Load spreads evenly regardless of key pattern, but neighbouring keys land on different nodes so a range query must fan out to every shard and merge. Cassandra's partitioner and most key-value stores hash.

**Directory-based sharding.** A lookup service maps each key (or key range, or tenant) to a shard. You can move a single hot tenant to its own shard and rebalance freely. In exchange the directory is on every request path and must be cached and replicated carefully.

**Compound and hybrid keys.** Many systems hash a coarse prefix (tenant id) and range-partition within it, getting even distribution across tenants and ordered scans inside one.

Whatever the scheme, operations that cross shards (joins, unique constraints, transactions) become distributed problems, so pick the key that keeps your dominant queries on a single shard and denormalise or use async pipelines for the rest.
