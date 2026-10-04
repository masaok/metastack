---
slug: distributed-locks
title: Distributed locks for system design interviews
description: Distributed locks for system design interviews. Fencing tokens, expiry, the cases Redis misses, and the work that must not run twice.
primaryKeyword: distributed locks
secondaryKeywords:
  - fencing tokens
  - redis locks
  - etcd
category: consensus-and-coordination
tags:
  - concurrency
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the distributed locks answer an interviewer wants. A lock across machines is a lease plus a fencing token, not a boolean in Redis that you hope stays true. The lease expires so a dead holder does not own the resource forever. The token is a number that only goes up, so a late holder cannot write after a new holder has started. Redis can implement the boolean and still miss the pause, the partition, and the late write. ZooKeeper or etcd are slower and more honest about those cases. Some work must not run twice. A lot of work should not use a lock at all. The rest of this post is that pair of tools, those two implementations, the job that needs the lock, and the jobs that do not.

## The lock, the fencing token, and expiry

A distributed lock answers one question. May this process act on this resource right now. The resource is a shard, a file, a job id, a leader role. The process is one of many that could act. Without a lock, two processes act. Two actions on one resource is the bug.

Expiry is required because processes die. A lock that never expires needs a human, or a perfect failure detector, to unlock it. You do not have a perfect failure detector. A missed heartbeat and a slow pause look the same. So the lock is a lease. If the holder does not renew, the lease ends. Another process may then acquire it.

Expiry without fencing is how you get two holders. Process A holds the lock. A pauses long enough for the lease to end. Process B acquires the lock and starts work. A wakes, still believes it holds the lock, and writes. The store accepts both writes. You had a lock. You still had two writers.

A fencing token fixes the late write. Each acquire returns a number larger than the last acquire. A writes with token 3. B later acquires token 4. The store rejects token 3. A's write fails even though A is still running. B's write succeeds. The lock service issues the token. The data store enforces it. A lock service that only says "you have the lock" has done half the job.

The [optimistic versus pessimistic locking card](/cards/optimistic-vs-pessimistic-locking) is the same idea inside one database. Pessimistic takes the row first so others wait. Optimistic reads a version and writes only if the version is unchanged. A distributed lock is pessimistic across processes. A fencing token is the version the store checks when the lock itself can lie about who still holds it. Do not hold either kind of lock across user think time. Do not hold a distributed lock while you call a slow vendor if you can give the work a token and let the store reject the late attempt.

A worked acquire.

```text
acquire(resource=job:44) -> token=12, lease=short
do the work, send writes as (job:44, token=12)
renew the lease if the work is still in progress
release, or let the lease end
```

The store's rule is `accept only if token >= last_token`. A later acquire of token 13 updates `last_token`. Token 12 is then too old. That is the whole mechanism.

## Redis locks and the cases they miss

The common Redis shape is `SET key value NX EX`. The `NX` means only the first writer wins. The `EX` is the expiry. The value is a random id so you delete only your own lock. That shape is a boolean with a timer. It is fine for work you can also make idempotent, and for a best-effort single runner. It is not a complete lock.

The pause case. The holder is inside a garbage-collection pause, or a long disk stall, or a breakpoint. The key expires. Another client sets the key. The paused holder wakes and still has the value it wrote. If it then writes to the resource without a token the resource checks, you have two writers. Redis expired the key correctly. The holder did not expire.

The partition case. The client believes it holds the lock because it received `OK`. A minority of Redis nodes never saw the set. A failover promotes a replica that missed it. Another client can now set the same key. Two clients hold what each thinks is an exclusive lock. A single-node Redis does not have that failover story. A replica that can become primary does.

The delete case. A holder whose lease already expired deletes the key and removes the new holder's lock. Compare-and-delete of your own value only helps while your value is still in the key.

Redlock tries several Redis nodes. A pause longer than the lock validity is still a pause. Name the missed case. Say the pause. Say the token. A Redis boolean does not issue a token the data store will check unless you build that yourself.

[Consistent hashing explained for the interview](/blog/consistent-hashing-explained) is how a key lands on a node. Placement and exclusion are different jobs. The hash tells you where the boolean lives. The token tells you whether a late write may land.

## ZooKeeper or etcd as the slower honest option

ZooKeeper and etcd keep a replicated log. A majority must accept a write. A session or a lease is attached to the client. If the session dies, ephemeral nodes or lease keys go away. A watch wakes the next waiter. The lock is still a lease. The difference is that the lease lives inside a service that already agrees with itself about what was written.

That agreement is why people call this the honest option. You pay the majority latency. You get a single history of who acquired what and in which order. You can attach a monotonic revision or zxid to the acquire and use that as the fencing token. The data store can reject a lower revision. The lock service and the token come from the same log.

Slower is real. A Redis `SET` on one node is a memory write. An etcd put is a majority append. For a lock you take once per job, that cost is usually the right cost. For a lock you want on every user request, it is the wrong cost. That second case is also a hint that you wanted a database row, an optimistic version, or an idempotency key, not a remote mutex on the hot path.

Failure detection is still uncertain. etcd can declare a session dead while the client is only partitioned. The old client can still be running. Honesty here means the service will not pretend two live sessions both hold the same key once the lease has moved. It does not mean the old process has halted. You still send the revision with the write. You still reject the stale revision.

Draw the comparison when asked which to use.

| Tool | What you get | What you still owe | A fit |
| --- | --- | --- | --- |
| Redis `SET NX EX` | A fast boolean with a timer | Your own token, and a story for pauses and failovers | Best-effort single runner, work that is also idempotent |
| etcd or ZooKeeper | A majority log, a session, a revision | The data store must check that revision | A job or a role that must not have two living holders |

Name the row. Do not name a brand and sit down.

## Work that must not run twice

Some work has a side effect that is hard to undo. A nightly job that charges a stored card. A worker that sends a one-time legal notice. A primary that accepts writes for a shard. Two runners are not a retry. They are two effects.

The lock is one half. The other half is an idempotency key for the effect itself. [Idempotency keys in system design](/blog/idempotency-keys) is the stored outcome. The lock reduces the chance that two workers start. The key makes a second start harmless. Use both when the effect is money or a message you cannot retract. A lock alone is a race you almost won. A key alone can still waste work, but it will not double the charge.

A unique job id is a good lock key. `job:invoice:2026-10-03` can be acquired by one worker. That worker loads the unpaid rows, charges each with its own idempotency key, and writes results. If the worker dies, the lease ends. Another worker acquires a new token and continues. Charges already stored under their keys do not run again. Charges not yet stored do.

Leader work is the same shape. One primary per shard. The lock key is the shard. The token goes on every write the primary sends to the store. A second primary that won after a false death still cannot commit with the old token. The lock is the role. The token is the term.

## What you should not use a lock for

Do not use a distributed lock as your consistency model. A lock that the callers remember to take is a lock a new caller will forget. A uniqueness constraint, a version column, or a compare-and-set on the row will still be there when a new service arrives. The database check does not depend on every client speaking the same mutex.

Do not use a lock to protect a user edit that lasts minutes. That is the wiki case on the optimistic card. The user thinks. The lease cannot last that long without blocking everyone else, and it cannot be short without expiring under the user. Send the version the editor loaded. Reject the save if the version moved. Let two people merge.

Do not use a lock to fix a retry. If the client timed out, it will send the same request again. A lock around the handler can still run the handler twice if the first lease expired while the vendor call was in flight. Store the intent under an idempotency key first. The second call finds the row. The lock never had to exist.

Do not use a lock to serialise a hot key that should have been sharded. If every write waits on `lock:global`, you have built a single-threaded cluster. Split the key. A lock does not remove a hot spot.

What you say in the room.

1. A lock is a lease plus a fencing token the store enforces.
2. Expiry without a token is how two holders both write.
3. Redis `SET NX EX` misses pauses and some failovers unless you add the token.
4. etcd or ZooKeeper give you a majority and a revision. They still need the store to check it.
5. Work that must not run twice wants the lock and an idempotency key.
6. Do not lock user think time, retries, forgotten clients, or a hot global key.

Drill the optimistic versus pessimistic card until you can say when a version beats a lock. Start on the [fundamentals study page](/study/fundamentals).
