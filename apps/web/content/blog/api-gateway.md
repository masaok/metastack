---
slug: api-gateway
title: API gateway for system design interviews
description: API gateway for system design interviews. The jobs the hop is good at, what must stay behind it, and a chat or feed that needs one.
primaryKeyword: api gateway
secondaryKeywords:
  - edge routing
  - request fan-out
category: traffic-and-reliability
tags:
  - api
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

An API gateway is the public hop in front of a set of services. Clients talk to one address. The gateway authenticates, rate-limits, and routes. It can fan one call out to more than one backend and assemble the reply. It is not the place that owns the write, and it is not the place that holds an open chat socket.

## The jobs a gateway is good at

The gateway is a product-aware edge. It knows API keys, paths, versions, and the services behind those paths. A reverse proxy can terminate TLS and hide an origin without knowing any of that. Keep the job list short. Every extra job is a single point every request pays for.

Auth belongs here when every public call needs the same check. Verify a token or an API key. Attach a user id. Reject the call before a backend spends a database read. The check is the same for the feed, the shortener, and an upload URL. Put it once.

Rate limiting belongs here for the same reason. One client should not starve the others. The token-bucket pair of a count and a last-refill time is what most gateways keep per key. That is the default in [Rate limiting for system design interviews](/blog/rate-limiting-for-interviews). Spend the token on this hop. A rejected call never reaches a service.

Routing belongs here when the public surface is one host and the internals are many. `/feed` goes to the feed service. `/posts` goes to the post service. `/v2` can land on a new pool while `/v1` stays on the old one. The client keeps one base URL.

Shaping belongs here in small doses. Strip a header the backend should not see. Add a correlation id. Map a 404 from an unknown service to a stable error body. Do not rewrite business fields.

Fan-out belongs here when one screen needs two or three reads and the client should not make those calls itself. The gateway gathers and returns one payload. Ten backends behind one public call is a timeout. Keep the gather shallow.

TLS often sits on the same hop, or on the proxy in front of it. The gateway then sees the path and the token. If the payload must stay sealed, this hop cannot do the jobs above. Move auth inside, or route on SNI and leave the bytes closed.

| Job | Why the gateway | When you refuse it |
| --- | --- | --- |
| Auth | Every public call needs the same token or key check | The check is different per service and needs that service's store |
| Rate limit | One key, one budget, spent before work starts | The limit is a per-resource quota the service already owns |
| Path routing | One public host, many internals | The next hop is a raw TCP session the gateway should not terminate |
| Shallow fan-out | One screen, two or three reads, one reply | The call graph is a workflow with writes and compensations |
| TLS and logs | The hop already opened the request | You are asked to keep the payload sealed end to end |

## Auth, routing, and fan-out

Walk one request. A client sends `GET /feed?cursor=...` with a bearer token. The load balancer in front of the gateway, the subject of [Load balancing for system design interviews](/blog/load-balancing-for-interviews), picks any healthy gateway process. The gateway verifies the token, spends a rate-limit token, and forwards the call to the feed service with the user id in a header the service trusts only from this hop. The feed service returns post ids. The client never learned the feed service's address.

A write is the same shape with more care. `POST /posts` still authenticates and rate-limits here. The gateway does not assign the post id and does not write the row. The post service validates, persists, and emits the fan-out event. The idempotency key on the body is the service's store. The gateway can require that the key is present. It should not be the store that remembers it.

Gateway fan-out is a synchronous gather. The client is still waiting. The feed's write path, which copies a post id into many user lists, is asynchronous and belongs on workers. Use the gather for reads that must appear together. Skip it for any write that has to be durable before you reply.

A worked gather. The home screen wants the session, the first twenty feed ids, and a badge count. The gateway starts three backend calls and sets a deadline shorter than the client's. If the badge service is slow, return the session and the feed and omit the badge. The page still renders. If a badge timeout also kills the feed call, the badge has become a single point of failure for the screen. Name the optional part. Fail it independently.

Routing should be a path prefix, a host, or a canary header. Do not route on a field inside a JSON body if a path will do. Body routing forces a parse of every write on the hottest hop you have. Auth should resolve the caller to an id and stop. Do not load a profile. Do not decide whether Alice is in a room. Membership is a chat-service check. The gateway can say this token is Alice. It cannot say Alice is in this room without becoming the membership store.

## What you must not hide behind the gateway

Business rules do not belong here. A feed ranker, a short-code allocator, and a chat membership check are service work. If you put them in the gateway, every team deploys through one process. A bug in ranking then takes down creates. A bug in auth still belongs on this hop. A bug in ranking does not.

The source of truth does not belong here. The gateway is stateless except for rate-limit keys and the route table. Those keys live in a shared store so two processes agree. Posts, short codes, and messages live behind services. If the gateway dies, in-flight requests fail. Durable writes that already committed stay committed. Do not keep the only copy of a write in gateway memory.

Long-lived sockets do not belong on the same processes as the REST surface. A chat WebSocket is a slot for minutes or hours. A REST gateway is sized for short requests. Mixing the two means HTTP work can starve sockets, and a reconnect herd can pin HTTP workers. Split the connection tier. The REST gateway can issue a ticket. The socket server is a different pool.

Service-to-service calls should not hairpin through the public hop. The feed service talking to a post cache is an interior call. A mesh or a plain client with timeouts is the tool. Hairpinning adds a hop, a public auth check the service does not need, and a way for a gateway outage to look like an interior outage.

Retries need a single owner. If the client, the gateway, and the service each retry, one timeout becomes a storm. Pick the layer closest to the caller that has enough context. The other layers fail fast. The [rate limiting post](/blog/rate-limiting-for-interviews) is how a 429 looks. A retry loop that ignores 429 turns a limit into a herd.

Every outbound call needs a timeout. A backend that never returns holds a gateway worker. Cap body size. A 50 MB JSON buffer is memory on the hottest hop. Send media through a presigned URL. The API carries a reference.

## Gateway versus a reverse proxy and a mesh

Three boxes get drawn in the same place and then confused.

A reverse proxy sits in front of origins. It terminates TLS, buffers the request, and forwards to a pool. It can cache a GET and route on a path. It does not need to know what an API key means. Nginx, Envoy, and Caddy are the labels people write. Treat it here as the fast neighbour of the gateway.

An API gateway is a reverse proxy with a product contract. It knows keys, users, plans, and routes. It may be the same process as the proxy. In an interview you can draw one box and say this hop terminates TLS, checks the token, spends the rate-limit token, and picks a service. If the interviewer splits the box, the proxy is the TLS part and the gateway is the policy part.

A service mesh sits beside each service, usually as a sidecar. It encrypts east-west traffic, retries interior calls, and collects per-RPC metrics. Mobile calls land on the gateway. Sidecars see the hops after that. Drawing a mesh and then sending every phone through a sidecar is a category error.

Load balancing is a job, not a third product. The pair in front of the gateway processes is still a load balancer. [Load balancing for system design interviews](/blog/load-balancing-for-interviews) is the algorithm and the layer.

| Hop | Faces | Sees | Must not become |
| --- | --- | --- | --- |
| Reverse proxy | Clients to origins | TLS, path, buffered bytes | The membership store or the ranker |
| API gateway | Clients to services | Token, key, route, maybe a shallow gather | The only copy of a write |
| Service mesh | Service to service | Interior RPC, mTLS, retries | The public internet's first hop |
| Load balancer | Clients to a pool | Address, port, or request fields | A single unaudited process |

When they say "put a gateway in front," answer with the job list and the refusal list. When they say "put nginx in front," they may want the proxy. Ask which jobs they want.

## A chat or feed design that needs one

A news feed needs a public REST surface. `POST /posts`, `GET /feed`, and `POST /users/{id}/follow` share auth and rate limits. They do not share a process with ranking or with fan-out workers. Draw the gateway. Behind it, the post service and the feed service. Behind those, the stores and the per-user id lists. The [classic designs study page](/study/designs) is where that prompt lives. The gateway is the front door, not the feed.

A chat system needs two fronts. History, conversation lists, and media upload URLs are REST and go through this gateway. Send, ack, receipt, typing, and presence ride a persistent socket on a connection tier. That process holds the socket. A stateless chat service validates and persists. A router looks up the recipient's connection process and pushes. The word "gateway" in that design is a WebSocket process. It is not this HTTP API gateway. People fail the chat prompt by hanging sockets on the REST hop, and they fail the gateway prompt by stuffing membership into nginx.

The feed still wants the HTTP hop because one place can authenticate, limit creates, and send `/feed` and `/posts` to different pools. A celebrity publish is a write storm inside workers. The gateway sees one `POST /posts`. Chat still wants the HTTP hop because reconnects reload history with `GET /conversations/{id}/messages?before=`. Give clients REST for the gap and a socket for the live tail.

Draw three layers. A pair of load balancers. A pool of API gateway processes for short HTTP. A pool of connection processes only when the product holds sockets. Health-check each pool. Put rate limits on the HTTP hop and admission control on the connection tier.

When you are asked to add a gateway to a design that already works, add the jobs from the first table and stop. Auth, limit, route, maybe a shallow gather. Leave ranking, allocation, membership, and durable writes where they are. Then drill a full design on the [classic designs study page](/study/designs).

[Start drilling](/study/designs).
