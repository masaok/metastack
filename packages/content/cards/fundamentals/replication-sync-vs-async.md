---
id: replication-sync-vs-async
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [replication, durability, latency]
prompt: >
  Compare synchronous and asynchronous replication. What does each buy you and
  what does each cost?
keyPoints:
  - Synchronous waits for followers to acknowledge before committing, so a committed write survives leader loss
  - Asynchronous commits locally and ships changes later, giving low write latency but a window of possible data loss
  - Synchronous write latency is bounded by the slowest replica and availability drops if a replica is down
  - Semi-synchronous (one sync follower, rest async) is the common compromise
  - Replication lag causes stale reads from async followers and complicates failover
eli5:
  - Wait for the copies to confirm before saying saved, so a saved write is still there if the main machine dies
  - Say saved straight away and copy afterwards, which is quick but can lose the last few writes
  - Waiting for copies makes every write as slow as the slowest copy, and a copy that is down can stall writes
  - A common middle path waits for one copy and lets the others catch up later
  - Copies that lag behind give out old answers and make it harder to promote one safely
distractors:
  - Asynchronous replication guarantees that no committed write is lost when the leader fails
  - Synchronous replication has lower write latency, because followers share the work
  - With fully synchronous replication the system stays writable when a follower is down
followUps:
  - How do you pick a new leader after a crash under async replication without losing acknowledged writes?
  - What is the relationship to quorum writes in Dynamo-style systems?
references:
  - title: PostgreSQL docs, Synchronous replication
    url: https://www.postgresql.org/docs/current/warm-standby.html#SYNCHRONOUS-REPLICATION
  - title: MySQL docs, Semisynchronous replication
    url: https://dev.mysql.com/doc/refman/8.0/en/replication-semisync.html
updated: 2026-10-02
reviewed: true
---

Replication keeps copies of data on multiple nodes for durability, availability and read scaling. The core knob is whether a write is acknowledged to the client before or after the copies have it.

**Synchronous.** The leader writes locally, sends the change to followers, and only acknowledges when they confirm. Any acknowledged write exists on at least two machines, so losing the leader loses nothing. Costs: every write pays a network round trip to the slowest follower, and if a synchronous follower is unreachable the leader must either block writes or drop to async, which is an availability-versus-durability decision you should make explicitly.

**Asynchronous.** The leader acknowledges as soon as its own write is durable and streams changes afterwards. Writes are fast and the leader keeps working through follower outages. Costs: a follower may lag by milliseconds or minutes; reads from it can be stale, and if the leader dies before shipping its latest writes, those writes are gone even though clients were told they succeeded.

**Semi-synchronous.** Require exactly one follower to acknowledge synchronously and let the rest trail. Durability against a single failure, latency of one healthy round trip. This is what most production relational setups run.

**Failover under lag.** Promoting a lagging async follower silently discards the un-replicated writes. Systems either accept that (and reconcile later), fence the old leader to stop split brain, or use consensus (Raft, Paxos) so a majority agrees on every write before it counts.

Always say which you would choose and why: "financial ledger, semi-sync with a sync replica in another AZ; analytics clickstream, async across regions."
