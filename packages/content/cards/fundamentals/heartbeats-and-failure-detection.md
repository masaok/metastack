---
id: heartbeats-and-failure-detection
deck: fundamentals
type: concept
difficulty: 2
tags: [availability, observability, consistency]
prompt: >
  How does a distributed system decide that a node is dead? Explain heartbeats,
  timeouts and why failure detection is fundamentally uncertain.
keyPoints:
  - Nodes send periodic heartbeats, a node is suspected after missing several in a row
  - A slow network and a dead node look identical, so any timeout risks false positives or slow detection
  - Short timeouts detect quickly but trigger false failovers under load, long ones hurt availability
  - Phi accrual detectors adapt the threshold to observed heartbeat latency distribution
  - Fencing tokens or leases are needed so a wrongly declared dead node cannot keep acting as leader
eli5:
  - Each machine keeps saying it is still here, and after several missed turns the others grow suspicious
  - A machine that is slow to answer looks exactly like one that died, so any waiting time can be wrong
  - Wait only briefly and you raise false alarms when things are busy, wait long and real failures go unnoticed
  - Smarter detectors learn how late heartbeats usually run and set the suspicion level to match
  - A machine wrongly declared dead may still think it is in charge, so give each leader a numbered pass that goes out of date
followUps:
  - What is split brain and how do leases prevent it?
  - How do gossip protocols spread membership information without a central monitor?
references:
  - title: Hayashibara et al., The phi accrual failure detector
    url: https://ieeexplore.ieee.org/document/1353004
  - title: Martin Kleppmann, How to do distributed locking
    url: https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
updated: 2026-10-02
reviewed: true
---

In a single process a crashed thread is obvious. Across a network you only ever see *silence*, and silence has many causes: the node died, the node is paused for garbage collection, the link is congested, or the node is fine and your own network card is failing.

**Heartbeats.** Each node sends an "I am alive" message to its peers or a coordinator every *T* milliseconds. If a node misses *N* consecutive heartbeats it is marked *suspected*, and after further confirmation (or immediately, in simpler systems) *dead*. Its work is reassigned.

**The timeout dilemma.** Choose *T × N* too small and a 500 ms GC pause or a brief network hiccup triggers a failover, which is itself disruptive and may cascade under load. Choose it too large and clients wait tens of seconds for a dead leader before anything happens. There is no correct value; there is only a tradeoff you must state.

**Adaptive detection.** The phi accrual detector (used in Cassandra and Akka) keeps a sliding window of heartbeat arrival intervals and outputs a *suspicion level* based on how improbable the current silence is given that history. On a noisy network the threshold stretches automatically; on a quiet one it tightens.

**Gossip.** Rather than one monitor, every node periodically exchanges its view of the cluster with a few random peers. Membership and suspicion spread epidemically in O(log n) rounds with no single point of failure. Consul, Cassandra and Dynamo use variants of this (SWIM).

**The real danger: being wrong.** If you declare a leader dead and promote another, but the old one is merely paused, you now have two leaders writing. Protect against this with **leases** (leadership expires unless renewed, and the old leader stops acting when its lease lapses) and **fencing tokens** (every lease carries an increasing number that storage checks, rejecting writes from a stale token).

Say "I cannot distinguish slow from dead, so I pick a timeout, adapt it, and make the system safe even when the detector is wrong."
