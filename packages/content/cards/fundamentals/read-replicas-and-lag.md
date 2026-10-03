---
id: read-replicas-and-lag
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [replication, consistency, scalability]
prompt: >
  You add read replicas to scale a read-heavy app. What user-facing bugs does
  replication lag create and how do you prevent them?
keyPoints:
  - Read-your-writes violations, a user saves and immediately sees the old value on the next page
  - Monotonic read violations, refreshing flips between new and old data when requests hit different replicas
  - Route reads to the primary for a short window after a user's write, or when the request carries a recent write token
  - Compare replica LSN or a version with the one returned by the write and wait or fall back if the replica is behind
  - Pin a session to one replica and monitor lag so lagging replicas drop out of the read pool
eli5:
  - You save a change, reload, and see the old value, because the copy you read from has not caught up
  - You refresh and the data flips between new and old, because each request reached a different copy
  - Right after someone writes, send that person's reads to the main database for a short while
  - Or carry a marker of how far the write got and only read from a copy that has reached it, waiting or falling back otherwise
  - Keep each person on one copy, and stop sending reads to any copy that falls too far behind
distractors:
  - text: Synchronous commit on the primary guarantees that an asynchronous replica is never behind
    why: Synchronous commit covers only the replicas that are configured as synchronous. Asynchronous ones still lag
  - text: Spreading each user's reads randomly across replicas prevents data flipping between old and new
    why: Random routing is what causes the flipping, because consecutive reads hit replicas at different points in time
  - text: Lag only affects analytics queries, users never notice it
    why: A user who saves and reloads can be served the old value from a lagging replica, which looks like lost data
followUps:
  - How would you pass a "last write position" from the client through to the read routing layer?
  - When is reading stale data completely fine?
references:
  - title: PostgreSQL docs, Hot standby and query conflicts
    url: https://www.postgresql.org/docs/current/hot-standby.html
  - title: GitHub engineering, Mitigating replication lag and reducing read load on MySQL at GitHub
    url: https://github.blog/engineering/infrastructure/mitigating-replication-lag-and-reducing-read-load-on-mysql-at-github/
updated: 2026-10-02
reviewed: true
---

Read replicas are the cheapest way to multiply read capacity, and they come with one catch: a replica is always slightly behind the primary. Usually milliseconds, under load or during a schema change sometimes minutes.

**Bugs lag creates**

- **Read-your-writes.** A user updates their display name, the app redirects to the profile page, and the profile page reads from a replica that has not applied the change yet. The user sees the old name and assumes the save failed.
- **Monotonic reads.** Two refreshes hit two replicas with different lag; the comment appears, disappears, and reappears.
- **Causal violations.** A reply is replicated before the message it answers, so a reader sees an orphaned reply.

**Preventions, cheapest first**

1. **Read from the primary after a write.** Set a short-lived cookie or session flag when the user writes; route that user's reads to the primary for the next few seconds. Simple and covers most cases.
2. **Write position tokens.** The write returns the primary's log position (LSN, GTID). The client sends it back on subsequent requests; the router picks a replica that has applied at least that position, or waits briefly, or falls back to the primary.
3. **Session pinning.** Hash the user to one replica so at least their view is monotonic.
4. **Lag-aware pools.** Health checks measure replica lag and remove replicas beyond a threshold from the read pool; alert when lag grows.
5. **Design for staleness where it is fine.** Product listings, public feeds and analytics can be stale by seconds with no one noticing; reserve primary reads for the user's own data.

Mention that writes still all go to one primary, so replicas do not help a write-heavy workload, and that cross-region replicas add tens of milliseconds of lag by physics alone.
