---
id: cdn-basics
deck: fundamentals
type: concept
difficulty: 1
tags: [cdn, latency, caching]
prompt: >
  What is a CDN, what problems does it solve, and what can it not help with?
keyPoints:
  - Geographically distributed edge caches that serve content close to users to cut latency and origin load
  - Clients reach the nearest edge via DNS or anycast routing
  - Caches static assets well, dynamic or personalised responses only with care (short TTL, cache keys, edge compute)
  - Also absorbs traffic spikes and DDoS and terminates TLS near the user
  - Cannot fix origin write latency or data that must be fresh per request
eli5:
  - Copies of your content sit in many cities, so users get it from nearby and your own servers do less
  - The network steers each user to the closest copy automatically
  - Files that are the same for everyone cache easily, while pages that differ per person need careful handling
  - It also soaks up sudden crowds and attacks, and sets up the secure connection close to the user
  - It cannot speed up saving data, or anything that must be freshly computed for each request
distractors:
  - A CDN speeds up writes to the origin database by committing them at the edge first
  - Personalised responses cache as easily as static assets, since the edge keys only on the URL
  - Every request still travels to the origin, the CDN only compresses the response on the way back
followUps:
  - How does a cache key differ from a URL, and why does it matter for CDN hit rate?
  - What is origin shielding?
references:
  - title: Cloudflare Learning Center, What is a CDN?
    url: https://www.cloudflare.com/learning/cdn/what-is-a-cdn/
  - title: AWS CloudFront docs, How CloudFront delivers content
    url: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HowCloudFrontWorks.html
updated: 2026-10-02
reviewed: true
---

A content delivery network is a fleet of caching servers (points of presence, or PoPs) placed in many cities. A user's request is routed to the nearest PoP; if that PoP has the object it responds in a few milliseconds, otherwise it fetches from your origin, stores a copy and returns it.

**Problems it solves**

- **Latency.** Speed of light is the hard limit; a round trip from Sydney to Virginia is ~200 ms. Serving from Sydney makes it ~10 ms.
- **Origin load.** A popular object is fetched from origin once per PoP, not once per user.
- **Burst absorption.** Launch-day spikes and volumetric DDoS hit the edge, which has far more capacity than your servers.
- **TLS and connection reuse.** The edge terminates TLS close to the user and keeps warm connections to origin.

**What it caches well:** images, video segments, JS/CSS bundles with hashed names, public API responses with short TTLs, whole HTML pages for anonymous users.

**What it does not fix:** writes still travel to origin; personalised responses need either a cache key that includes the user (low hit rate) or edge compute that assembles pages from cached fragments; and data that must be fresh on every read gains nothing except TLS termination.

```mermaid
flowchart LR
  U[User in Tokyo] -->|DNS / anycast| E[Edge PoP Tokyo]
  E -->|hit| U
  E -->|miss| S[Origin shield]
  S --> O[Origin]
```

A good answer names the routing mechanism, the cache key, TTL and invalidation, and origin shielding to collapse misses from many PoPs into one.
