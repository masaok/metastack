---
id: consistent-hashing
deck: fundamentals
type: concept
difficulty: 2
tags: [sharding, caching, data-structures]
prompt: >
  Explain consistent hashing. What problem does it solve compared with
  hash-mod-N, and what are virtual nodes for?
keyPoints:
  - With hash mod N, adding or removing a node remaps almost every key, which empties caches and moves most data
  - Consistent hashing places nodes and keys on a ring, each key goes to the next node clockwise, so only about 1/N of keys move on a change
  - Virtual nodes (many points per physical node) smooth out uneven gaps and let heterogeneous machines take proportional load
  - Replication is natural, store a key on the next R distinct nodes around the ring
  - Used in Dynamo, Cassandra, memcached clients, CDNs and load balancers
eli5:
  - If you place keys by dividing by the number of machines, changing that number reshuffles nearly everything
  - Put machines and keys around a circle and give each key to the next machine along, so a change only moves that machine's share
  - Give each machine many spots on the circle so the shares even out, and give bigger machines more spots
  - For spare copies, also store each key on the next few machines round the circle
  - Many well-known databases, caches, content networks and load balancers work this way
distractors:
  - text: Adding a node to the ring remaps almost every key, the same as hash mod N
    why: Only the keys between the new node and its predecessor move, about 1/N of them. Avoiding a full remap is the whole purpose
  - text: Virtual nodes are standby machines that take over when a physical node fails
    why: Virtual nodes are extra positions on the ring for the same physical machine, used to even out load
  - text: A key is stored on the node whose hash is closest in either direction, so the ring needs no clockwise rule
    why: The rule is the next node clockwise. One fixed direction is what keeps the set of moved keys small when nodes change
followUps:
  - What happens when one node fails and its neighbour inherits its whole range?
  - How does rendezvous (highest random weight) hashing compare?
references:
  - title: Karger et al., Consistent Hashing and Random Trees (STOC 1997)
    url: https://www.cs.princeton.edu/courses/archive/fall09/cos518/papers/chash.pdf
  - title: Amazon, Dynamo paper (SOSP 2007)
    url: https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf
updated: 2026-10-02
reviewed: true
---

**The problem.** The naive way to pick a server for a key is `hash(key) mod N`. Go from 4 servers to 5 and the modulus changes, so roughly 80% of keys now map somewhere else. In a cache that is a near-total miss storm; in a database it is a massive data migration.

**The ring.** Hash each server's identifier onto a circle of hash values (say 0 to 2^32). Hash each key onto the same circle and walk clockwise to the first server you meet; that server owns the key. Adding a server only claims the arc between it and its counter-clockwise neighbour, so about 1/N of keys move and every other key stays put. Removing a server hands its arc to the next server clockwise.

```mermaid
flowchart LR
  subgraph ring[Hash ring]
    direction LR
    A((A)) --> B((B)) --> C((C)) --> A
  end
  K[key k] -. clockwise .-> B
```

**Virtual nodes.** With one point per server the arcs are uneven and a failure dumps an entire arc on one neighbour. Instead give each physical server many points (e.g. 100–200 "vnodes"). Load evens out statistically, a failed node's keys scatter across many successors, and a bigger machine can simply get more vnodes.

**Replication.** Store each key on the first R distinct physical nodes clockwise from it; this is how Dynamo and Cassandra place replicas.

**Alternatives.** Rendezvous hashing scores every node per key and picks the top one; it has the same minimal-movement property without a ring structure. Jump consistent hash is compact and fast but only supports adding or removing the last bucket.

Say the problem (remapping), the mechanism (ring, clockwise), the refinement (vnodes), and where it is used.
