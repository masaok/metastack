---
id: l4-vs-l7-load-balancing
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [load-balancing, networking, latency]
prompt: >
  Compare layer 4 and layer 7 load balancing. When is each the right choice?
keyPoints:
  - L4 balances on IP and port without reading the payload, so it is fast and protocol-agnostic
  - L7 terminates the connection and routes on HTTP details such as path, host header or cookies
  - L7 enables content-based routing, TLS termination, compression and request-level observability
  - L4 wins for raw throughput, non-HTTP protocols and when end-to-end encryption must be preserved
  - Many real systems chain them, an L4 tier in front of L7 proxies
eli5:
  - The lower kind forwards by address and port without opening the message, so it is quick and works for any protocol
  - The higher kind opens the request and decides using the web address, the site name or cookies
  - Because it reads requests it can route by content, handle encryption, compress replies and report on every request
  - The lower kind wins on raw speed, for traffic that is not web traffic, and when encryption must stay intact end to end
  - Many setups use both, the lower kind at the front feeding a row of the higher kind
distractors:
  - An L4 balancer routes on the URL path and cookies
  - L7 is faster than L4 because it understands the protocol and can skip work
  - An L7 balancer can inspect HTTP headers while leaving end-to-end TLS untouched
followUps:
  - Where does WebSocket traffic fit, and what does an L7 balancer need to support it?
  - How does TLS termination at L7 affect your security story?
references:
  - title: AWS docs, Network Load Balancer vs Application Load Balancer
    url: https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html
  - title: Envoy docs, Load balancing
    url: https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancing
updated: 2026-10-02
reviewed: true
---

**Layer 4** balancers work at the transport layer. They see source and destination IP and port, pick a backend, and forward packets (often with NAT or direct server return). Because they never parse the payload they are extremely fast, handle any TCP or UDP protocol, and can pass encrypted traffic straight through.

**Layer 7** balancers terminate the client connection, parse the application protocol (usually HTTP), and open a new connection to a backend. That costs CPU but unlocks a lot:

- route `/api/*` to one service and `/static/*` to another
- send users with a `beta` cookie to a canary pool
- terminate TLS once, then talk plaintext or re-encrypt inside the network
- add retries, timeouts, header rewriting, compression, rate limiting and per-route metrics

**Choosing**

| Need | Pick |
| --- | --- |
| Millions of connections, gaming, DNS, raw TCP | L4 |
| Path or host based routing, canaries, auth at the edge | L7 |
| Must not decrypt in the middle | L4 (or L7 with SNI-only routing) |
| Rich request-level observability | L7 |

In practice large systems stack them: an L4 tier (anycast or ECMP) spreads traffic across a fleet of L7 proxies, which then do the smart routing.
