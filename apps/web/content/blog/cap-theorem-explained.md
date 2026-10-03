---
slug: cap-theorem-explained
title: CAP theorem explained for interviews
description: CAP theorem explained for interviews. What the theorem actually says, why a partition forces a choice, and how to state it without the usual mistakes.
primaryKeyword: cap theorem
secondaryKeywords:
  - consistency
  - eventual consistency
  - strong consistency
category: data-and-consistency
tags:
  - fundamentals
  - distributed-systems
author: Masao Kitamura
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

Here is the CAP theorem the way an interviewer wants to hear it. A network partition forces a choice between consistency and availability. You do not get to drop partition tolerance in a real network. While the split lasts, a non-failed replica either answers with a value that may be stale, or it refuses. When the network is healthy, that forced choice is gone. The rest of this post is the precise statement, one write on three replicas, the mistakes that fail the interview, and the line to say out loud.

## What the theorem actually says

The theorem talks about a distributed system that is already partitioned. Consistency here means linearizability. A read sees the most recent completed write. The data behaves as one copy. Each operation takes effect at a single instant between its start and its finish. Any read that starts after a completed write sees that write.

Availability means every request to a non-failed node eventually returns a non-error response. The node may take a long time. An error does not qualify. A refusal does not qualify. A crashed process is a failed node. The rule says nothing about failed nodes.

A partition means live nodes cannot exchange messages. One side can accept a write the other side cannot see. The other side learns it only when messages flow again. A node that answers without the missing side may return a stale value. That answer gives up consistency. A node that waits, or that returns an error, protects consistency. That response gives up availability.

Partition tolerance is the setting of the theorem. It is not a feature you turn off. Packets drop. Switches fail. A long pause makes healthy peers treat a node as unreachable. [The MetaStack card on the CAP theorem](/cards/cap-theorem) states the practical result. During a partition the system chooses linearizable consistency or availability. The choice lasts only as long as the partition.

A single-node database does not refute this. It has no internal network between replicas. While the node is up, it can answer every request and stay linearizable. While it is down, it has failed. The availability rule does not cover a failed node. The theorem starts when two or more nodes must agree across a network that can lose messages.

The availability word is also stricter than uptime. A system that fails over to a healthy majority in seconds has excellent uptime. During those seconds the cut-off side returned errors or stayed silent. Interviewers call the uptime figure high availability. They do not call it availability in the theorem. Say which meaning you are using.

## A write during a split

Put three replicas on the board. Name them A, B, and C. They store the key `balance-17`. The value is 100 on every replica. A read on any of them returns that current 100.

The network then splits. A and B still reach each other. C reaches only the clients on its own side. C has not crashed. It is a non-failed node that cannot hear the other two.

Two clients write the key while the split holds. The client who can reach A withdraws 30 and writes 70. The client who can reach only C withdraws 10 and writes 90. Same key. Same replicas. Those replies are the choice.

**Choosing consistency.** A and B are a majority of the three. A applies 70. B acknowledges that write. A then returns success to its client. That write has completed. C never hears it. C has no second vote. C returns an error for the write of 90. C returns an error for a read as well. A read of 100 from C would hide the completed write of 70. That read would break linearizability. A read sent to A or to B returns 70. People on the majority see one current value. Clients who reach C get a failure and must retry. When the partition heals, C copies 70 from the majority. The write of 90 never committed.

ZooKeeper, etcd, and a single-leader database with synchronous replication behave this way. The majority commits. The minority stops serving writes. It also stops serving reads when a stale read would deny a write that already completed.

**Choosing availability.** A returns success for 70 even though C is silent. B is still reachable, so B stores 70 too. C returns success for 90 even though A and B are silent. C stores 90. Every request that hit a non-failed node received a non-error response. A read on A returns 70. A read on C returns 90. Both writes completed. A reader on the far side can miss the latest one.

After the partition heals, the replicas have to merge. A plain register often uses last-writer-wins. One of 70 or 90 survives. The merge drops the other withdrawal. Vector clocks can record that both writes happened. The application then resolves the conflict. If the value is a counter CRDT and both debits merge, the balance becomes 60. Dynamo-style stores and DNS take this side. They accept writes during the split and reconcile afterward.

Both stories use the same replicas, the same key, and the same writes. One design lets C return success. The other design returns an error from C.

Where A, B, and C live is a different decision. [Consistent hashing explained for the interview](/blog/consistent-hashing-explained) places keys so that adding a node moves about 1/N of them. You still have to choose what C returns during the split.

## What you choose between

The consistency the theorem uses is the strict end of a spectrum. Interviewers often call that end strong consistency. Define it as linearizability. Then give a user-visible test. A password change has returned its confirmation, so the write completed. The next login must reject the old password. On the consistency side of `balance-17`, a reader who receives an answer sees 70.

Eventual consistency is the promise the availability side can keep. After writes stop, every replica converges. The model promises no order before that. The matching test is a photo. You post it. A refresh misses it. The next refresh shows it. The gap between 70 on A and 90 on C is that same gap. Agreement arrives with the merge.

You still pick a model in the middle. The theorem does not choose it. Causal consistency shows every cause before its effect. It is the strongest model that can stay available during a partition. A reply stays behind the comment it answers. Both sides of a split can still accept writes that never saw each other.

Session guarantees are what most products need in practice. Read-your-writes means the client sees its own update. Route that client's next reads to the replica that took the write, or compare a version token. Monotonic reads means the client never sees time run backwards. Pin the session to one replica.

Name the model when you name the side. On the availability side, say that both sides answer, that the store offers eventual consistency, and that the writer gets read-your-writes. On the consistency side, say that the minority refuses and that the balance keeps strong consistency.

## Three mistakes that fail the answer

**A permanent label.** People stamp a whole product as a CP database or an AP database. The label is too crude. Consistency is a spectrum. A real system can set it per operation. Cassandra with quorum reads and writes does not behave like Cassandra at consistency level one. Many systems are neither consistent nor available in the formal sense of the theorem. In the room, describe the operation and the partition. Leave the two-letter stamp off the product.

**A choice treated as always on.** "Pick two of three" makes partition tolerance sound like a dial. On a real network it is a fact. The sacrifice is what you give up during the partition. When the replicas can all talk, a system can complete a linearizable write and still return a non-error response. The theorem is silent about that healthy stretch. If your answer never includes the words "during a partition", you have not stated it.

**ACID consistency in place of this one.** The shared English word hides two contracts. ACID consistency means a transaction takes the database from one valid state to another. Invariants hold for the duration of that transaction. A transfer does not create money inside the transaction itself. CAP consistency means linearizability across replicas. A read sees the latest completed write. A fully ACID engine on one node never meets this theorem. A linearizable replicated log can still let an application break its own business rules. When someone says consistency, name the contract. Then keep that meaning for the rest of the answer.

## What you still trade without a partition

A healthy network removes the forced choice. The replicas can apply a write on a majority and serve a read from a majority. Callers get linearizable answers from non-failed nodes. No cut is hiding a newer write.

Latency is the tradeoff that remains. PACELC is the name for the pair. If there is a partition, choose between availability and consistency. Otherwise choose between latency and consistency. A read that waits for a majority is slower than a read of the local copy. The local copy may be behind. You spend the delay to buy the stronger answer. The theorem does not force that spend. The product requirement does.

After the split heals, a write of 70 can wait for a majority or return from A alone. The fast path loses 70 if A crashes before it replicates. Call that loss a crash when you explain it.

The same cluster can make both latency choices. A payment can demand a majority. A view counter can accept one replica. A permanent label erases the difference between those two operations.

## What to say in the interview

Open on the partition, before you expand the letters.

"If a partition cuts the replicas apart, I give up linearizable reads or I stop answering on every non-failed node. Partition tolerance is already required. I will name the guarantee I drop, and I drop it only while the split lasts."

Then walk the three replicas. The majority commits 70. C either returns an error or accepts 90. If both writes succeed, name the merge. Close on the users. A balance wants the retry on the minority, because a forked value is worse than a refusal. A cart wants both writes kept, because a refusal is worse than a merge. The feature picks the side.

These follow-ups show up next.

- **What available means.** Every non-failed node returns a non-error response. Failover in seconds is good uptime. The cut-off nodes still violated the theorem's rule.
- **Why one node changes nothing.** There is no internal partition. A dead node is a failure. The rule ignores failed nodes.
- **A healthy network.** Both guarantees can hold together. You still choose how much latency to pay.
- **Tunable operations.** Quorum and one are different promises, even inside one running system.
- **ACID.** Keep invariants in one sentence and replica order in another.
- **Placement.** Racks, the ring, and membership still need a design. They do not decide C's reply.

Keep the spoken order short. Forced choice, the two definitions, the three replicas, the limit to the life of the partition, then the user on each side.

## How to make the answer stick

This card fails in prep when you remember a slogan. The three letters come back. The reply from replica C does not. Say the partition case out loud, with the key and both writes, before you reveal the back.

The fundamentals prompt asks you to state the CAP theorem precisely and to explain what it does and does not tell you about real systems. You know it when you can give the forced choice, partition tolerance as a given, the silence about a healthy network, and both behaviours. The minority refuses writes. Both sides accept writes and reconcile later.

[Spaced repetition for system design](/blog/spaced-repetition-for-system-design) is why a miss on the minority side should schedule the card again tomorrow. Start drilling on the [fundamentals study page](/study/fundamentals) until you can state the partition case out loud.
