---
slug: database-replication
title: Database replication for system design interviews
description: Database replication for system design interviews. Why a second copy exists, sync versus async, what a reader may see, and a failover that avoids split brain.
primaryKeyword: database replication
secondaryKeywords:
  - read replicas
category: data-and-consistency
tags:
  - databases
  - consistency
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the database replication answer an interviewer wants. A second copy exists so a disk can die without taking the data with it, so a region can pause without taking writes you cannot afford to lose, and so reads can leave the writer. You then say when the copy must acknowledge before the client hears success. You say what a reader on that copy is allowed to see. You say how a new writer is chosen without two writers. The rest of this post is those four claims, plus the lag you can bound and the lag you cannot.

## Why a second copy exists

Replication stores the same rows on more than one node. Partitioning stores different rows on more than one node. Keep those jobs apart. Three copies of a 2 TB table still hold 2 TB of distinct rows. They survive a dead disk. They serve extra reads. They do not hold 6 TB of new orders.

Name the reason before you draw the arrows. Durability is the first. The writer can fail after the client was told the write succeeded. A second machine that already has the bytes keeps that promise. Availability is the second. A follower can take over, or at least keep serving reads, while the writer is down. Read scaling is the third. Read replicas take `SELECT` traffic so the writer is not the only machine answering them.

Those three reasons pull the design in different directions. Durability wants the copy to have the write before you acknowledge. Availability of writes wants a topology that still accepts a write when one node is gone. Read scaling wants extra machines that can answer a `SELECT` even if they are slightly behind. Say which reason you are serving. Then pick the ack rule.

A single-leader drawing is the interview default. One node takes every write. Followers receive a stream. Followers serve reads you have marked safe for a copy. Most relational products look like this. Multi-leader and leaderless topologies exist. [The leader-follower card](/cards/leader-follower-vs-multi-leader) is the comparison. This post stays on the second copy you draw first, then on what that copy may show a reader.

Do not use replication as a synonym for backup. A backup is a point-in-time image you restore. A replica is a live process applying a stream. Replication will copy a bad write. The backup is the older image.

## Synchronous versus asynchronous replicas

Synchronous replication waits. The leader writes locally, sends the change, and acknowledges the client only after the required followers confirm. A committed write then exists on more than one machine. Losing the leader does not lose that write. The cost is in the same sentence. Every write waits for the slowest required follower. If that follower is down, writes stall, or you drop to a weaker ack and admit the durability change.

Asynchronous replication does not wait. The leader makes the write durable on itself and tells the client success. The stream to followers runs behind. Writes stay fast. The leader keeps taking writes while a follower is restarting. The cost is a window. Writes that have not shipped yet disappear if the leader dies. A reader on a follower can see the previous value after the client already received success.

Semi-synchronous is the usual middle. Wait for one healthy follower. Let the rest trail. You survive the loss of the leader plus that one extra copy. You pay one healthy round trip, not a wait for every follower. Most production relational setups that want a durability story run some form of this. Name it as a compromise, not as a third theorem.

| Mode | When the client hears success | If the leader dies | Write latency |
| --- | --- | --- | --- |
| Synchronous | After the required followers ack | The committed write is on a follower | Bound by the slowest required copy |
| Asynchronous | After the leader is durable | Unshipped writes are gone | Leader disk only |
| Semi-synchronous | After one chosen follower acks | That write survived one extra failure | One healthy hop |

[The sync versus async card](/cards/replication-sync-vs-async) asks what each buys and what each costs. Say both sides. "Financial ledger, wait for one follower in another zone. Click stream, ack locally and ship later." Match the sentence to the data, not to a brand.

Synchronous does not make every replica current. It makes the sync set current enough to cover the ack. Asynchronous replicas in the same cluster still lag. A sync replica that stalls is a write outage unless you have already said you will break the wait.

## What a reader is allowed to see

Read replicas are the cheap way to multiply `SELECT` capacity. They do not multiply write capacity. Every write still lands on the leader, or on the set of leaders you chose. The catch is lag. The replica is behind. Usually a little. Under load, or during a replay, enough that a person can notice.

Read-your-writes is the first bug. A user posts a comment, the handler redirects to the thread, and the thread handler reads a replica that has not applied the insert. The page looks as if the save failed. The write succeeded. The read was early.

Monotonic reads are the second. Two refreshes hit two replicas. One has the comment. One does not. The comment appears, vanishes, and appears again. Random routing across replicas is what causes the flip. Spreading a user at random does not fix it.

A causal miss is the third. A reply is applied before the parent on one replica. A reader sees an orphan.

Preventions, cheapest first. After a write, send that user's reads to the leader for a short window. Stronger: the write returns a log position. The next request carries it. The router picks a replica that has reached it, waits a little, or falls back to the leader. Pin a session to one replica so that person's view moves forward. Drop a replica from the pool when lag exceeds a threshold.

Some reads may be stale. A public catalogue, a public feed, a dashboard that already rounds to minutes. Say so. Reserve leader reads for the person's own just-written data. [The read replicas and lag card](/cards/read-replicas-and-lag) is the rubric for those bugs and those fixes.

A replica read is not a quorum read. One follower answering is a replica read. Waiting for enough copies that one of them must have seen the write is a quorum. [PACELC explained for system design](/blog/pacelc-explained) is the post that times that wait. This post stays on the leader and the copies that trail it.

## Failover that does not split the brain

Failover is how a follower becomes the writer. Split brain is two writers. Two writers accept different updates to the same row. The merge later drops one of them, or the application spends a week reconciling. The interview answer is not "we promote the healthiest replica". The answer is "we fence the old leader so it cannot accept writes, then we promote one follower that we know is allowed to be the source of truth".

Fencing means the old leader's writes are rejected even if that process is still alive. A fencing token that increases on each failover, a disk reservation, a consensus term, or a forced shutoff of the old writer all serve that idea. The mechanism varies. The property does not. Clients and replicas must ignore a writer whose term is behind.

Async lag makes promotion dangerous. The newest follower may still be behind the dead leader. Promoting it drops the unshipped writes. Clients already saw success. You either accept that loss and repair later, or you refuse to promote until you know the chosen replica has the last acknowledged write. Synchronous and semi-synchronous make that knowledge easier. Async plus a wish does not.

Do not let both sides of a partition accept writes in a single-leader system. The side that still holds the leader can write. The other side must refuse. Letting both sides write is how you invent a second leader. [CAP theorem explained for interviews](/blog/cap-theorem-explained) is the partition choice. Replication failover is one place that choice becomes a drawing.

Multi-leader is a different topology. Two datacenters each take writes on purpose. Conflicts are then expected. Last-writer-wins, an application merge, or a CRDT is the resolution. Do not smuggle that into a single-leader failover story.

A consensus group around the election is how some stores avoid two writers. The majority appoints one leader. You still have to fence.

## Lag you can estimate, and lag you cannot

Some lag is physics. A follower in another region pays a one-way trip you can write on the board. If the interviewer gives 80 ms one way, a sync ack to that follower cannot beat a round trip. An async stream cannot apply a change before the bytes arrive. Say the number as a lower bound. Do not pretend a setting removes the trip.

Some lag is a queue. The leader can produce faster than a follower can apply. A burst of writes, a heavy report on the follower, or a stop-the-world pause grows the apply backlog. You can estimate the backlog if you have the catch-up rate and the remaining bytes. You cannot estimate it if you only have "it is usually small".

Some lag you cannot put a number on in the room. A schema change that rewrites a large table. A replica that was down for an hour and is replaying. Offer a measurement, not a guess. Replication delay, or a log-sequence gap, is the metric. A replica that exceeds the threshold leaves the read pool.

A worked case with board numbers. They are examples, not a product measurement. A user updates a display name. Replica A is 5 ms behind. Replica B is 400 ms behind because it is replaying an index build. Random routing hits B and the user sees the old name. Route this user to the leader for a few seconds, or carry the write's log position and refuse B until B has passed it.

Cross-region, a sync follower adds a round trip to every commit. If the write budget is 50 ms and the trip is 150 ms, the sync follower cannot live in that region. Put it nearby. Let the far copy be async. Far readers may be behind by at least the trip, plus apply time.

What you say in the room.

1. A second copy is for durability, availability, or extra reads. It is not more unique capacity.
2. Sync waits and keeps the write. Async is fast and can lose the tail.
3. Semi-sync waits for one follower. Name it as the common compromise.
4. A reader on a replica can miss a write the user already saw. Route, token, or pin.
5. Failover fences the old leader. Do not promote a lagging async copy without saying what you lose.
6. Bound the lag you can. Measure the lag you cannot.

Drill [sync versus async](/cards/replication-sync-vs-async), [read replicas and lag](/cards/read-replicas-and-lag), and [leader versus multi-leader](/cards/leader-follower-vs-multi-leader) as three prompts. Start on the [fundamentals study page](/study/fundamentals).
