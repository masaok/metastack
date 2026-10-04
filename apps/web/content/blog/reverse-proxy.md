---
slug: reverse-proxy
title: Reverse proxy for system design interviews
description: Reverse proxy for system design interviews. TLS, buffering, caching, and the mistakes that turn the hop into a bottleneck.
primaryKeyword: reverse proxy
secondaryKeywords:
  - tls termination
  - origin server
category: traffic-and-reliability
tags:
  - networking
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

A reverse proxy sits in front of origin servers and speaks to clients on their behalf. The client thinks it reached the product. The origin thinks it reached a neighbour. The proxy terminates TLS, buffers the request, picks an origin, and can cache a safe GET. It is not a load-balancing algorithm, and it is not an API gateway's policy engine, even when one process does more than one of those jobs.

## TLS, buffering, and the origin

The certificate lives on the proxy. Clients open a secure connection to a name they already know. The proxy decrypts. It can then speak plaintext to an origin on a private network, or open a second TLS session to that origin. Re-encryption protects the next hop. It does not undo the fact that the proxy has already seen the bytes. If the interviewer forbids a decrypt in the middle, you cannot put a path-aware proxy here. Forward the sealed TCP on layer 4, or route on SNI and leave the payload closed. [Load balancing for system design interviews](/blog/load-balancing-for-interviews) is that split.

Buffering is the second reason this hop exists. The client may send the body slowly. The origin should not hold a worker while those bytes dribble in. The proxy reads the request, or a prefix of it, and then opens the origin connection. It can also buffer the response so a slow client does not pin an origin worker. The cost is memory. Cap the body.

The origin is the server that actually has the answer. In a URL shortener, that is the stateless API that looks up a code. The proxy hides how many of those servers you have, and which one is up today. Clients keep one name. Health checks edit the origin set. A failed origin leaves the rotation. Run a pair of proxies. One proxy in front of three healthy origins is still a single point of failure.

The client connection ends at the proxy. The origin connection is a different socket. Keep-alives on the origin side save handshakes. A hung origin connection is a hung slot in the pool. Bound the pool and time it out.

A worked path. A browser requests `GET /abc12de`. The proxy already holds the TLS session. It reads the method and the path, picks a healthy origin, reuses a keep-alive if it has one, and forwards the GET. The origin reads the code from cache or from the primary key, as in [Design URL shortener for the interview](/blog/design-url-shortener), and returns 302. The proxy writes that response back. It never stored the long URL as a product record. It may have cached the 302 for a short TTL. That cache is a copy, not the source of truth.

## Caching at the proxy

A GET with a stable response is the candidate. The proxy stores the bytes and the status and answers the next client without waking an origin. The win is origin offload. The risk is a stale answer after the origin changed its mind.

`Cache-Control` on the origin response is the contract. A shortener's 302 can be cached for a few seconds if you still want later clicks to reach you. A 301 is a poor choice when you also want a count, because clients and intermediate caches keep the permanent redirect. That choice is already on the shortener post. The proxy will honour whatever you send.

Private responses stay out of a shared cache. An `Authorization` header is a stop sign unless the origin says the response may be stored. A feed page is per user. Caching it under the URL alone leaks one reader's list to the next. Cache a public short-link redirect. Do not cache `GET /feed`.

A miss on a hot object can stampede the origin. Collapse those misses: one origin fetch, many waiters. If you cannot, a viral code that expires will replay the full read load onto the API. A short TTL plus coalescing is the usual pair. A later neighbour post on a CDN covers the same idea at the edge of the network. Do not depend on that hop being in the drawing. A single proxy cache already changes a hot GET.

If a short link can be edited or deleted, purge the entry. A TTL hides the edit until it expires. POST, PUT, and DELETE are not cache food. The proxy forwards them. A replay of a write is an idempotency problem for the origin, not a cache hit.

| Response | Cache on the proxy? | Why |
| --- | --- | --- |
| Public 302 for a short code, short TTL | Yes, with a purge on edit | The target is public and the count can survive a few seconds of edge hits |
| 301 for a short code you still want to count | No | Clients and caches keep the redirect and the click never returns |
| `GET /feed` with a bearer token | No | The body is one reader's list |
| `POST /api/links` | No | A write is not a cache entry |
| Static asset with a content hash in the URL | Yes, for a long TTL | The bytes do not change for that URL |

## Path routing versus connection routing

Path routing is a layer-7 decision. The proxy parses HTTP and looks at the path, the host, or a header. `/api/*` goes to the API pool. `/static/*` goes to assets. A `beta` cookie goes to a canary. You cannot do this if you never decrypt. You pay the parse on every request.

Connection routing is a layer-4 decision. The hop looks at addresses and ports, picks a backend, and forwards packets. It does not see the path. WebSockets and raw TCP live here, because the unit is the connection. Once a chat socket is open, every frame should stay on the same backend. Picking a new origin per frame splits the session.

The upgrade path is the sharp edge. A WebSocket starts as HTTP. A layer-7 proxy that terminated the client side must accept the upgrade and pin the bytes to one origin for the life of the socket. A layer-4 hop can forward the TCP without knowing that an upgrade happened. Either works. A request-round-robin HTTP proxy that treats each frame as a new request does not.

Use path routing when the public name is shared and the internals are split by URL. Use connection routing when the payload must stay sealed, when the protocol is not HTTP, or when the session is a long socket. Large systems chain them. An L4 tier spreads connections across a fleet of L7 proxies. The L7 proxies then route on path. The reverse proxy is the L7 process in that chain.

A shortener is path routing in its simplest form. One path shape, `GET /{code}`, one origin pool. You still want the proxy for TLS, keep-alives, and a short cache on a viral code. A feed is the same idea with more than one pool. `/feed` and `/posts` can be different origins. Token and quota policy is the gateway on the same hop or just behind it. In this post the routing decision is the point.

## Where nginx or an equivalent sits in a drawing

Write one box between the internet and the origins. Nginx, Envoy, HAProxy, and Caddy are all fine labels. The interviewer wants the hop, not a license comparison.

On the left, clients. On the right, origin pools. Beside the proxy, a pair. If you have an L4 balancer, it sits left of the proxy and spreads connections across proxy processes. If an API gateway is a separate process, it sits right of the TLS hop and left of the services. If they are the same process, say so and keep one box.

```text
clients  ->  L4 pair  ->  reverse proxy (TLS, buffer, cache, path)
                              |            |
                              v            v
                         API origins   static origins
```

In a URL shortener drawing, the proxy terminates TLS for `GET /{code}` and `POST /api/links`. Origins are the stateless API servers. The cache the product cares about is still Redis in front of the link table. The proxy cache is an extra, short TTL on the 302. Do not replace the application cache with "nginx will remember." The application cache holds the long URL as a structured object you can purge by code. The proxy cache holds bytes.

In a fundamentals drawing, the proxy is the machine that makes layer 7 real. The [fundamentals study page](/study/fundamentals) is where the layer-4 versus layer-7 card lives, and the algorithms card. Point at the proxy when you need a hop that can see a path. Point at L4 when you must not.

Do not draw the proxy inside the origin. An application that listens on 443 and also runs the product is two jobs in one process. That is allowed at small scale. The moment you want two origins and one certificate, the certificate moves out. One public name is one TLS hop. Split origins behind it. A mesh of sidecars is an interior picture. It does not replace this hop for browsers and phones.

## Mistakes that turn the proxy into a bottleneck

Handshake CPU is the first. A single small proxy in front of a wide origin pool will melt on new TLS sessions before the origins are busy. Session resumption and HTTP/2 help. Scale the proxy fleet until handshake CPU is not the limit.

Buffering without a cap is the second. A huge body sent slowly fills proxy memory. A stalled browser does the same on the way out. Set a max body. Stream when you can.

A cache that is too proud is the third. Caching `GET /feed` under the path, caching a 301 you still need to count, or caching a code after a delete, all produce a correct-looking proxy and a wrong product. The key is too coarse or the TTL is too long.

A connection-per-request pool on a hot origin is the fourth. A viral short code should be answered from cache. If it misses, reuse keep-alives and collapse the miss. Put the application cache in front of the primary, as the shortener design already does. The proxy is not a substitute for that cache.

Request-by-request routing of a long socket is the fifth. Chat and any upgrade that holds the line need pin-until-close. The load-balancing post already flags this for WebSockets. The proxy is where that bug is implemented if you ignore it.

Retries stacked on retries are the sixth. The proxy retries a timed-out origin. The client retries the proxy. The origin did the write on the first try. Fail fast on writes. Retry only the reads you can prove are safe.

A single proxy process is the seventh. Health-check the origins and then die yourself. Run two. Reload in a way that drains. A config reload that drops every keep-alive at once is a self-inflicted outage.

Name the jobs and the failure. The proxy holds the certificate, buffers the request, and can cache a public GET. It health-checks origins and runs as a pair. It does not cache a personalized feed, and it does not hang a chat socket on a request-round-robin pool. Then draw the origins. Then drill the layer card and the algorithms card on the [fundamentals study page](/study/fundamentals).

[Start drilling](/study/fundamentals).
