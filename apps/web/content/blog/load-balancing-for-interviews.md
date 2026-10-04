---
slug: load-balancing-for-interviews
title: Load balancing for system design interviews
description: Load balancing for system design interviews. Round robin, least connections, and consistent hashing, and when layer 4 and layer 7 change the answer.
primaryKeyword: load balancing
secondaryKeywords:
  - layer 4
  - layer 7
category: traffic-and-reliability
tags:
  - fundamentals
  - distributed-systems
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

Load balancing spreads requests so one server is not the bottleneck. The algorithm has to match whether requests are equal and whether a client must stick to one server. Round robin fits homogeneous, stateless servers when each request costs about the same. Least connections fits work whose cost varies. Consistent hashing or an IP hash fits when the same client must hit the same server. Health checks remove a failed server from rotation under every one of those rules. Run the balancer as a pair, or place it behind DNS or anycast. Clients still reach the pool if one balancer dies.

The pool can grow or shrink while clients still use the balancer's address. Unequal requests pile onto one server. A session stored on the first server breaks when the next request lands on another.

## Ask whether requests are equal and whether clients must stick

Equal requests take similar time and hold similar resources. Two cache reads are equal. A cache read and a report that holds a worker for ten seconds are not.

Stickiness matters when the next request needs state that only one server has. A session that lives in that process is one case. A local cache of that user's rows is the other. Skip stickiness when any healthy server can answer.

Static algorithms decide without live server state. Dynamic algorithms read feedback from the pool. The [load balancing algorithms](/cards/load-balancing-algorithms) card is that catalog.

## What round robin, least connections, and consistent hashing know

Round robin hands each request to the next server in a list. Its input is that list position.

Weighted round robin is still static. You assign the extra turns in advance. A server with twice the capacity gets about twice the requests. The weight does not inspect the request in hand.

Least connections, also called least outstanding requests, picks the server with the fewest open connections. A long request holds the count up. New work goes to a server that has already finished. The open connection is the signal. CPU spent inside a short connection stays invisible. Two calls that open and close together look the same, even when one of them burned more CPU. Least response time adds latency, so a slow answer stops new work from landing on that server.

Power of two choices samples two servers at random and keeps the less loaded one. It gets most of the benefit of least connections without a global count of every connection. Use it when several balancers share one pool and none of them sees the full set.

Consistent hashing maps a key to a server. The key might be a client address, a user id, or a cache key. The same key returns to the same machine. Local caches and sticky sessions need the same server again. The rule does not read live load. A hot key stays on that server while the server is busy.

IP hash is that rule with the source address as the key. Layer 4 can compute it, because the address is on the packet. Behind a corporate NAT, many clients share one public address. One address is one key. That office lands on one server. That server becomes the bottleneck.

For the ring, and for what moves when a server joins, use [Consistent hashing explained for the interview](/blog/consistent-hashing-explained). In this answer, stop once you have said why the client must stick.

| Algorithm | What it knows | When it fails | When you pick it |
| --- | --- | --- | --- |
| Round robin | Its place in a fixed server list | Slow and fast requests count as equal turns, so one server collects the expensive work | Homogeneous stateless servers and requests that cost about the same |
| Least connections | How many connections each server has open | The real cost never appears in the connection count, or no single balancer sees every connection | Long-lived or uneven requests, and a balancer that can see the open connections |
| Consistent hashing | The hash of a key such as a client address, a user id, or a cache key | It ignores live load, and an IP hash behind one shared NAT address pins every client on that address to one server | The same client or key must keep landing on the same server, for a local cache or a sticky session |

## Round robin overloads the slow server

Take three servers, A, B, and C. Nine requests arrive, one per second. The pattern is slow, fast, fast, repeated three times.

A slow request occupies its server for 10 seconds. A fast request occupies its server for 1 second. Each server runs one request at a time. Work that arrives for a busy server waits there.

Round robin starts at A, then B, then C.

A receives the arrivals at 0, 3, and 6 seconds. All three are slow. The first runs from 0 to 10. The second runs from 10 to 20. The third runs from 20 to 30. A is busy for 30 seconds.

B receives the fast arrivals at 1, 4, and 7 seconds. B does 3 seconds of work. C receives the fast arrivals at 2, 5, and 8 seconds. C does 3 seconds of work.

Each server got 3 requests. A did 30 seconds of work. B and C did 3 seconds each. A is still the bottleneck. The expensive arrivals lined up on one of the three list slots.

Least connections reads the open connection. At 3 seconds, A still holds the slow request from time 0. The next slow request goes to a server with a lower count. The same check runs at 6 seconds. Break ties toward A, then B, then C. Treat a job that ends at time t as already gone before a new arrival at that same time. Under those rules the nine requests land as 11 seconds on A, 13 on B, and 12 on C. Total work stays 36 seconds. No server holds 30.

## Layer 4 sees the connection and layer 7 sees the request

Which algorithm you pick still depends on what the balancer can see. [Layer 4 versus layer 7](/cards/l4-vs-l7-load-balancing) is that tradeoff. Interviewers shorten the names to L4 and L7.

Layer 4 works at the transport layer. It sees source IP, destination IP, and port. It picks a backend and forwards packets, often with NAT or direct server return. It does not parse the payload. It cannot see a URL, a host header, a cookie, or an HTTP method. It stays fast. It handles any TCP or UDP protocol. It can pass encrypted traffic straight through.

Layer 7 terminates the client connection. It parses the application protocol, usually HTTP, and opens a new connection to a backend. The parse costs CPU. Layer 7 then sees the path, the host header, and the cookies. It can send `/api/*` to one service and `/static/*` to another. It can send a request that carries a `beta` cookie to a canary pool. It can terminate TLS once, then talk plaintext or re-encrypt inside the network. It can add retries, timeouts, header rewriting, compression, rate limiting, and per-route metrics.

Use layer 4 for raw throughput, millions of connections, gaming, DNS, and raw TCP. Use layer 7 for routing on path or host, for canaries, and for auth at the edge. If the payload must stay sealed, stay on layer 4. A layer 7 proxy can also route on Server Name Indication, also called SNI, and leave the bytes encrypted. Per-route metrics need layer 7, because only that tier can see the route.

Large systems chain the tiers. A layer 4 tier uses anycast or ECMP and spreads traffic across a fleet of layer 7 proxies. The proxies do the routing that needs the HTTP request.

The layer also bounds the algorithm. Layer 4 can walk a list, count connections, and hash an IP. It cannot move an export path to a larger pool, because it cannot see the path. Layer 7 can run the same algorithms on requests. It can also split the pool by path, host, or cookie. At layer 4, least connections counts TCP connections. At layer 7, the same idea counts outstanding HTTP requests. The algorithms card lists both names for that one idea.

## Health checks edit the pool, and the balancer needs a pair

Each algorithm keeps choosing among the servers still in its set. A dead server stays in that set until a health check removes it. The check edits membership. Round robin then skips the failed backend. Least connections drops it from the count. A hash has to skip it too. Otherwise the client stuck to that key keeps landing on a dead machine.

One balancer in front of three healthy servers is still a single point of failure. Run the balancers as a high-availability pair, or place them behind DNS or anycast. Clients then still have a path when one balancer dies.

## What to say in the interview

Say whether requests are equal and whether a client must stick. Name the algorithm. Name the layer that can see the fields that decision needs.

"I put load balancing in front of the pool so one server is not the bottleneck. The servers are stateless and the requests cost about the same, so I use round robin. A report that holds a worker for seconds moves me to least connections. A user cache that lives on one machine moves me to consistent hashing. TCP that I must not decrypt stays on layer 4. A path or a cookie that changes the destination puts me on layer 7. I health-check the backends, and I run two balancers."

**A server twice as powerful.** Give it weight 2. Give each other server weight 1. Use that weight when the requests themselves are similar. A weight does not separate the 10-second calls from the 1-second calls in the example above.

**IP hash behind a corporate NAT.** One shared source address hashes the whole office to one server. A cookie identifies the person. Reading that cookie requires layer 7.

**WebSockets.** The session starts as HTTP and then holds the connection open. Layer 4 forwards that TCP connection. It does not have to parse the upgrade. Layer 7 has terminated the client side, so it must accept the upgrade. It must also keep that client's bytes on the same backend for the life of the socket. A new server for each message splits the session.

**TLS termination.** Layer 7 can terminate TLS, then speak plaintext or re-encrypt toward the backend. The proxy sees the URL, the cookies, and the body. It sits inside the trust boundary. Re-encryption protects the next hop. The proxy has already seen the plaintext. If decryption in the middle is forbidden, forward the sealed bytes on layer 4, or route on SNI and leave the payload closed.

1. Name the bottleneck a single server would become.
2. Choose round robin, least connections, or a hash from equal cost and stickiness.
3. Use the three-server counts if the interviewer pushes on round robin.
4. Say what layer 4 can see, and what layer 7 can see.
5. Add health checks and a second balancer.

## Drill both cards

Drill the two prompts separately. A pass on the algorithms card leaves the layer card untested.

The [load balancing algorithms](/cards/load-balancing-algorithms) prompt asks you to name the common algorithms and to say when you would pick each one. Hit these points out loud. Round robin and weighted round robin fit homogeneous, stateless servers. Least connections, or least outstanding requests, fits when request cost varies. Consistent hashing or an IP hash fits when the same client must hit the same server. Health checks remove unhealthy backends no matter which algorithm you chose. The balancer itself has to be redundant. Four of those five, said before you reveal the back, is a pass. Naming only round robin fails the card.

The [layer 4 versus layer 7](/cards/l4-vs-l7-load-balancing) prompt asks you to compare them and to say when each is the right choice. Layer 4 balances on IP and port and does not read the payload, so it is fast and works across protocols. Layer 7 terminates the connection and routes on the path, the host header, or cookies. That read supports content routing, TLS termination, compression, and per-request metrics. Layer 4 is the choice for raw throughput, for non-HTTP protocols, and when encryption must stay intact end to end. Many systems chain a layer 4 tier in front of layer 7 proxies. Four of these five, spoken first, is a pass.

Grade the way [System design interview flashcards that actually stick](/blog/system-design-interview-flashcards) describes. Speak first. Tick a point only when you said it. Then drill both cards on the [fundamentals study page](/study/fundamentals).

[Start drilling](/study/fundamentals).
