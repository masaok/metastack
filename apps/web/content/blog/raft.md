---
slug: raft
title: Raft consensus for system design interviews
description: Raft consensus for system design interviews. Leader, log, and majority, an election after a crash, and what Raft still does not give you.
primaryKeyword: raft
secondaryKeywords:
  - paxos
category: consensus-and-coordination
tags:
  - consistency
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the Raft consensus answer an interviewer wants. One leader takes client writes. It appends them to a log. A majority of replicas vote that those entries are durable. After that vote, a read against the leader can return the new value and you can call the write committed. A primary that only streams to replicas asynchronously does not give you that vote. The rest of this post is the three pieces, an election after the leader dies, why Paxos is the same idea with a harder story, what Raft still does not give you, and a metadata store that needs it.

## Leader, log, and majority

Raft elects one leader per term. Clients send writes to that leader. The leader appends the write to its log and ships the new entry to followers. The write is committed when a majority of the cluster has stored that entry. The leader then applies it to its state machine and replies. Followers apply once they know the entry is committed.

Majority is the whole trick. In five nodes, three is a majority. Two failed nodes still leave a majority that can accept writes. Two nodes cannot. A write that reached only two of five is not committed. If the leader dies, that write may vanish. Say that before you say "replicated."

The log is a sequence. Each entry has an index and a term. The term is the election era in which the leader wrote it. Raft never commits a hole. Index 17 commits only if the prefix through 17 is on a majority. Followers reject an append that does not match their prefix. The leader repairs a follower by walking back and replacing the disagreeing suffix. That repair is why a newly elected leader can bring a stale follower forward.

Reads need a sentence of their own. A follower can be behind. Serving a read from a random follower can return a value the leader has already replaced. If the interviewer asked for linearizable reads, you read on the leader, or you confirm the leader is still the leader with a majority heartbeat, or you use a known read-index trick. [CAP theorem explained for interviews](/blog/cap-theorem-explained) is the same choice. During a partition the majority keeps writing. The minority stops.

Compare this to a single primary with asynchronous replicas. The primary can reply after it writes locally. A replica may not have the row. If the primary dies, a replica that was promoted can be missing the last write. Raft's majority vote is what you add when that hole is unacceptable.

A small table keeps the pieces named.

| Piece | Job |
| --- | --- |
| Leader | Accepts writes, appends, drives followers |
| Log | Ordered entries, each with an index and a term |
| Majority | The vote that makes an entry committed |
| State machine | The key-value, or the metadata, built by applying the log |

Three nodes is the smallest cluster that can lose one and still have a majority. Two nodes cannot. A tie has no majority.

## An election after the leader dies

The leader sends heartbeats. Followers reset an election timer on each heartbeat. When the timer fires, the follower assumes the leader is gone. It increments its term, votes for itself, and asks the others for votes. A node votes for at most one candidate in a term, and only if the candidate's log is at least as complete as its own. The completeness check is the safety that keeps a stale node from winning.

The first candidate to collect a majority of votes becomes leader of the new term. It then sends heartbeats and starts taking writes. Entries from the old leader that never reached a majority are not committed. The new leader's log wins. Those uncommitted entries can be overwritten.

Walk five nodes. Call them A through E. A is leader. A, B, and C have entry 17. D and E do not. Entry 17 is committed. A dies. B's timer fires. B asks for votes in term 8. C and D vote for B. B has three votes including itself. B is leader. B still has entry 17. D will receive it.

A different death is the one people skip. A writes entry 18 to itself only, then dies. Entry 18 never reached a majority. B wins the election. B does not have 18. A later comes back as a follower. A's 18 is replaced. The client that did not get a success must retry. The retry is a new write. This is why a client must not treat a timeout as success.

Split votes happen when two candidates start at once. Neither reaches a majority. Both time out. Randomized election timeouts make a second tie less likely. Mention the randomization. It is the practical reason elections finish.

A partition that cuts the leader off from a majority looks like a death to the majority. The majority elects a new leader and keeps writing. The old leader, if it can still hear a minority of clients, must not accept writes. Raft's term check stops it. A client that can only reach the old leader gets an error or a redirect. That is the CAP choice again. The majority stayed consistent. The minority became unavailable for writes.

The [Raft visualization](https://raft.github.io/) is the animation people use to watch a term change. In the room you still walk A through E with a marker.

## Why Paxos is the same idea with a harder story

Paxos is the older name for majority agreement on a value. Raft is a specific protocol that makes the same promise and is easier to teach. If the interviewer says Paxos, do not start a history lecture. Say what is shared, then say what Raft added for operators.

Both agree on one value, or one log of values, by collecting a majority. Both survive the loss of a minority. Both refuse to let a stale node overwrite a committed value. Both pay a round of messages on the write path, or on the election path, to get that majority.

Paxos, in the single-decree form people quote, agrees on one slot. A log is many slots. Multi-Paxos is Paxos with a stable leader so you do not run a full prepare on every slot. Once you have a stable leader and a log, you are in Raft's shape. The difference is how the story is told and how leader election, log repair, and membership changes are specified.

Raft's teaching choices are the ones you can repeat. Roles are leader, follower, and candidate. The log is first-class. Elections are explicit. Membership change is a joint-consensus step, not an exercise left to the reader. Those choices are why interviewers ask for Raft by name.

Do not claim Raft is faster, or safer in a way Paxos is not, unless you name a specific implementation bug. The idea is the same. The story is harder with Paxos because the paper does not hand you the log and the election as one protocol. In the room, "Paxos is majority agreement; Raft is the log-and-leader version I can draw" is enough.

If someone asks which one etcd or Consul speak, the answer is Raft. ZooKeeper's Zab is a related majority-log protocol. Translate. Do not fight the name.

## What Raft does not give you

Raft commits a log. It does not design your product.

It does not shard your data. Five nodes hold one replica set. A million keys still live in that one replicated state machine unless you put a shard map in front. [Consistent hashing explained for the interview](/blog/consistent-hashing-explained) is how you place those shards. Each shard may run its own Raft group. That is many clusters, not one magic cluster.

It does not make a cross-shard transaction. Two keys on two groups still need a higher protocol if they must commit together. Raft on each side only orders that side.

It does not replace a queue, a cache, or a blob store. Putting user photos in a Raft log is a way to fill a disk. The log wants small metadata, configuration, and the next index.

It does not give you availability on the minority side of a partition. The majority works. The rest waits. If you needed the minority to accept writes, you did not want Raft. You wanted a store that answers and reconciles later.

It does not make a client request durable because you sent it. The client needs a retry with an idempotency token. A timeout before the majority vote can mean "never written" or "written and the reply dropped." Raft does not close that hole.

It does not size itself. Three nodes lose one and continue. Five nodes lose two. Seven is slower writes and more failure tolerance. Each extra node is another disk and another vote to wait for. Pick from the failure you must survive, not from a habit.

It does not apply entries out of order. A slow follower lags. A read on that follower is stale. Scale-out reads either accept that, take a lease, or go to the leader.

## A metadata store that needs it

The prompt that needs Raft is a small record every other service must see the same way. Shard maps. Who owns this key range. The next committed config. A leader lease for a job scheduler. Cluster membership.

Walk a shard map. The cluster has ranges. Each range names a home. A split, a move, or a fail-over changes that map. If two API nodes see two maps, they send the same key to two homes, or to none. The map is the source of truth. It is small. It changes slowly. A wrong read is a wrong routing decision. That is a Raft group. The control plane writes the new map to the leader. A majority stores it. API nodes read from the leader, or they watch and apply in order.

The data plane is not in that group. The rows live on the shard you just named. Those shards may have their own replica groups. They may use a cheaper primary-replica pair if a stale read of user data is allowed. The map is not allowed to be stale in the same way.

A second example is a job scheduler's lock. Only one worker may run "build feed for user 9" at a time. A TTL in Redis is a common answer and a fine one when a double run is recoverable. When a double run is not recoverable, a lease stored in a Raft group is the stricter tool. The lease is metadata. The feed build is not.

Keep the order of the answer straight.

1. One leader, a log, a majority vote to commit.
2. An election after silence, with terms and a log-completeness check.
3. Paxos as the same majority idea, Raft as the story you can draw.
4. What it will not do: shard, join two groups, store blobs, serve the minority.
5. Put it under a metadata store, a shard map, or a lease, not under the user table.

You can name etcd. In the room you still say "asynchronous replica" when you meant majority. Speak the vote before the product.

Drill the consistency half of this on the [fundamentals study page](/study/fundamentals). Then keep going on the [study page](/study).
