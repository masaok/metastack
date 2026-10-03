---
id: pacelc
deck: fundamentals
type: concept
difficulty: 2
tags: [consistency, latency, availability]
prompt: >
  What does PACELC add to CAP, and how would you classify a few well-known
  systems with it?
keyPoints:
  - If Partitioned, trade Availability vs Consistency, Else trade Latency vs Consistency
  - Captures that even with a healthy network, synchronous coordination costs latency
  - PA/EL systems (Dynamo, Cassandra, DynamoDB default) favour availability and low latency with eventual consistency
  - PC/EC systems (Spanner, ZooKeeper, single-leader with sync replication) pay latency for strong consistency always
  - Mixed classes exist, e.g. PA/EC or PC/EL, and the class can vary per operation
eli5:
  - During a network split you choose between staying up and staying in agreement, and the rest of the time between speed and agreement
  - Even when nothing is broken, making copies agree before answering takes extra time
  - Some systems pick staying up and answering fast, and accept that copies agree a little later
  - Others always wait for agreement and accept slower answers
  - Mixtures exist too, and one system can choose differently for different requests
distractors:
  - PACELC replaces CAP and says nothing about behaviour during a partition
  - The E in PACELC stands for eventual consistency
  - Dynamo and Cassandra are PC/EC systems in their default configuration
followUps:
  - Why does Spanner accept higher write latency, and how does TrueTime help it?
  - Which PACELC class does a read replica with async replication put you in?
references:
  - title: Daniel Abadi, Consistency tradeoffs in modern distributed database system design (IEEE Computer 2012)
    url: https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf
  - title: Wikipedia, PACELC theorem
    url: https://en.wikipedia.org/wiki/PACELC_theorem
updated: 2026-10-02
reviewed: true
---

CAP only speaks about what happens during a partition, which is a small fraction of a system's life. PACELC (Abadi, 2012) fills in the rest:

> If there is a **P**artition, choose between **A**vailability and **C**onsistency; **E**lse, choose between **L**atency and **C**onsistency.

The second half is the everyday tradeoff. Strong consistency means a write must be coordinated across replicas (a quorum, a leader round trip, a consensus round) before it is acknowledged, and every one of those is a network hop. Giving that up buys latency.

**Classifying systems**

| System | Partition | Else | Why |
| --- | --- | --- | --- |
| Dynamo, Cassandra, Riak | PA | EL | Always writable, tunable but default to fast eventual reads |
| DynamoDB (default reads) | PA | EL | Eventually consistent reads are default and cheaper |
| Spanner, CockroachDB | PC | EC | Consensus on every write, external consistency |
| ZooKeeper, etcd | PC | EC | Linearizable writes, majority quorum |
| MongoDB (majority write concern) | PC | EC | Leader-based, refuses writes without majority |
| PNUTS (Yahoo) | PC | EL | Gives up consistency for latency normally, but not during partitions |

The classes are not fixed per product. Cassandra with `QUORUM` reads and writes leans toward EC; DynamoDB with strongly consistent reads is EC for those reads. Say "for this operation" when you classify.

**Using it in interviews.** When you propose cross-region replication, state the PACELC class you are choosing and what the user sees: "writes commit in the home region and replicate asynchronously, so we are PA/EL; a user who changes their profile in Tokyo and immediately reads it from Frankfurt may see the old value for a second. We will route a user's reads to their home region to hide that."
