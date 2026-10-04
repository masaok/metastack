---
slug: leader-election
title: Leader election for system design interviews
description: Leader election for system design interviews. Why one writer exists, how leases and fencing stop a dead leader, and how to draw split brain.
primaryKeyword: leader election
secondaryKeywords:
  - fencing tokens
  - split brain
  - leases
category: consensus-and-coordination
tags:
  - consistency
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the leader election answer an interviewer wants. One node serialises writes so the cluster has a single order. You elect that node. You give it a lease so a dead leader stops being believed. You give each term a fencing token so a zombie cannot write after its lease is gone. You draw the split that creates two writers. Then you say when you actually want several writers. The rest of this post is that sequence, plus the lines the leader-follower card already asks you to say.

## Why only one writer may exist

A write that two nodes accept at the same time is two versions of the same record. There is no automatic winner. Last-writer-wins needs clocks you trust. An application merge needs code you wrote. A type that merges itself needs that type. None of those appear for free. A single writer avoids the fork. Every write goes through one node. That node assigns an order. Followers apply the same order. Readers can disagree about recency. They do not disagree about which write came first.

That is why a primary exists. It is not a prestige role. It is a serialiser. The cluster trades write availability on the other side of a partition for a conflict-free log. [CAP theorem explained for interviews](/blog/cap-theorem-explained) is that trade. While the network is split, the side that does not hold the leader must refuse writes, or you have two leaders. A node that answers on the minority side with a new value has given up the single order.

Name what the leader owns. A leader for one shard is not a leader for the cluster. A leader for the metadata store is not a leader for the blob path. Say the key or the log that this election covers. An answer that says "we elect a leader" and then draws every write going everywhere has not chosen a topology.

The other topologies are real. They are not a failed election. Multi-leader and leaderless still need a story for two concurrent writes. Single-leader is the design that refuses those two writes. The last section names them. The trap is treating failover as a detail. If the old leader is only paused, and a new leader starts, both will accept writes until something stops the old one. Election without fencing is how you get two writers after you promised one.

## Leases, fencing, and a dead leader

Death is a guess. A missed heartbeat and a slow network look the same from the outside. A long garbage-collection pause looks the same. You cannot wait forever to be sure. You also cannot declare death and then trust that the declared-dead node has stopped. The [heartbeats card](/cards/heartbeats-and-failure-detection) is that uncertainty. Leader election sits on top of it.

A lease is a time-limited right to be the leader. The leader renews the lease. If renewals stop, the lease expires. Another node may then win the next election. The lease is what makes a dead leader stop being believed, eventually. Eventually is the problem. The old leader may still be running. It may still have a request in hand. It may still send a write to the store after the rest of the cluster has moved on.

A fencing token is the number that stops that write. Each election issues a token that is strictly larger than the last. Every write to the store carries the token. The store keeps the highest token it has seen for that resource. A write with a smaller token is rejected. The zombie can still speak. The store does not listen. The token is not a wall clock. It is a counter. Clocks can jump. Counters that only go up do not.

The pair is the answer. The lease makes progress after a failure. The token makes the old term harmless. Say both. A lease without a token is a hope that the old leader has really stopped. A token without a lease is a number with no rule for when a new election may start.

Prefer a store that grants and expires the lease itself, and a token the store increments. Wall clocks between machines can jump. The leader asks. The store answers.

A worked sequence. Node A holds token 7. A pauses. B wins with token 8. A wakes and writes with token 7. The store already has 8. The write fails. B's write with 8 succeeds. That is fencing. Draw that before you name a product.

## Election versus Raft's election

Leader election in a design interview is often a role. You need one primary for a shard. You need one scheduler. You need one writer for a partition of a log. The algorithm that chooses the node can be a lock in ZooKeeper, a campaign in etcd, or a compare-and-set on a well-replicated row. The point is one winner, a lease, and a token.

Raft's election is a specific algorithm for a replicated log. Nodes have terms. A candidate asks for votes. A majority of the voting group must grant the vote. A voter refuses if its own log is more complete, or if it already voted in that term. The winner becomes the leader of that log for that term. Followers accept appends only from that leader. The election is not a generic mutex. It is how the log stays one log.

Do not say "we use Raft" when you mean "we fail over to a new primary." Those can be the same system. They are not the same sentence. If etcd or ZooKeeper only picks a primary for another store, your data plane still needs fencing against the old primary.

The tell is the log. Raft cares whether the candidate's log is at least as complete as the voters'. A lock that only stores `leader=B, token=8` does not compare logs. That is fine when the resource is a role. A log that must not lose committed entries needs the algorithm that protects the log.

[PACELC explained for system design](/blog/pacelc-explained) is the healthy-network cost. A majority election waits for a majority. That wait is latency you pay even when nobody has failed. A weaker election that waits for one node is faster and can crown two winners. The majority is the usual trick because two majorities of the same group cannot be disjoint. Two disjoint winners need a split that the majority rule refuses.

## Split brain you can draw

Three nodes. Call them A, B, and C. They replicate one key, `account-17`. A is the leader. Token 4. B and C are followers. Every write goes to A. A ships the same order to B and C.

The network then splits. A can still talk to clients on its side. A cannot talk to B or C. B and C can talk to each other. A has not crashed. From B and C, A has missed its heartbeats. They start an election. B wins. Token 5.

| Side | Who it believes | Token it will send | What a write does without fencing |
| --- | --- | --- | --- |
| A alone | A is still leader | 4 | A accepts the write and thinks it committed |
| B and C | B is leader | 5 | B accepts a different write and thinks it committed |

That table is split brain. Two nodes accept writes to the same key. The values fork. When the network heals you have two histories. Last-writer-wins will drop one of them. A human merge will keep both and ask. Neither is the single order you promised when you chose a single leader.

Fencing changes the last column. The store, or the disk, or the replica that applies writes, rejects token 4 once it has seen token 5. A's clients get errors. B's clients get the new value. The minority side has given up availability. The single order held.

Draw this on the board. Three boxes. A line through the middle. Write the tokens on both sides. Walk one client write on each side. Then say whether the store checks the token. If it does not, you have two leaders. If it does, you have one leader and a refused write. A witness is a later refinement. The side that cannot form a majority still does not elect. The store still rejects the old token.

## What the leader-follower card already asks you to say

The [leader-follower versus multi-leader card](/cards/leader-follower-vs-multi-leader) is the topology choice. Election is the mechanism inside the single-leader row. Do not let the mechanism replace the choice.

Single leader. One node takes every write and streams them to followers. Followers serve reads. There is one total order, so there are no write conflicts. Writes cannot survive a partition that cuts off the leader. Failover needs a lease and a fencing token so you do not create a second leader. Write latency is the distance to that one node.

Multi-leader. Several nodes accept writes, usually one per datacenter or one per offline device. Each leader exchanges changes later. Nearby users write nearby. A region can keep taking writes when another region is gone. Two leaders can change the same record. You then pick a rule. Last-writer-wins is simple and can drop a write if clocks lie. The application can store both versions and merge. A type built to merge can merge itself. Name the rule. Do not say multi-leader and then pretend conflicts do not happen.

Leaderless. Any replica accepts a write. The client waits for a write quorum. A read asks a read quorum and takes the newer version. Overlap is how a read sees a successful write. Stale copies catch up with repair. Order is not a leader. Order is a quorum plus a version. That is a different interview. It is still a valid answer when the records are simple and you can name the merge.

How you pick. Single-region work that wants a conflict-free order starts with one leader. A global app that must keep writing in each region picks several leaders and a real merge. A key-value store that must stay writable through node loss picks a quorum and a version rule. Write locality, conflict tolerance, and whether a client can retry against another writer are the three signals.

What you say in the room.

1. One writer exists so writes have one order.
2. A partition that still accepts writes on both sides is two writers.
3. A lease ends the old term. A fencing token rejects the old term's writes.
4. Death is a guess. The old leader may still be running.
5. Raft elects a leader of a log. A lock elects a role. Say which one you mean.
6. Multi-leader and leaderless are other topologies, not a broken election.

Drill the card until those six lines come out in that order. Start on the [fundamentals study page](/study/fundamentals).
