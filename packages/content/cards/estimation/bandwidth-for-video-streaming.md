---
id: bandwidth-for-video-streaming
deck: estimation
type: estimation
difficulty: 2
tags: [estimation, streaming, cdn]
prompt: >
  A video service has 5 million concurrent viewers at peak, streaming an
  average 3 Mbps. Estimate peak egress bandwidth and daily data transfer, and
  say what that implies for architecture.
keyPoints:
  - Peak egress, 5M × 3 Mbps = 15 Tbps (terabits per second)
  - That is far beyond any single datacenter's uplink, so delivery must come from a CDN or ISP-embedded caches
  - Daily transfer, assume 2 hours average viewing per DAU, e.g. 50M DAU × 2 h × 3 Mbps ≈ 135 PB per day
  - Adaptive bitrate (multiple renditions per title) multiplies storage, not egress, each viewer pulls one rendition
  - Egress cost dominates, so caching hit rate at the edge is the key business metric
followUps:
  - How much origin bandwidth do you need if the CDN hit rate is 98%?
  - How do live streams change the caching story compared with on-demand?
references:
  - title: Netflix Open Connect overview
    url: https://openconnect.netflix.com/en/
  - title: Cloudflare Learning Center, What is adaptive bitrate streaming?
    url: https://www.cloudflare.com/learning/video/what-is-adaptive-bitrate-streaming/
updated: 2026-10-02
reviewed: true
---

Video is the workload where bandwidth, not storage or QPS, decides the architecture.

**Peak egress**
5 × 10^6 viewers × 3 Mbps = 15 × 10^6 Mbps = **15 Tbps**.

For scale: a large datacenter might have a few Tbps of total internet uplink. You cannot serve this from one place, or from ten. It has to be served from hundreds of edge locations, ideally from caches sitting inside ISP networks so the traffic never crosses a paid transit link. This is why Netflix built Open Connect and why YouTube runs caches at ISPs.

**Daily transfer**
Assume 50 million DAU watching 2 hours each.
3 Mbps × 3,600 s = 10.8 Gb per hour ≈ 1.35 GB/hour.
50 × 10^6 × 2 h × 1.35 GB ≈ **135 PB/day**, roughly 4 EB per month.

At cloud egress list prices (cents per GB) that is tens of millions of dollars per month, so every point of CDN hit rate is worth real money.

**Origin load**
If the edge serves 98% of bytes, origin egress at peak is 2% × 15 Tbps = **300 Gbps**, still substantial, which is why a mid-tier (origin shield) sits between edge and origin to collapse misses.

**Storage vs egress**
Adaptive bitrate requires encoding every title into 6–10 renditions (240p through 4K). That multiplies *storage* roughly 3–4× relative to the top rendition, but each viewer downloads only one rendition at a time, so *egress* is unchanged. Storage for a 10,000-title catalog at ~20 GB per title per rendition set is ~200 TB, trivial next to egress.

**Live vs on-demand**
On-demand has a long tail but popular titles cache well. Live streams are perfectly cacheable (everyone wants the same 4-second segment at the same time) but the segments are new every few seconds, so the edge must fetch each one once and fan it out; origin load scales with the number of PoPs, not viewers.

Say the Tbps number, say "this cannot come from a datacenter", and the rest of the design follows.
