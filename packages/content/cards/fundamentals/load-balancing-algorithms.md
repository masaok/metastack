---
id: load-balancing-algorithms
deck: fundamentals
type: concept
difficulty: 1
tags: [load-balancing, availability, scalability]
prompt: >
  Name the common load-balancing algorithms and explain when you would pick
  each one.
keyPoints:
  - Round robin and weighted round robin for homogeneous, stateless servers
  - Least connections (or least outstanding requests) when request cost varies
  - Consistent hashing or IP hash when you need the same client to hit the same server
  - Health checks remove unhealthy backends from rotation regardless of algorithm
  - Mentions that the balancer itself must be redundant to avoid a single point of failure
followUps:
  - How would you handle one server that is twice as powerful as the others?
  - What breaks if you use IP hash behind a corporate NAT?
references:
  - title: Cloudflare Learning Center, Types of load balancing algorithms
    url: https://www.cloudflare.com/learning/performance/types-of-load-balancing-algorithms/
  - title: NGINX docs, HTTP load balancing methods
    url: https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/
updated: 2026-10-02
reviewed: true
---

A load balancer spreads incoming requests across a pool of servers so that no single server becomes a bottleneck and the pool can grow or shrink without clients noticing.

**Static algorithms** decide without looking at live server state:

- **Round robin** hands each request to the next server in the list. Simple and fair when every request costs about the same.
- **Weighted round robin** sends proportionally more traffic to bigger servers.
- **Hash-based** (IP hash, URL hash, consistent hashing) maps a key to a server so the same key keeps landing in the same place, which helps local caches and sticky sessions.

**Dynamic algorithms** use feedback:

- **Least connections** picks the server with the fewest open connections. Good for long-lived or uneven requests.
- **Least response time** adds latency into the choice.
- **Power of two choices** picks two servers at random and uses the less loaded one; it gets most of the benefit of least connections without global knowledge, which matters for distributed balancers.

Whatever the algorithm, pair it with **health checks** so failing servers are removed quickly, and run the balancer itself as an HA pair or behind DNS/anycast so it is not the single point of failure you just moved.

```mermaid
flowchart LR
  C[Clients] --> LB[Load balancer]
  LB --> S1[Server 1]
  LB --> S2[Server 2]
  LB --> S3[Server 3]
  LB -. health checks .-> S1
  LB -. health checks .-> S2
  LB -. health checks .-> S3
```
