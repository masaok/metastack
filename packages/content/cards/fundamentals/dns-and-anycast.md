---
id: dns-and-anycast
deck: fundamentals
type: concept
difficulty: 2
tags: [networking, availability, latency]
prompt: >
  How do DNS and anycast route a user to the nearest healthy datacenter? What
  are the limits of each approach?
keyPoints:
  - DNS-based routing returns different IPs per resolver location or health, using geo or latency policies and short TTLs
  - DNS sees the resolver's location, not the user's, and TTLs are cached unpredictably so failover takes seconds to minutes
  - Anycast announces the same IP from many sites via BGP, so routers deliver packets to the topologically nearest site
  - Anycast failover is near instant when a site withdraws its route, but route flaps can break long-lived TCP connections
  - Most large systems use both, anycast for the edge and DNS for coarse steering and maintenance drains
eli5:
  - The name lookup can hand back a different address depending on where you seem to be and which sites are healthy
  - But it sees your lookup service and not you, and old answers linger for a while, so switching away from a dead site is slow
  - With anycast many sites share one address, and the internet's routers carry you to whichever is closest in network terms
  - When a site stops advertising the address traffic moves almost at once, but a route that wobbles can cut long connections
  - Big systems use both, shared addresses at the edge and name lookups for broad steering and planned maintenance
distractors:
  - DNS failover is instant, because resolvers always honour a low TTL
  - Geo DNS sees the end user's exact address, so it always picks the datacenter nearest to them
  - Anycast gives every site a different IP address and lets the client choose the nearest
followUps:
  - Why does EDNS Client Subnet exist and what does it leak?
  - How would you drain a datacenter for maintenance under each scheme?
references:
  - title: Cloudflare Learning Center, What is anycast?
    url: https://www.cloudflare.com/learning/cdn/glossary/anycast-network/
  - title: AWS Route 53 docs, Choosing a routing policy
    url: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html
updated: 2026-10-02
reviewed: true
---

Global systems need every user to land on a datacenter that is close and up. Two mechanisms do this at different layers.

**DNS-based steering.** The authoritative nameserver answers the same name with different IP addresses depending on who asks and what is healthy: geolocation of the resolver, measured latency, weighted splits for canaries, and health-checked failover. It is flexible and needs no special network hardware.

Limits:

- DNS sees the **recursive resolver's** address, not the user's. A user in Lisbon using a resolver in Frankfurt looks German. EDNS Client Subnet mitigates this by forwarding part of the client's IP.
- **TTL caching.** You set a 60-second TTL; some resolvers and operating systems ignore it and cache for longer, so failover is "mostly within a minute, fully within hours".
- Each answer is a point-in-time decision; it cannot react to congestion mid-connection.

**Anycast.** Every datacenter announces the *same* IP prefix via BGP. The internet's routers forward each packet along the shortest path they know, which usually means the nearest site. Nothing is cached: if a site withdraws its announcement, traffic converges on other sites within seconds. CDNs and DNS providers run their edges this way.

Limits:

- BGP "nearest" is about network hops and policy, not geography or load, so steering is coarse.
- A route change mid-connection sends later packets to a different site that has no TCP state, breaking the connection. Fine for DNS (UDP) and short HTTP requests; needs care for long-lived connections.
- Requires owning IP space and peering relationships.

**Together.** Anycast gets the packet into the nearest edge fast; the edge then proxies to an origin region chosen by DNS-level or application-level policy. Draining a site means withdrawing its BGP route (instant) or removing it from DNS (eventually).
