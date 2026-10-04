---
slug: cdn
title: CDN for system design interviews
description: CDN for system design interviews. Edge versus origin, what you may cache, push versus pull, and a hot video or a hot short link.
primaryKeyword: cdn
category: caching-and-storage
tags:
  - cdn
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

A CDN for system design interviews is a fleet of edge caches, not a faster origin. Users fetch a copy from a nearby city. Your servers see fewer reads. Writes still travel to the origin. Data that must be fresh on every request gains TLS termination and not much else.

## Edge versus origin

A content delivery network is a set of caching servers in many cities. Those sites are points of presence, or PoPs. A user is routed to a nearby PoP by DNS or by anycast. If that PoP has the object, it answers. The origin never sees the request. If it misses, the PoP fetches from your origin, stores a copy, and returns it.

Origin is the system you run. The application. The object store. The redirect service. Edge is the copy the CDN keeps. A good drawing has both. A drawing that only says "CDN" in front of a box has not chosen a cache key or a TTL.

Routing is how the user reaches the edge. DNS can return the address of a nearby PoP. Anycast can advertise the same address from many PoPs and let the network pick. You do not have to implement either. You have to name one.

Origin shielding sits between many PoPs and your origin. Misses from the fleet collapse into one fetch to you. Without a shield, a cold object can be fetched once per PoP. With a shield, the first miss fills the shield, and the other PoPs fill from there.

The edge terminates TLS near the user and can reuse warm connections to the origin. That helps even on a miss. It does not move the write. A form post, a charge, or a new short link still goes to origin and takes as long as it did.

[Load balancing](/blog/load-balancing-for-interviews) is the neighbouring box at the origin. The CDN chooses a PoP. The balancer chooses an origin server. Do not merge them. A layer 7 balancer can also cache. That is a reverse proxy, not a global edge fleet. If the prompt is worldwide latency, you want the fleet.

What the [cdn-basics card](/cards/cdn-basics) says a CDN solves. Latency, because a long haul is a hard limit. Origin load, because a popular object is fetched once per PoP, not once per user. Burst absorption, including volumetric attacks the edge can take. TLS and connection reuse.

What it cannot help with. Origin write latency. Personalised responses cached only by URL, which would leak one user's page to another. Data that must be computed fresh on every read.

## What you may cache, and for how long

Cache what is the same for many users. Images. Video segments. JavaScript and CSS bundles with hashed names. Public API responses with a short TTL. Whole HTML pages for anonymous users.

Do not cache a response that includes a user by URL alone. The next user gets the first user's page. Personalised content needs a cache key that includes the user, which tanks the hit rate, or edge compute that assembles a page from cached fragments, or no cache on that response.

The cache key is not the URL. The key is the URL plus the request fields you choose to vary on. Query strings, headers, and cookies you include in the key split the cache. Fields you ignore collapse variants that should stay apart. Hit rate is a function of that choice. A key that includes a session cookie makes every user a unique object.

TTL is how long a PoP may serve the copy. Public hashed assets can live a long time because the name changes when the bytes change. A news HTML page needs a short TTL and a purge on publish. A 302 from a shortener needs a short TTL so an edit or an expiry still shows up, and so later clicks still reach you if you count them.

Invalidation at the edge is a purge, a TTL, or a new name. A purge has to reach the PoPs. You will not prove it finished in the same second worldwide. Versioned names sidestep that. The application-cache invalidation post is the same three tools. Here they apply to objects you do not own the process for.

Private data can sit behind a CDN that only terminates TLS and forwards. That is not a cache hit. Do not call it one.

Range requests and video segments are cacheable because each segment is a separate object. The playlist can be short-lived. The segments can be long-lived. That split is how a hot title stops hitting origin after the first viewers at each PoP.

## Push versus pull, in brief

Who decides what sits at the edge. That is the whole comparison.

A pull CDN points at your origin. The first request for an object at a PoP misses. The edge fetches it, caches it for the TTL, and serves the rest. You do nothing per asset. Popularity fills the cache. The costs are a cold-start wait per PoP, origin load proportional to PoPs times distinct cold objects, and eviction you do not control.

A push CDN takes an upload. You send objects into the CDN's storage. They replicate to the edge. You control what is present and when. The origin is not hit for a served object. The costs are an upload pipeline, storage you pay for whether anyone asks, and manual invalidation when the bytes change.

Pull fits a large, long-tail catalog and content that changes often. Push fits a small set of large, predictable assets. Pull stores only what was requested. Push can store objects nobody wants.

A news site publishes constantly. Articles and images are small. Spikes are unpredictable. Pull with short TTLs and purge-on-update is the default. Pushing every article ahead of time buys nothing.

A video catalog is huge. A small set of titles takes most views. Each title is large. Release dates are known. Push, or pre-positioned pull, fits the hot set. Pull fits the long tail. Overnight fill of appliances inside an ISP is the extreme of push. The [push-versus-pull card](/cards/push-vs-pull-cdn) uses that split.

Hybrid is pre-warming. You pull a CDN, then fetch the objects you know will be hot before a launch so the first real user is not the miss. Mention that bridge. It is how you get push's predictability without storing the tail.

If the origin is down, a pull CDN can still serve what it already has until the TTL ends. It cannot fill a new key. A push CDN can keep serving the uploaded set. Neither one accepts a write for you.

## A hot video or a hot short link

Two prompts reuse the same edge, for different reasons.

A viral short code is millions of redirects an hour. The [URL shortener](/blog/design-url-shortener) post puts a shared application cache in front of the lookup, then allows a CDN to cache the 302 for a short interval. The interval has to stay short. Later clicks should still reach you if you count them. An expired or edited target must not linger at the edge. A 301 is the wrong status here because clients and CDNs may store it forever. A 302 plus a short edge TTL is the pair.

The hot key is still one object. The CDN copies that object to many PoPs. That is how a single code stops melting one cache node. Application-level consistent hashing does not split one key. The edge does, geographically, by serving the same 302 from many cities.

A hot video is a small set of large objects. Segments are cacheable. The first viewers at a PoP fill those segments. The rest of that city hits the edge. Origin sees roughly one fill per PoP per segment, or one fill at the shield. Push or pre-warm the title you are about to launch. Leave last year's long tail on pull.

The playlist or manifest changes when you cut ads or bitrates. Give it a short TTL. Do not give the segments the same short TTL or you will refetch gigabytes on every tweak.

Abuse and launches look like the same spike. The edge is where you absorb both. Origin still needs a plan for misses and for writes. A launch that is only reads of a pre-warmed object is a CDN success. A launch that is also a write storm is not.

Do not put the CDN in front of a POST that mints a code or records a charge and expect help. Those requests need [load balancing](/blog/load-balancing-for-interviews) at the origin, idempotency, and a store. The edge is for the later GET.

## What the cdn-basics card already asks you to say

The [cdn-basics card](/cards/cdn-basics) asks what a CDN is, what problems it solves, and what it cannot help with.

It is geographically distributed edge caches that serve content close to users to cut latency and origin load.

Clients reach the nearest edge via DNS or anycast.

It caches static assets well. Dynamic or personalised responses only with care. Short TTL. Careful cache keys. Edge compute if you assemble from fragments.

It also absorbs traffic spikes and volumetric attacks, and it terminates TLS near the user.

It cannot fix origin write latency or data that must be fresh per request.

A good spoken answer names the routing mechanism, the cache key, TTL and invalidation, and origin shielding so misses from many PoPs become one origin fetch.

Follow-ups on that card. How a cache key differs from a URL, and why that difference moves hit rate. What origin shielding is. Answer both from the sections above.

Then the [push-versus-pull card](/cards/push-vs-pull-cdn) asks which model you would pick for a video platform versus a news site. Pull for news. Push or pre-positioned pull for the hot video set, pull for the tail. Pre-warm as the bridge.

Start on the [fundamentals study page](/study/fundamentals). Run cdn-basics until edge, origin, cache key, TTL, and shield come out in one pass. Run push versus pull until the news-versus-video pick is automatic. Then [open the study page](/study) and keep the shortener card beside them, because a hot 302 is the smallest CDN drawing that still has a consequence.
