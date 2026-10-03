---
id: read-write-ratio-and-replicas
deck: estimation
type: estimation
difficulty: 2
tags: [estimation, replication, databases]
prompt: >
  A database sees 2,000 writes per second and a 50:1 read-to-write ratio. A
  single node handles ~15,000 queries per second. How many read replicas do you
  need, and what else should you check?
keyPoints:
  - Reads, 2,000 × 50 = 100,000 reads per second, peak maybe 200,000
  - Every replica must also apply all 2,000 writes per second, so each has ~13,000 QPS left for reads
  - 100,000 / 13,000 ≈ 8 replicas average, ~15 at peak, so plan around 10-16 plus failure headroom
  - Check write amplification, replication lag, connection counts and whether a cache in front would remove most reads first
  - Beyond ~10-15 replicas, replication fan-out and consistency pain argue for caching or sharding instead
eli5:
  - Multiply writes per second by the reads per write to get reads per second, then double it for busy times
  - Every copy has to replay all the writes too, so only what is left of its capacity can serve reads
  - Divide the reads by what one copy can serve to count copies, then add spares for failures
  - Before adding copies, check how far they fall behind, how many connections they need, and whether a cache would remove most reads
  - Past a dozen or so copies, feeding them all gets painful, so cache or split the data instead
distractors:
  - text: Replicas do not apply writes, so each one offers its full 15,000 QPS for reads
    why: Each replica must replay every write, which uses 2,000 of its 15,000 QPS
  - text: 2,000 × 50 = 10,000 reads per second
    why: 2,000 × 50 is 100,000
  - text: Adding replicas scales linearly without limit, so 100 replicas is as easy as 10
    why: Each added replica increases replication fan-out and lag, so the gains flatten beyond about 10 to 15
followUps:
  - How does adding a cache with a 90% hit rate change the replica count?
  - When do you move from replicas to sharding?
references:
  - title: PostgreSQL docs, High availability, load balancing, and replication
    url: https://www.postgresql.org/docs/current/high-availability.html
  - title: AWS Aurora docs, Replication with Amazon Aurora
    url: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Replication.html
updated: 2026-10-02
reviewed: true
---

Replica counting is simple division with two traps: replicas do not get the full node capacity for reads, and the answer often tells you to stop adding replicas.

**Read load**
2,000 writes/s × 50 = **100,000 reads/s average**. With a 2× peak factor, **200,000 reads/s**.

**Capacity per replica**
A replica is not free of writes: it must replay every write the primary accepts. If a node does ~15,000 queries/s and 2,000 of those are replicated writes, each replica has roughly **13,000 QPS** for reads. (Replaying from a log is cheaper than executing the original write, so this is conservative.)

**Replica count**
Average: 100,000 / 13,000 ≈ **8 replicas**.
Peak: 200,000 / 13,000 ≈ **16 replicas**.
Add one or two for failure and maintenance: **~16–18 nodes** in the read pool.

**Things to check before buying 18 database servers**

1. **Would a cache fix it?** If 90% of reads hit a cache, database reads drop to 20,000 peak and you need 2 replicas. This is almost always the right first move for read-heavy workloads.
2. **Replication lag.** More replicas do not increase lag per se, but a primary streaming to 16 followers uses bandwidth and CPU; cascading replication (replicas of replicas) helps.
3. **Connections.** 200,000 reads/s through connection pools; each replica needs a pooler (PgBouncer) in front or you run out of connections before CPU.
4. **Query mix.** The 15,000 QPS figure assumes point reads. Analytical scans count for hundreds each; route them to dedicated replicas.
5. **Write headroom.** 2,000 writes/s is fine for one primary. At 10,000+ you start planning shards, and sharding also divides the read load.

**The lesson.** When the replica math gives a number above ~10, the right answer is usually "add a cache, then reconsider", not "add replicas". State that explicitly.
