---
slug: pacelc-explained
title: PACELC explained for system design
description: PACELC explained for system design. What the extra letter adds when the network is healthy, and how to choose latency or consistency on a whiteboard.
primaryKeyword: pacelc
secondaryKeywords:
  - latency
  - consistency
category: data-and-consistency
tags:
  - fundamentals
  - distributed-systems
author: Masao Kitamura
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

Here is PACELC the way an interviewer wants to hear it. If there is a partition, choose availability or consistency. Else, even when the network is healthy, choose latency or consistency. The first sentence covers the split. The second sentence covers every other hour the system runs. A quorum read waits until enough copies overlap the latest write. That read is slower and fresher. A replica read answers from one copy. That read is faster and possibly stale. That is the whole idea. The rest of this post stays on the else branch. It prices that branch in milliseconds. It ends on the sentence you should say first.

## Why PACELC follows CAP

CAP speaks about a network partition. The sides cannot exchange a new write. A node that answers can hand back a stale value. That choice gives up consistency. A node that refuses the request gives up availability. During the split the real choice is consistency or availability.

CAP stops at the split. A split is a small fraction of a system's life. While every node can reach the others, the copies can still agree. The open question is how long that agreement takes. PACELC is the follow-up that names the wait. Daniel Abadi published the formulation in 2012. The [PACELC card](/cards/pacelc) puts the rule in one line. If there is a partition, choose between availability and consistency. Else, choose between latency and consistency.

The letter the else branch adds is L. L stands for latency. You can spend it and return a consistent answer. You can skip the wait and return a stale answer. The rest of this post is that pair.

## The else branch on a healthy network

Take three replicas of one key. Each one accepts connections. No link is cut. A coordinator can reach all three. PACELC still asks for a choice.

A strongly consistent write waits for other replicas before the client hears success. The wait can be a quorum of acknowledgements. The wait can be a round trip to a leader. The wait can be a consensus round. Each option is a network hop. The hop costs time on a healthy network. That time is the latency in the else branch.

Skip the wait. The coordinator answers sooner. A later read can miss the write. You chose latency. Keep the wait. A later read can see the write. You chose consistency. A replica read and a quorum read can both succeed while every node is reachable.

## A quorum read versus a replica read

I chose these figures so the arithmetic fits on a whiteboard. They are an example. They are not a measurement of any product. Swap in the interviewer's numbers and repeat the same steps.

The read budget is 20 ms. That is the time this handler may spend inside the datastore call. A call inside 20 ms holds the target. A longer call misses it.

N is 3. W is 2. A quorum read uses R of 2. A replica read uses R of 1. The coordinator sends the reads in parallel. The time you record is the R-th arrival.

First placement. A sits in the coordinator's zone at a round trip of 1 ms. B sits in another zone in the same region at 3 ms. C sits in another region at 100 ms. All three are reachable.

**Replica read.** You read A alone. The latency is 1 ms. Spare time is 20 - 1 = 19 ms. The call fits the budget.

The value can still be old. Set an example lag of 40 ms on A. The write is already acknowledged. A applies it 40 ms later. A read in that window returns the previous value. The call took 1 ms. The copy was 40 ms behind. Every node was reachable for that whole window.

**Quorum read with B nearby.** You need two replies. A answers at 1 ms. B answers at 3 ms. C would answer at 100 ms. You return on the second arrival. That arrival is B at 3 ms. C can still be in flight.

The latency is max(1, 3) = 3 ms. Spare time is 20 - 3 = 17 ms. The extra wait versus the replica read is 3 - 1 = 2 ms.

W + R = 2 + 2 = 4. Four is greater than N of 3. Any write quorum of two shares a replica with a read of A and B. A write on A and B shares both. A write on A and C shares A. A write on B and C shares B. You compare the versions in the two replies. You return the newer one. The 3 ms read is fresher than the 1 ms read.

A counter from a single writer is enough to order those versions. Two concurrent writers still need a conflict rule. Overlap finds a shared copy. The conflict rule picks the winner.

**Quorum read with B far away.** Move B to another region. The round trip to B is now 100 ms. Put C at 120 ms so the remote hops stay distinct. Leave A at 1 ms. Every node is still reachable.

The quorum now waits for a remote second reply. A answers at 1 ms. B answers at 100 ms. C would answer at 120 ms. The second arrival is B. The latency is 100 ms. The overage is 100 - 20 = 80 ms. The ratio is 100 / 20 = 5. The fresh call takes five times the budget. R is 2. You stop when B arrives.

A writer near B commits on B and C. A still stores the previous value. A replica read of A returns that old value at 1 ms. A quorum read receives A's old value at 1 ms. It receives B's new value at 100 ms. You return the new value at 100 ms. The links were up the whole time.

| Path | Reply you wait for | Time | Against the 20 ms budget |
| --- | --- | --- | --- |
| Replica read of A | The nearest reply | 1 ms | 19 ms spare |
| Quorum, B in the next zone | The second reply | 3 ms | 17 ms spare |
| Quorum, B in another region | The second reply | 100 ms | 80 ms over |

[Back-of-the-envelope estimation for system design](/blog/back-of-the-envelope-estimation) is the same habit. State the inputs. Take the max. Say what the number forces. Two replicas in the region hold this quorum at 3 ms. One replica per region pushes it to 100 ms.

[Consistent hashing explained for the interview](/blog/consistent-hashing-explained) places those copies. You walk a key clockwise to an owner, then to the next distinct replicas. PACELC starts after that walk. You still choose whether the read waits for the second copy.

A sloppy quorum writes a fallback when a preferred replica is down. That fallback can miss the read set. The overlap then fails. This example uses A, B, and C only. All three answer. The overlap holds.

## How the classes fall out

Name the class for one operation. The next call on the same store can wear a different class.

**PA/EL.** During a partition this operation stays available. In the else branch it picks latency. A Dynamo-style store does this in its usual setup. Any replica can accept a write. The default read hits one replica. That is the 1 ms path. Copies agree afterwards. A client can read a stale value after a write that already succeeded.

**PC/EC.** During a partition this operation picks consistency. In the else branch it picks consistency again. A leader-based store with synchronous replication does this. A store that runs a consensus round on each write does this too. The minority side of a split refuses writes. On a healthy network the writer still waits before the acknowledgement.

A follower in the next zone adds 3 ms to the write. A follower in another region adds 100 ms. 100 - 20 = 80. The far write is 80 ms over the budget. A later read of a local leader is still 1 ms. The write already paid. A remote leader puts that 100 ms on the fresh read.

**PC/EL.** During a partition the leader refuses writes it cannot confirm with its peers. That refusal is the consistency choice. In the else branch a read of an async replica picks latency. A leader-based store with async read replicas lands here on those reads. The replica answers in 1 ms. It can trail by the 40 ms example lag. The [PACELC card](/cards/pacelc) asks which class that read replica occupies. The read sits on the EL side. A leader that stops the minority makes the pair PC/EL.

**PA/EC.** During a partition the operation stays available. On a healthy network it waits for a quorum. A Dynamo-style store moves this way when one call raises R and W. The next call can use a single replica and return to EL. Say the operation with the class.

## What the user sees

Put the choice on a profile edit. The write commits in the home region. Other regions apply it asynchronously. That operation is PA/EL. The user changes a display name in Tokyo. The same user then reads the profile from Frankfurt. The Frankfurt copy can still hold the old name. Say the window the way the card does. The user may see the old value for a second.

Hide the window by routing this user's reads to the home region. The home-region read can hit the leader. It can hit a replica that has already applied the write. Other people can still read Frankfurt. This user reads in Tokyo and sees the new name.

PC/EC waits until another region holds the new name. On the far placement that wait is 100 ms. A Frankfurt read after the acknowledgement returns the new name. The user felt the wait on save.

A display name can stand a second of staleness when the owner reads at home. A balance wants the synchronous leader-based path. That path is PC/EC while the network is healthy. Say what the user sees. Name the class after that.

## What to say on the whiteboard

Open with the else branch.

If there is a partition, choose availability or consistency. Else, even when the network is healthy, choose latency or consistency. Price the second choice before you name a store.

The budget is 20 ms. The replica read is 1 ms and can lag 40 ms. The nearby quorum is max(1, 3) = 3 ms. Spare time is 20 - 3 = 17 ms. The far second arrival is 100 ms. The overage is 100 - 20 = 80 ms. Keep the profile read local. Pay 100 ms on a synchronous leader-based write for a balance. That write is PC/EC.

Then the user. Profile writes commit in the home region and replicate asynchronously. That edit is PA/EL. A user who writes in Tokyo and reads in Frankfurt may see the old value for a second. Route that user's reads to the home region.

1. Say the partition choice in one sentence.
2. Say the else choice in the next sentence.
3. Name the operation. The next call can change class.
4. Take the R-th arrival against a millisecond budget.
5. Pick PA/EL, PC/EC, PC/EL, or PA/EC for that operation.
6. Say what the user sees. A stale read and a slower acknowledgement are both answers.

Follow-ups you should expect.

- **Why the PC/EC write is slower.** The write waits for followers before the acknowledgement. A consensus round is the same kind of wait. The hop remains while the network is healthy.
- **Where an async read replica lands.** The read is EL. A leader that refuses minority writes makes the pair PC/EL.
- **Raising R and W.** A Dynamo-style quorum on one call leans EC. A one-replica read on the same keys stays EL.
- **A quorum over budget.** Serve the local replica and name the staleness. A second local replica brings that quorum back to 3 ms.

## Drill until the else branch comes first

A partition recital leaves the ordinary day unpriced. The healthy read still needs a number. That number is the else branch.

The MetaStack card asks what PACELC adds to CAP. It also asks you to classify a few well-known systems. Classify by class and by operation. A Dynamo-style store and a leader-based store are enough names.

Hit the card's points. Partition trades availability against consistency. Else trades latency against consistency. Synchronous coordination still costs a hop while every node is reachable. PA/EL stays available in a split. It answers fast the rest of the time. PC/EC pays latency for strong consistency on both paths. Mixed classes exist. The class can change per operation.

Say the else branch before you name a system. If there is a partition, choose availability or consistency. Else, even when the network is healthy, choose latency or consistency. Then give the 20 ms budget, the 1 ms replica read, and the 3 ms quorum.

Drill the card on the [fundamentals study page](/study/fundamentals) until the else branch is the sentence you say first.

[Start drilling](/study/fundamentals)
