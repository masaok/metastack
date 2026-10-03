---
id: consistency-models
deck: fundamentals
type: concept
difficulty: 3
tags: [consistency, replication]
prompt: >
  Define linearizability, sequential consistency, causal consistency and
  eventual consistency. Give a user-facing example of each guarantee failing.
keyPoints:
  - Linearizable, every operation appears to take effect instantly at some point between its start and end, in a single global order
  - Sequential, all clients see the same order of operations, but that order need not match real time
  - Causal, operations that are causally related are seen in order by everyone, concurrent ones may be seen in different orders
  - Eventual, with no new writes all replicas converge, no ordering guarantees in the meantime
  - Session guarantees (read-your-writes, monotonic reads) are the practical middle ground most apps need
eli5:
  - Strictest of all, everything looks as if it happened on one machine, one step at a time, in real-time order
  - One step looser, everyone sees the same order of events, but that order may not match the clock
  - Looser again, cause always comes before effect for everyone, while unrelated events may appear in different orders
  - Loosest, the copies agree once the writing stops, with no promises before then
  - Most apps just need you to see your own changes and never see time go backwards
distractors:
  - Eventual consistency guarantees that a client reads its own write straight away
  - Sequential consistency requires the agreed order to match real-time order, exactly as linearizability does
  - Causal consistency puts every operation, concurrent ones included, into one total order that all clients see
followUps:
  - How would you implement read-your-writes with async read replicas?
  - Why is causal consistency the strongest model that stays available under partition?
references:
  - title: Jepsen, Consistency models
    url: https://jepsen.io/consistency
  - title: Werner Vogels, Eventually consistent (ACM Queue)
    url: https://queue.acm.org/detail.cfm?id=1466448
updated: 2026-10-02
reviewed: true
---

Consistency models are contracts about what reads may return given a history of writes. From strongest to weakest:

**Linearizability.** The system behaves as if there is a single copy of the data and each operation happens atomically at one instant between its invocation and response. If a write completes and then a read starts, the read must see it. *Failure example:* you change your password, the confirmation shows, and the next login from the same screen still accepts the old one.

**Sequential consistency.** Every client observes operations in the same order, and each client's own operations appear in program order, but that order does not have to respect wall-clock time across clients. *Failure example:* two users see the same chat history, but one of them sees messages posted several seconds after they really happened.

**Causal consistency.** If operation B could have been influenced by A (same client, or B read A's result), everyone sees A before B. Independent operations may be observed in any order. *Failure example:* you see a reply to a comment before the comment it replies to.

**Eventual consistency.** If writes stop, all replicas eventually agree. Nothing is promised in between. *Failure example:* you post a photo, refresh, and it is gone, then refresh again and it is back.

**Session guarantees** sit between causal and eventual and are what most products actually need:

- *Read-your-writes*: a client sees its own updates (route the user's reads to the leader for N seconds after a write, or compare a version token).
- *Monotonic reads*: a client never sees time go backwards (pin a session to one replica).
- *Monotonic writes* and *writes-follow-reads*: a client's writes are applied in order and after what it read.

Interviewers want to hear the definition, a concrete user-visible failure, and the cheap technique that fixes it.
