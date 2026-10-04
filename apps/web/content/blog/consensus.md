---
slug: consensus
title: Consensus in system design interviews
description: Consensus in system design interviews. Agreement, validity, and termination in plain words, why a majority works, and where it sits in a drawing.
primaryKeyword: consensus
secondaryKeywords:
  - raft
  - majority
  - agreement
category: consensus-and-coordination
tags:
  - consistency
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the consensus answer an interviewer wants. Several nodes must pick one value and then keep that value. Agreement means they do not pick two. Validity means they pick a value someone actually proposed. Termination means they do not wait forever once enough nodes are healthy. A majority is the usual trick because two majorities of the same group have to share a node. Gossip is not that. A quorum read is not that either. Consensus belongs in a small box on the drawing, around a log or a lock, not around every replica. When they want the algorithm, you walk Raft at the level of terms, votes, and a committed prefix. The rest of this post is those five claims.

## Agreement, validity, and termination, in plain words

Agreement is the sentence people mean when they say the nodes decided. No two correct nodes decide different values. If A decides `blue` and B decides `green`, you did not have consensus. You had a split. The rest of the system will fork on that split. Leader election, a configuration change, and a commit in a replicated log all need this sentence.

Validity is the sentence that stops a made-up value. The value that wins was proposed by some node. The cluster does not invent `blue` because a timeout fired. It chooses among `blue` and `green` and whatever else was proposed. In a log, validity is that an entry came from a client or from a previous term, not from thin air.

Termination is the sentence that makes the protocol useful. Eventually every correct node decides, if the network and the nodes are healthy enough for long enough. A protocol that never decides is safe and idle. Interviewers care because a leader election that never ends is an outage. A commit that never becomes committed is a write that never returns.

These three are properties, not products. You can satisfy them with Raft, with Paxos, with a replicated etcd cluster you did not write. You cannot satisfy them with "the nodes talk until they feel good." Feelings are not agreement. A majority is not a feeling. It is a count.

Say what is being decided. A single value, such as who is leader. A next entry in a log. A configuration, such as which nodes may vote. Consensus on "the whole database" is not a thing you run on every query. You run it on the small record that the rest of the system takes orders from.

Safety versus liveness is the short form. Agreement and validity are safety. You must not break them when the network is ugly. Termination is liveness. You may pause it during a partition. [CAP theorem explained for interviews](/blog/cap-theorem-explained) is that pause. A majority that cannot be reached cannot decide. Nodes that refuse to guess have given up availability for the decision. That is the correct refusal.

## Why a majority is the usual trick

Take a voting group of 2f + 1 nodes. A majority is f + 1. You can lose f nodes and still collect a majority. Two majorities must overlap. They share at least one node. That shared node saw the previous decision. It will not vote for a conflicting one if the protocol is honest about what it already promised.

Three nodes. Majority is two. You can lose one. You cannot lose two and still decide. Five nodes. Majority is three. You can lose two. The overlap rule is the same. Two groups of three in a group of five share at least one node.

That overlap is why a majority is the usual trick. It is not magic. It is set arithmetic. If you accept a decision from one node, two different nodes can decide two different values. If you wait for everyone, one dead node stops the cluster forever. Majority is the middle that still overlaps.

Even groups are awkward. Four nodes. A majority is three. You can lose only one, same as three nodes, and you have more machines to run. This is why people pick three or five for a voting group. Say the count. Do not say "we quorum" without the integers.

A majority of the voting group is not a majority of the machines that store data. You can have many replicas that apply a log and three nodes that vote on the log. The voters are the consensus group. The appliers are the data plane. [Consistent hashing explained for the interview](/blog/consistent-hashing-explained) places data. Consensus places a decision. Do not elect a majority of hash-ring owners and call it Raft. The ring can move. The voting group is a list you change on purpose.

Clocks are not a majority. A wait of a few seconds does not prove the other side is gone. A lease can use time to end a term. The next term still needs votes. Do not replace the overlap with a timeout and claim you have consensus. You have a guess plus a race.

## Consensus versus gossip and versus a quorum read

Gossip spreads what a node knows. A node tells a few peers. They tell a few more. Membership, a digest of data, a suspicion that someone is late, these flood the cluster. Gossip is useful. It is not agreement. Two gossiping nodes can hold two different views for a long time. There is no commit point. There is no promise that a third node will not see the older view after you thought the cluster had moved on.

A quorum read is a different overlap. You write to W replicas. You read from R replicas. If W + R is greater than N, the read set shares a replica with the last successful write. You can then take the newer version. That is recency for a key. It is not a cluster-wide decision. Two writers can still complete two writes on two different overlapping sets. You then need versions or a merge. The quorum post is that inequality. Consensus is a later decision that those writes will not remain equals.

| Mechanism | What overlaps | What you get | What you do not get |
| --- | --- | --- | --- |
| Consensus | Two majorities of a voting group | One decided value, or one committed log prefix | A decision while a majority is unreachable |
| Gossip | Nothing required | A view that usually converges | A moment when everyone has the same view |
| Quorum read | Write set and read set for one key | A good chance of seeing the latest write | A total order of all writes |

Use the table. If the interviewer asks how nodes learn that a peer is gone, gossip and heartbeats are the answer. If they ask how a reader sees the last write, a quorum is the answer. If they ask how the cluster picks one primary, or when a log entry will never be undone, consensus is the answer. Mixing the words is the usual fail.

You can have all three in one design. Members gossip. A key is read with a quorum. A small etcd cluster decides the shard map. That map is the consensus object. The data plane does not run Raft on every put. Say the object. Point at the small box.

## Where it belongs in a drawing (small)

Draw the request path first. Client, API, service, store. Then draw one small box off to the side. Label it `consensus: shard map` or `consensus: primary for shard 7` or `consensus: lock for job 44`. Arrows from the service to that box are rare. They happen on failover, on a config change, on acquire. Arrows for ordinary reads do not go through that box.

That is the point of the small drawing. Consensus is expensive in latency and in what it refuses during a partition. You use it to decide the thing everything else treats as true. You do not use it to decide every counter.

A three-node voting group is enough for the board. Boxes A, B, and C. A is leader. A client write hits A. A appends to its log and sends the entry to B and C. When A knows a majority has the entry, the entry is committed. A tells the client success. B and C apply. If A then dies, B and C elect. The winner already has the committed entry, or it will not win if the protocol checks the log. The new leader continues the same log. That is the drawing. Stop there.

Do not fill the board with every follower's disk format. Do not add a second consensus group until they ask who names the first group. A meta-cluster that stores membership is allowed. It is a second small box, not a reason to run an election on the read path.

If the store is already a database with its own failover, the consensus box may be inside that database. You still draw it. You still say that ordinary queries are not consensus rounds. They are reads and writes against a primary the consensus box has already chosen.

## Linking to Raft when they want the algorithm

Raft is the algorithm most interviewers will let you walk. A term is a counter that goes up. A candidate in a new term asks for votes. A node votes for at most one candidate per term, and only if the candidate's log is at least as complete as its own. A candidate that collects a majority becomes leader for that term. The leader appends entries. An entry is committed when a majority stores it in that term. A new leader must hold every committed entry because any majority it won overlaps a majority that stored that entry.

That is enough. You do not need to recite every retry. You do need the overlap sentence. You do need the log check. Without the log check, a candidate with an empty disk can win and then overwrite committed work. Without the term, a stale leader can keep appending. The token in leader election is the same kind of number as the term. The majority is the same kind of overlap as the voting rule.

When they do not want the algorithm, do not give it. Say "a replicated coordination service decides the primary" and spend the time on fencing and on what the primary owns. When they do want it, walk one failed leader and one new election on three nodes. Show that the committed entry survives. Show that a node with a shorter log does not win.

This post is the vocabulary. Raft is the walk. If a dedicated Raft write exists later, that is where the step-by-step belongs. Here you only need to know when to start that walk and when to stay on the properties.

What you say in the room.

1. Consensus is agreement, validity, and termination on one value or one log prefix.
2. A majority overlaps any previous majority, so two decisions cannot ignore each other.
3. Gossip spreads views. A quorum read finds a recent value. Neither is a commit.
4. Draw consensus as a small box around a map, a primary, or a lock.
5. Ordinary reads do not take a vote.
6. When they ask how, walk Raft as terms, votes, and a committed prefix.

The properties are the part that transfers to every prompt. Start on the [fundamentals study page](/study/fundamentals).
