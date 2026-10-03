---
id: cap-theorem
deck: fundamentals
type: concept
difficulty: 2
tags: [consistency, availability]
prompt: >
  State the CAP theorem precisely and explain what it does and does not tell
  you about real systems.
keyPoints:
  - During a network partition a system must choose between linearizable consistency and availability (every request gets a non-error response)
  - Partition tolerance is not optional in a distributed system, so the real choice is C or A only while partitioned
  - CAP says nothing about behaviour when there is no partition, that is where latency tradeoffs live (see PACELC)
  - Labels like "CP database" are oversimplifications, consistency is a spectrum and configurable per operation
  - Gives examples, a CP system refuses writes on the minority side, an AP system accepts them and reconciles later
eli5:
  - When the network splits a system in two, each side must either refuse some requests or risk giving answers that disagree
  - Networks will split whether you like it or not, so the only real choice is what to do while it is split
  - The rule is silent about normal times, when the tradeoff is speed against agreement
  - Calling a whole database one type is too crude, since agreement comes in degrees and can be set per request
  - For example one kind stops taking writes on the smaller side of a split, and another keeps taking them and sorts it out afterwards
distractors:
  - text: A well-designed system can provide consistency, availability and partition tolerance all at once
    why: During a partition a node must either refuse requests or answer with possibly stale data. It cannot do neither
  - text: CAP forces a choice between consistency and availability at all times, even when the network is healthy
    why: CAP only speaks about behaviour during a partition. With a healthy network a system can be both consistent and available
  - text: A CA system gives up partition tolerance, which is a practical choice for a database spread over several datacenters
    why: Partitions happen whether or not you plan for them, most of all between datacenters, so giving up partition tolerance is not a real option
followUps:
  - What does "available" mean in CAP and why is it stricter than "high availability"?
  - Why is a single-node database not a counterexample?
references:
  - title: Martin Kleppmann, Please stop calling databases CP or AP
    url: https://martin.kleppmann.com/2015/05/11/please-stop-calling-databases-cp-or-ap.html
  - title: Gilbert and Lynch, Brewer's conjecture and the feasibility of consistent, available, partition-tolerant web services
    url: https://users.ece.cmu.edu/~adrian/731-sp04/readings/GL-cap.pdf
updated: 2026-10-02
reviewed: true
---

**The statement.** In a distributed system experiencing a network partition, you cannot guarantee both:

- **Consistency** in the linearizable sense: every read sees the most recent completed write, as if there were one copy of the data.
- **Availability**: every request to a non-failed node eventually returns a non-error response.

If the two sides of a partition cannot talk, a node either answers (possibly with stale data, giving up C) or refuses (giving up A).

**What people get wrong**

1. *"Pick two of three."* Partitions happen whether you like it or not, so partition tolerance is a fact, not a choice. The theorem is about what you sacrifice *during* a partition.
2. *It says nothing about normal operation.* When the network is healthy you can have both, and the interesting tradeoff is between consistency and latency. That is what PACELC adds.
3. *"CP database" or "AP database" labels.* Real systems are tunable: Cassandra with `QUORUM` reads and writes behaves differently from `ONE`. Many systems are neither CAP-consistent nor CAP-available in the formal sense.
4. *CAP availability is strict.* It demands that every non-failed node respond. A system that fails over to a healthy majority in seconds has excellent uptime but is technically not CAP-available.

**Concrete behaviour**

- **Choosing C:** the minority side of a partition stops serving writes (and possibly reads). ZooKeeper, etcd, and a single-leader database with synchronous replication behave this way.
- **Choosing A:** both sides keep accepting writes and merge later via last-writer-wins, vector clocks or CRDTs. Dynamo-style stores and DNS behave this way.

A strong answer states the theorem precisely, points out that P is given, and then pivots to the practical question: for this feature, what happens to users on each side of a partition?
