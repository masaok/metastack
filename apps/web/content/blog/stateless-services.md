---
slug: stateless-services
title: Stateless services for system design interviews
description: Stateless services for system design interviews. What the word excludes, where session state lives, and when a stateful service is the honest answer.
primaryKeyword: stateless services
secondaryKeywords:
  - stateful services
category: architecture
tags:
  - architecture
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the stateless services answer an interviewer wants. The process can die and the next request still completes on any healthy replica. Session data, upload bytes, and other per-user memory do not live in that process. They live in a store the whole pool can read. Sticky routing is then optional, not required. A chat gateway or a leader is still stateful on purpose. The rest of this post is what the word excludes, where that state goes, how you scale without stickiness, when a stateful service is honest, and how to draw the boundary on a chat or a feed.

## What "stateless" actually excludes

Stateless does not mean the system has no data. It means this process does not hold the only copy of anything a later request needs. The replica can be killed, replaced, or added. In-flight requests on that replica fail. The next request, on any other replica, still works.

What you exclude from the process is durable or session-scoped memory that the next call must see.

A session object in a local map, keyed by cookie, is excluded. The second request lands on another box and the map is empty.

A local disk file from an upload that a later job will read is excluded. The job runs elsewhere. The file is gone.

A counter in memory that is the source of truth for rate limits is excluded. The next replica has a different counter.

A cache that is allowed to miss is not excluded. Missing is fine. The backing store still has the data. The replica that dies loses only a shortcut.

Configuration you load at boot is not excluded if every replica loads the same file or the same flag set. Losing one process does not lose the flags.

Open connections the process owns, such as a pool to the database, are not user state. They die with the process. The next replica opens its own. That is normal.

Say the test. "If I send SIGTERM to this instance, can the next request for this user succeed on a different instance without that user noticing, aside from a retry?" If yes, the service is stateless for interview purposes. If no, name the blob you left in the process.

People hide state in clever places. A WebSocket held in this process is state. The user is attached to this box. A local write-ahead file you forgot about is state. A shard of a hash ring that this process computed and never published is state. The word is about the next request, not about RAM in general.

## Session, upload, and the store that holds them

Three objects show up on almost every board. Move each one out of the process and name the store.

The session is a bag of facts about the signed-in user. You used to keep it in process memory and set a sticky cookie so the load balancer sent the user back. That works until the instance dies or you want to add a replica. Put the session in a shared store. Redis, a relational table, or an encrypted cookie that the server can read are the usual three. Redis is fast and needs a TTL. A table survives a Redis miss and costs a read. A cookie avoids a lookup and cannot be revoked server-side unless you keep a denylist. Pick one and say the revoke story.

The upload is bytes that are not yet a finished object. A multi-part upload that buffers on local disk fails when the next chunk hits another replica. Write chunks to object storage as they arrive. Keep the upload session, the part list, in the shared store. The last request completes the object. Any replica can take any part.

The in-progress job is the third. A thumbnail resize that writes to local disk and then uploads is a process that must finish on the box that started it. Write the original to object storage first. Enqueue a job that any worker can run. The worker reads the original from the store. The process that accepted the upload can die.

A table keeps the destinations honest.

| Object | Wrong home | Shared home |
| --- | --- | --- |
| Session | Map in the web process | Redis, a table, or a signed cookie |
| Upload parts | Local disk | Object storage plus a session row |
| Rate-limit counters | Process memory | Redis or a limiter service |
| Feature flags | Only one box's config | A store every replica reads |
| Hot-key cache | Fine if a miss is allowed | The source of truth stays elsewhere |

TTL is part of the design. A session without an expiry is a leak. An upload session without an expiry leaves parts forever. Name the expiry when you name the store.

Do not move state into the load balancer and call the service stateless. An IP-hash that pins a user to a box is stickiness. The service is still holding the session. You moved the problem into routing. [Load balancing for system design interviews](/blog/load-balancing-for-interviews) is where that pin belongs, and why you try not to need it.

## Scaling out without sticky routing

A stateless pool plus a balancer that does not pin users is the default interview shape. Round robin or least connections can pick any healthy replica. You add a box. It starts taking traffic. You remove a box. In-flight requests on that box fail. Clients retry. The next try lands on a live box and finds the session in the shared store.

Health checks make this real. The balancer stops sending to a replica that fails the check. The replica can drain. Statelessness is what makes drain cheap. There is no session to migrate.

Sticky routing is the workaround when you did not move the state. It has costs. A hot user pins a hot box. A dead box loses those sessions. Adding capacity does not help that user until the stickiness expires. Consistent hashing at the balancer can reduce reshuffle, but it still assumes the instance holds something. Prefer the shared store.

Horizontal scale then has one remaining limit: the shared store. Ten web replicas in front of one Redis that holds every session will pile onto Redis. Shard the session store, or keep sessions small, or put only a session id in Redis and the rest in a table. Name that next bottleneck. Do not pretend the web tier is the only tier.

Deploys get simpler. You start new replicas with the new binary. You stop old ones. You do not drain sessions from old to new. You do not need two-phase "are all sessions copied." A long request still needs a grace period. That is connection drain, not session migrate.

Autoscaling follows the same rule. The metric is CPU, queue depth, or request concurrency. It is not "how many sessions this box holds." If you find yourself autoscaling on session count, the box is stateful.

## When a stateful service is the honest answer

Some processes exist to hold connections or to be the single writer. Calling them stateless is a lie.

A WebSocket or TCP gateway holds an open connection to a device. The bytes for that socket live on one machine. You can keep the gateway code careful, and you still have a sticky connection. You store a map from user id to gateway id in a shared store so other services can find the socket. The gateway itself is stateful. You scale it by sharding connections, not by pretending any replica can write to that socket.

A leader that sequences writes is stateful. Only that process appends to the log, or assigns the next id, or decides the next election. Replicas can be stateless readers. The leader is not. You fail it over. You do not load-balance writes across a pool and hope.

A stream processor that holds window state is stateful. The state is for a key. That key lives on one worker. You checkpoint the state so a replacement can rebuild. You do not treat the worker like a web replica that can be killed with no plan.

An in-memory cache that is the only copy is stateful. If you accept that a miss goes to the database, the cache is a shortcut and the service in front can stay stateless. If you accept that a miss is a wrong answer, you have built a stateful store and you need placement, replication, and a story for a dead node.

The honest sentence is "this tier is stateful, and here is the map that finds the owner." The dishonest sentence is "everything is stateless" while you draw a socket on the box.

Cost is why people keep a stateful tier. Holding a million sockets in a dedicated gateway is cheaper than opening a new HTTP request for every chat line. A leader is cheaper than a consensus round on every id. You are not failing the interview by keeping those. You are failing it by hiding them.

## Drawing the boundary on a chat or a feed

A chat system makes the cut visible. The [chat](/cards/chat-system) design keeps a persistent connection tier apart from the services that write history.

The gateway is stateful. It owns the socket. It registers `user -> gateway` in Redis or an equivalent. When the gateway dies, those sockets die. Clients reconnect. A new gateway registers them. Presence flaps. That is expected.

The chat service behind the gateway is stateless. It accepts "send this message to this conversation." It writes the message to the store. It looks up the recipients' gateways. It asks those gateways to push. Any chat replica can do that work. The conversation history lives in a store keyed by conversation and time, not in the replica.

The feed is the same cut with fewer sockets. [Design news feed for the interview](/blog/design-news-feed) fans out into lists. The HTTP tier that reads a timeline is stateless. The list lives in cache or in a store. The worker that fans out is stateless if the job and the follower list live outside it. The thing that is not stateless is the store that holds the precomputed timeline. That is data, not a web process.

Draw the boundary as a line, not a slogan.

```
[clients]
    |  persistent sockets
[gateway]  -- stateful, holds connections, map in Redis
    |
[chat / feed API]  -- stateless, any replica
    |
[message store / feed lists]  -- the data
```

A request that does not need the socket should not enter the gateway's special path. History sync, profile reads, and old pages of the feed go to the stateless API. Live delivery goes through the gateway. Mixing them makes the stateful tier do work any replica could do.

Keep the order of the answer straight.

1. Define stateless as "any replica can take the next request."
2. Move session, upload, and counters to a named store.
3. Scale the pool without sticky routing.
4. Call out the tiers that are honestly stateful, such as a gateway or a leader.
5. Draw that line on the chat or the feed.

You can say "stateless" on every box. In the room the socket still lives on one machine. Speak the store and the gateway before you claim the pool can grow.

Drill the load-balancing half of this on the [fundamentals study page](/study/fundamentals). Then keep going on the [study page](/study).
