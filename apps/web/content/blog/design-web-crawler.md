---
slug: design-web-crawler
title: Design web crawler for the interview
description: Design web crawler for the interview. The frontier, politeness, the seen-set, freshness versus coverage, and a Bloom filter.
primaryKeyword: design web crawler
secondaryKeywords:
  - url frontier
  - bloom filter
category: worked-designs
tags:
  - scalability
  - crawling
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

To design web crawler pipelines, keep a frontier that knows which URL is next and which host is allowed to be hit now, then fetch, parse, and enqueue through separate worker pools. A seen-set stops you from fetching the same address twice. A Bloom filter keeps that set in memory at crawl scale. Freshness and coverage pull the frontier in different directions, so you have to say which one you are buying with the next fetch. The [web-crawler card](/cards/web-crawler) is the prompt. The numbers on it are the only rates this post will use.

## Frontier, politeness, and the URL seen-set

The frontier is the to-do list. It is not a FIFO of every link you have ever seen. It has to answer two questions at once. Which URL is worth fetching soon. Which host has waited long enough. The classic split is two levels. Front queues hold URLs by priority. Importance, staleness, and an operator boost all feed that priority. A selector draws more often from the hotter front queues. Back queues hold URLs for one host each. A heap of next-allowed-fetch times sits on those hosts. `frontier.next()` returns a URL whose host is free now. That is politeness as a data structure, not as a hope.

Politeness is one in-flight request per host unless the host published a larger budget, plus `robots.txt` and `crawl-delay`. Hammering one host until it is done is the distractor. You get blocked, and you starve every other host while you do it. Large sites have millions of pages. They crawl slowly on purpose. Throughput comes from many hosts in parallel, not from one host at full blast.

The seen-set is the set of URLs you have already decided to fetch or have already fetched. Before a parsed link goes back into the frontier, you ask whether it is new. A database lookup per URL does not fit. The card's seen set is 10 billion URLs. At about 100 bytes each that is about 1 TB. A disk check on every extracted link is the wrong latency. An in-memory structure has to answer first.

Normalise before you ask. Lowercase the host. Drop the fragment. Sort query parameters. Strip the tracking parameters you know. `http://Example.com/a?b=1#x` and `https://example.com/a?b=1` should collide if that is your rule. Session ids and infinite calendars are how a seen-set that skips normalisation grows without bound. Cap depth. Cap URLs per host. A calendar that mints "next month" forever is a trap, not coverage.

Seeds start the frontier. Operators add them and set per-domain rules. The API is interior: `frontier.next()`, fetch and parse queues, and `storage.put`.

## Fetch, parse, and enqueue

Each stage is a pool of stateless workers behind a queue. Fetchers only fetch. Parsers only parse. Storage workers only write. [Message queues for system design interviews](/blog/message-queues-for-interviews) is the reason those queues exist. A slow parser must not block a fetcher. The producer of each stage finishes without waiting for the next stage.

A fetcher takes a URL from the frontier. It resolves DNS through a local cache. Four hundred lookups a second toward a shared resolver, the card's rate at one billion pages a month, will throttle the whole crawl. A local caching resolver is a requirement. The fetcher also reads a cached `robots.txt` for that host. It then does one GET with a hard timeout and a size cap. `429` and `503` mean back off that host. Redirects are followed up to a small limit, then treated as a trap.

The fetch result is `(url, status, headers, body)` on the parse queue. Parsers extract links and a content record. They do not fetch. New links go through normalisation and the seen-set. Known links stop. New links go to the frontier with a depth of parent-plus-one and a priority the parser is allowed to hint at. The content record goes to storage if the body is new enough to keep.

| Stage | Input | Output | State it may hold |
| --- | --- | --- | --- |
| Frontier | Seeds and new links | A URL whose host is due | Priority queues, per-host next-fetch times |
| Fetcher | That URL | Status, headers, body | DNS cache, robots cache, no page store |
| Parser | The body | Links and a content record | Extractor code, no frontier heap |
| Dedup | A link or a body fingerprint | New or already seen | Bloom filter, recent fingerprints |
| Storage | A new record | Object bytes and a URL row | The source of truth for pages |

Storage is two places. Bodies go to object storage keyed by URL hash and fetch time. A URL table holds `url_hash`, the URL, the host, status, priority, last fetch time, change rate, content hash, and depth. A link table, or a graph store, keeps from-hash to to-hash for ranking later. The fetcher never writes those rows. The storage worker does. Make the write idempotent so a queue replay is safe.

A worked path. The frontier's heap says `example.com` is due. A fetcher receives `https://example.com/a`. DNS cache hits. Robots cache allows the path. The GET returns 200 and a body. The parser finds three links. One is a duplicate fragment of `/a`. The seen-set rejects it. One is a new path on the same host. It enters a back queue behind the crawl-delay. One is a new host. It enters a new back queue and a front queue by priority. The body hash is new, so storage writes the object and updates the URL row. The frontier's next pop for `example.com` waits until the delay elapses.

JavaScript-heavy pages need a headless browser. The card puts that cost at 10 to 100 times a plain GET. Use it on hosts you have chosen, not on the default path.

## Freshness versus coverage

Coverage wants a URL you have never fetched. Freshness wants a URL you have fetched whose copy is now the wrong picture of the live page. The frontier has a finite fetch budget. The card's budget is one billion pages a month, about 400 pages per second. At about 500 KB a page that is about 200 MB/s, 1.6 Gbps, and about 500 TB a month of raw HTML, perhaps 100 TB compressed. Every recrawl of an old page is a new page you did not discover. Say that trade.

A fixed recrawl of every page on the same clock is the distractor. Pages do not change at one rate. Record whether this fetch changed the content hash. Pages that change often get a shorter interval. Static pages drift out to weeks or months. Priority for a recrawl is importance times expected change. A high-rank page that changes daily beats a forgotten page that changes daily, and it beats a high-rank page that has not changed in a year.

Coverage still needs a share of the budget. New hosts, new paths, and seeds you have not drained should keep a lane in the front queues. If recrawls fill every fetcher, the frontier's unseen tail grows forever and you have a museum, not a crawler.

`last_fetched_at` and `change_rate` on the URL table are enough to schedule. The front queues are where that decision becomes a pop. Spill the cold tail of the frontier to disk. Billions of pending URLs do not fit in RAM. The hot head does.

[Back-of-the-envelope estimation for system design](/blog/back-of-the-envelope-estimation) is the procedure. State the billion pages, the 500 KB, the 10 billion seen URLs. Multiply. Round. Say what the result does. 400 pages a second is a fetcher fleet. 500 TB a month is object storage. 1 TB of raw seen URLs is why the next section exists.

## The bloom filter on the seen-set

A Bloom filter is the in-memory answer to "have we seen this URL?" It is a bit array and k hash functions. Insert sets k bits. Query checks those k bits. If any bit is zero, the URL was never inserted. If all are one, it was probably inserted. There are no false negatives. There are false positives at a rate you choose. The [Bloom filters card](/cards/bloom-filters) is the general form. Ten bits per element is about a 1 percent false-positive rate. Twenty bits is about 0.01 percent. A billion URLs at 1 percent is about 1.2 GB.

The crawler card sizes the crawl's filter at 10 billion URLs and 10 bits each, about 12 GB. That fits in memory. The raw URL set at 100 bytes each is about 1 TB and does not. The filter sits in front of the URL table. A "no" skips the disk. A "yes" means check the table, because the filter can be wrong in that direction.

A false positive on the seen-set drops a URL you have not fetched. That is why the table is still the source of truth and why you size for a low rate. A standard filter cannot produce a false negative. You refetch because you scheduled a recrawl, which is a different path.

You cannot delete from a standard Bloom filter. Clearing a bit can clear someone else's evidence. A crawl that must forget a URL needs a new filter or a counting variant. Keep the URL table as truth.

Content dedup is a second filter. Two URLs can carry the same page. SimHash or MinHash fingerprints catch near-duplicates. Compare Hamming distance to recent fingerprints. The seen-set stops duplicate addresses. The fingerprint stops duplicate bytes. LSM stores keep a filter per file so a point read skips disks that cannot hold the key. The crawler use is the one this design needs. Ten bits per element is the sizing rule of thumb you should be able to redo.

## What the web-crawler card already asks you to say

Speak in the card's order.

Build a frontier that has priority and politeness. One request at a time per host. Honour robots and crawl-delay. Front queues by importance and freshness. Back queues by host with a next-allowed time.

Split fetch, parse, and storage. Connect them with queues so each pool grows on its own. Fetchers carry a DNS cache and a robots cache. They do not parse. Parsers do not fetch.

Dedup addresses with a Bloom filter or a hashed set. Dedup bodies with fingerprints. Normalise first. A relational lookup of every URL is the listed failure.

Resolve DNS locally and spread work across hosts. The 400 pages per second are 400 chances to be polite or rude. Rude is faster on one host and dead on the crawl.

Handle traps, redirects, timeouts, and a recrawl interval that follows change rate. Infinite calendars need a depth cap and a per-host cap. A crash needs a checkpointed frontier. A replay needs idempotent stores.

The estimates you may use are on the card. One billion pages a month, about 400 pages a second, about 500 KB each, about 200 MB/s, about 500 TB a month raw. Ten billion URLs, about 1 TB as rows, about 12 GB as a 10-bit Bloom filter. Headless browsers cost 10 to 100 times a cheap GET.

Follow-ups. How you pick the next URL among 10 billion known ones. Answer with the two-level frontier, not with a scan. How you crawl JavaScript and what it costs. Answer with a selective headless fetcher and the 10 to 100 times factor.

A design that only says "I have workers and a queue" misses politeness, the seen-set, and the freshness schedule. Run the card on the [classic designs study page](/study/designs) until `frontier.next()` and the 12 GB filter come out without a stall.

[Start drilling](/study/designs).
