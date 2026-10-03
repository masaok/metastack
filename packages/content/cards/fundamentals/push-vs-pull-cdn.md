---
id: push-vs-pull-cdn
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [cdn, caching, storage]
prompt: >
  Compare push and pull CDNs. Which would you choose for a video platform
  versus a news site?
keyPoints:
  - Pull CDN fetches from origin on first miss and caches by TTL, simple to operate and self-populating
  - Push CDN requires you to upload content ahead of time, giving control over what is at the edge and when
  - Pull suits large, long-tail catalogs and frequently changing content, push suits a small set of large, predictable assets
  - Pull adds first-request latency and origin load on cold keys, push wastes storage for items nobody requests
  - Hybrid, pre-warming hot items into a pull CDN before a launch
eli5:
  - With pull, the nearby copy fetches a file from your server the first time someone asks and keeps it for a while, so it fills up by use
  - With push, you upload files to the nearby copies beforehand, so you decide what is there and when
  - Pull fits big catalogues where most items are rarely wanted, and push fits a few large files you know will be needed
  - Pull makes the first visitor wait and hits your server for cold items, and push stores things nobody may ever ask for
  - A blend is to pre-load the items you expect to be popular before a launch and let the rest fill in on demand
distractors:
  - A pull CDN needs every file uploaded to the edge before the first request
  - A push CDN populates itself on demand from the origin
  - Pull is the wasteful one for a long-tail catalog, since it stores items that nobody requests
followUps:
  - How would you pre-warm a pull CDN for a global product launch?
  - What happens to a pull CDN if the origin is down?
references:
  - title: Cloudflare Learning Center, What is a CDN?
    url: https://www.cloudflare.com/learning/cdn/what-is-a-cdn/
  - title: Netflix Open Connect overview
    url: https://openconnect.netflix.com/en/
updated: 2026-10-02
reviewed: true
---

The two models differ in who decides what sits at the edge.

**Pull CDN.** You point the CDN at your origin. The first request for an object at a PoP misses, the edge fetches it, caches it for the TTL you set, and serves subsequent requests. You do nothing per asset; popularity does the work. Costs: a cold-start latency hit per PoP, origin load proportional to the number of PoPs and distinct objects, and the CDN decides what to evict.

**Push CDN.** You upload (push) objects to the CDN's storage and they are replicated to the edge. You control exactly what is available and when, and the origin is never hit for served content. Costs: an upload pipeline you own, storage you pay for whether or not anyone watches, and manual invalidation when content changes.

**Video platform.** The catalog is huge but a small set of titles gets most views, each title is tens of gigabytes, and release dates are known. Push (or pre-positioned pull) makes sense for the predictable hot set, with pull for the long tail. Netflix's Open Connect appliances are the extreme version: they fill overnight, pushed from the catalog, inside ISP networks.

**News site.** Articles and images are small, published constantly, and spike unpredictably. A pull CDN with short TTLs (and purge-on-update) is the right default; pushing every article ahead of time buys nothing.

The general rule: push when content is large, few and predictable; pull when it is many, small and changing. Mention pre-warming as the bridge between the two.
