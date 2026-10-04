---
slug: quorum
title: Quorum reads and writes in system design
description: Quorum reads and writes in system design. The inequality that keeps a quorum safe, sloppy quorums, and what you give up for extra availability.
primaryKeyword: quorum
category: data-and-consistency
tags:
  - databases
  - consistency
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the quorum answer an interviewer wants. You pick how many copies must acknowledge a write, and how many copies a read must see, so that those two sets share a node. The inequality is W + R greater than N. Overlap is what makes the next read see a copy that took part in the last successful write. You can loosen that overlap for availability. Then you say what a reader can miss. The rest of this post is the inequality, the overlapping sets, sloppy quorums, the cost of the extra uptime, and a three-node store small enough to draw.

## The inequality that makes a quorum safe

N is the number of replicas that hold the key. W is the number that must acknowledge a write before the client hears success. R is the number that must reply to a read before you return a value. The safe rule is W + R > N. Strictly greater. Equal is not enough.

Why greater. Each successful write touches W replicas. Each successful read touches R replicas. If those two numbers add to more than N, the two sets cannot be disjoint. At least one replica sits in both. The reader can compare versions and take the newer one. That is the overlap. That is the whole trick.

W + R = N leaves a gap. N is 3, W is 1, R is 2. One plus two is three. A write can land on A. A read can ask B and C. Neither B nor C saw the write. The inequality failed even though R looks large. The same failure happens with W of 2 and R of 1. The write can sit on A and B. The read can sit on C.

W + R > N does not invent a total order by itself. Two writers can still finish two different values on two different overlapping sets. Overlap finds a replica that saw a write. A version, a clock, or a client merge decides which value wins when two writes were concurrent. Say that. Do not claim the inequality alone makes the store linearizable.

A common default is N of 3, W of 2, R of 2. Two plus two is four. Four is greater than three. One replica can be down and you can still write. One replica can be down and you can still read. You cannot lose two replicas and keep the same guarantee.

ALL is W = N or R = N. ONE is W = 1 or R = 1. ALL waits the most and stays up the least. ONE is fastest and most stale. QUORUM in many stores means majority, which for N of 3 is 2. Name the integers.

[CAP theorem explained for interviews](/blog/cap-theorem-explained) is the partition. A quorum is one way you take the consistent side or the available side. The inequality is how you show the choice.

## Read and write quorums that overlap

Draw N boxes. Circle W of them for the write. Circle R of them for the read. The circles must share a box.

N = 3. Replicas A, B, and C. W = 2, R = 2.

| Write set | Read set | Shared replica |
| --- | --- | --- |
| A, B | A, B | A and B |
| A, B | A, C | A |
| A, B | B, C | B |
| A, C | B, C | C |
| B, C | A, B | B |

Every pair overlaps every pair. That is why majority on both sides works for three copies.

Now drop R to 1. W stays 2. Two plus one is three, which is not greater than three. Write A and B. Read C. No shared replica. The read can return the previous value after the write already succeeded. That is the missed write. The table is no longer full of overlaps. One row is empty.

A read that received two versions returns the newer one. A counter per writer, or a version vector, is enough to see which value is newer or whether they forked. Last-writer-wins by wall clock is simpler and can drop a write if clocks lie. Mention the rule. Do not hide it behind the word quorum.

Writes still go to all N when they can. You wait for W. Reads still ask all N when they can. You wait for R. Extra replies can repair stale copies. They are not what makes the inequality true.

[Consistent hashing explained for the interview](/blog/consistent-hashing-explained) is how those N replicas are chosen. You walk the key clockwise to the first owner, then to the next distinct nodes. The quorum starts after that walk.

## Sloppy quorums and hinted handoff

A strict quorum waits for W of the preferred replicas. If two of three preferred nodes are down, a W of 2 cannot finish. The write fails. That is the availability you gave up.

A sloppy quorum takes acknowledgements from any reachable nodes, not only from the preferred ones. If B is down, the coordinator may write A and D, where D is a node that does not usually hold this key. The write returns success. Availability went up. The overlap with a later read of A and B can now fail, because B never saw the write and D is not in the read set.

Hinted handoff is how you try to repair that. D stores the write as a hint for B. When B returns, D forwards the hint. B applies it. The preferred set is whole again. Until that handoff finishes, a reader who only asks preferred nodes can miss the write. A sloppy read that also asks whoever accepted the sloppy write can still see it. The store has to remember where the hint went.

Say both sentences. Sloppy quorums keep the cluster accepting writes when a preferred replica is briefly gone. They weaken the inequality until the hint is delivered. Interviewers like the pair because one without the other is either an outage or a silent miss.

Do not treat a hint as a committed replica in the preferred set. It is a promise to deliver. The usual story is a short outage, a hint on a neighbour, and delivery on return. A long outage needs streaming from a replica that is still in the preferred set.

## What you give up for the extra availability

Shrinking W or R, or slopping the set, keeps more requests succeeding while nodes are unreachable. The bill is recency, conflict, and a harder failover story.

Recency. A read with R of 1 can miss a write that already returned success. The user saved. The next page load can show the old value. That is the same class of bug as a lagging replica, with a different cause. The cause here is that the read set did not have to intersect the write set.

Conflicts. Two coordinators can accept two writes to the same key on two different majorities, or on two sloppy sets, while a partition holds. Both writes succeeded. The values fork. You now need siblings, last-writer-wins, or a type that merges. A shopping cart can union the items. A register that stores a display name cannot. Pick the merge before you claim the store stays available.

Latency. A quorum that waits for a far replica waits for that hop. Place copies nearby so the R-th reply is local, or accept a stale local read. Someone still waits, or someone still sees old data.

Repair traffic. Read repair writes the newer version back to stale copies you asked. Anti-entropy compares replicas in the background. Without them, a missed replica can stay missed.

What you do not give up, if the inequality holds on the preferred set. A read after a successful write shares a replica with that write. W of 2 still cannot survive two dead replicas out of three.

## A store that uses quorums, drawn small

Three nodes. One key, `cart:19`. N is 3. W is 2. R is 2. Any node may coordinate. The coordinator hashes the key, finds the three owners, sends the put or get to all three, and returns when two have answered.

Put. The client sends `put(cart:19, { mug: 1 })` to node A. A is a coordinator, not necessarily a special leader. A writes its own copy if it is an owner, and forwards to B and C. B and C ack. A already has two acks, including itself, and returns success. C's ack can still be in flight. The write has met W.

Get. The next client, or the same one, sends `get(cart:19)` to node B. B reads itself and asks A and C. A and B reply first. Both hold `{ mug: 1 }`. B returns that object. If A had the new cart and C still had empty, B compares versions and returns the new one. It may write the new one back to C. That write-back is read repair.

Node B then dies. Puts still succeed on A and C. Gets still succeed on A and C. The inequality still holds. Node B and node C then die. Puts fail. Gets fail. The remaining copy is one node. W of 2 cannot be met. If you drop to W of 1 to keep selling, you have changed the guarantee. Say so.

A sloppy variant while B is down. A write that would have gone to A, B, and C instead lands on A, C, and a hint on D. A later get that only asks A, B, and C can miss D's hint if C also missed the write. The safe sloppy story includes a sloppy read or a delivered hint.

Keep the drawing small. Do not add virtual nodes, Merkle trees, and an LSM engine until the interviewer asks. Those belong to a full key-value design. The quorum part is the counts, the overlap, and the one node you may lose.

What you say in the room.

1. N copies. W acks to write. R replies to read.
2. W + R > N so the sets share a replica.
3. Majority of three is two and two. One down is fine. Two down is not.
4. Sloppy quorums plus hinted handoff trade overlap for a short outage.
5. Extra availability costs stale reads, conflicts, and repair.
6. Draw three nodes and one key. Walk one put and one get.

The fundamentals deck has the CAP card and the hashing card that this answer sits on. Start on the [fundamentals study page](/study/fundamentals).
