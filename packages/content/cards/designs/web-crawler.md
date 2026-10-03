---
id: web-crawler
deck: designs
type: design
difficulty: 3
tags: [messaging, storage, scalability]
prompt: >
  Design a web crawler that downloads billions of pages, respects site
  politeness rules, avoids duplicates, and keeps content reasonably fresh.
keyPoints:
  - Builds a URL frontier with prioritisation (importance, freshness) and politeness (one request at a time per host, honour robots.txt and crawl-delay)
  - Separates fetchers, parsers and storage into pipeline stages connected by queues so each scales independently
  - Deduplicates URLs with a Bloom filter or hashed set and deduplicates content with fingerprints (SimHash, MinHash)
  - Resolves DNS through a cache and spreads requests across hosts to avoid hammering one server
  - Handles traps (infinite calendars, session ids), redirects, timeouts and recrawl scheduling based on change rate
eli5:
  - Keep a to-do list of pages ordered by how important and how stale they are, and visit each site slowly and by its stated rules
  - Downloading, reading and saving are separate stations joined by lines, so each can grow as needed
  - Remember which addresses you have seen with a compact filter, and spot near-identical pages by comparing fingerprints
  - Remember address lookups and spread visits across many sites so no one server gets hammered
  - Guard against endless page mazes, follow redirects, give up on slow pages, and come back sooner to pages that change often
distractors:
  - text: Fetch as many pages in parallel from each host as possible, to finish that host quickly
    why: Hammering one host breaks politeness rules and gets the crawler blocked. Requests to a host are spaced out
  - text: Keep every URL already seen in one relational table and query it before each fetch
    why: A database lookup per URL is far too slow at billions of URLs. A Bloom filter or hashed set answers in memory
  - text: Recrawl every page on the same fixed schedule, however often it changes
    why: Pages change at very different rates. Recrawl frequency should follow how often each page changes
followUps:
  - How do you prioritise which of 10 billion known URLs to fetch next?
  - How would you crawl JavaScript-heavy pages and what does it cost?
stages:
  - name: Requirements
    keyPoints:
      - Fetch and store pages starting from seed URLs, extract links, revisit pages on a schedule
      - Politeness, robustness to malicious or broken sites, horizontal scalability, extensible to new content types
  - name: Estimates
    keyPoints:
      - 1B pages/month ≈ 400 pages/s, at ~500 KB each ≈ 200 MB/s download, ~500 TB/month raw before compression
      - URL set of 10B × ~100 bytes ≈ 1 TB for the seen set, Bloom filter at 10 bits each ≈ 12 GB
  - name: API
    keyPoints:
      - Internal, frontier.next(hostGroup), fetcher → parser messages, storage.put(url, content, metadata)
      - Operator API to add seeds, set per-domain policies and inspect crawl status
  - name: Data model
    keyPoints:
      - URL table with status, last fetched, change frequency, priority, content hash
      - Content store (object storage) keyed by URL hash with fetch metadata, link graph for ranking
  - name: High-level design
    keyPoints:
      - Frontier (priority + politeness queues) → fetchers (with DNS cache, robots cache) → parsers → dedup → storage, new URLs back to frontier
      - Each stage behind a queue, workers stateless and horizontally scaled
  - name: Deep dives
    keyPoints:
      - Two-level frontier, front queues by priority, back queues one per host with a heap of next-allowed-fetch times
      - Content dedup using SimHash to detect near duplicates, URL normalisation before the seen check
      - Freshness via adaptive recrawl intervals based on observed change rate
  - name: Bottlenecks and failure
    keyPoints:
      - Spider traps and infinite URL spaces bounded by depth and per-host URL caps
      - DNS as a hidden bottleneck, use a local resolver with caching
      - Checkpoint the frontier so a crash does not restart the crawl
references:
  - title: Manning, Raghavan and Schütze, Introduction to Information Retrieval, Chapter 20, Web crawling
    url: https://nlp.stanford.edu/IR-book/html/htmledition/web-crawling-and-indexes-1.html
  - title: Google Search Central, How Google Search works, Crawling
    url: https://developers.google.com/search/docs/fundamentals/how-search-works
updated: 2026-10-02
reviewed: true
---

## Requirements

Starting from seed URLs, download pages, store them, extract links and keep going; revisit pages so the stored copy stays fresh. Be polite (never overload a host, obey `robots.txt`), be robust against broken or hostile sites, scale horizontally, and make it possible to add new content handlers (PDFs, images) later.

## Estimates

One billion pages a month is ~400 pages/s. At ~500 KB per page that is ~200 MB/s of download bandwidth (1.6 Gbps) and ~500 TB/month of raw HTML, perhaps 100 TB compressed. A seen-URL set of 10 billion entries at ~100 bytes is ~1 TB in a database; a Bloom filter at 10 bits per URL is ~12 GB and fits in memory.

## API

Internal interfaces: `frontier.next()` returns a URL whose host is allowed to be fetched now; fetchers publish `(url, status, headers, body)` to a parse queue; parsers publish extracted links and content records. Operators add seeds, set per-domain limits and view crawl progress.

## Data model

`urls(url_hash PK, url, host, status, priority, last_fetched_at, change_rate, content_hash, depth)`. Page bodies go to object storage keyed by `url_hash` plus fetch timestamp. A `links(from_hash, to_hash)` table (or a graph store) supports ranking and discovery. Per-host state: `robots.txt` cache with expiry, crawl-delay, last request time.

## High-level design

```mermaid
flowchart LR
  SEED[Seeds] --> F[URL frontier]
  F --> FE[Fetchers]
  DNS[(DNS cache)] --> FE
  ROB[(robots.txt cache)] --> FE
  FE --> PQ[(Parse queue)]
  PQ --> P[Parsers + extractors]
  P --> DD[Dedup: URL seen set + content fingerprints]
  DD --> ST[(Content store + URL table)]
  DD -->|new URLs| F
```

Every stage is a pool of stateless workers connected by queues. Fetchers only fetch; parsers only parse; the frontier decides order.

## Deep dives

**Frontier design.** The classic two-level scheme: *front queues* partition URLs by priority (PageRank-like importance, freshness need, operator boosts); a selector pulls from higher-priority queues more often. *Back queues* hold URLs for exactly one host each, with a min-heap of "earliest next fetch time" per host so a fetcher always gets a URL whose host has waited long enough. This enforces politeness with one request in flight per host and respects `crawl-delay`.

**Deduplication.** Normalise URLs first (lowercase host, remove fragments, sort query params, strip tracking params) and check a Bloom filter backed by the URL table for exact matches. For content, compute a SimHash fingerprint and compare Hamming distance to recently stored fingerprints to catch near-duplicates (mirrors, print versions).

**Freshness.** Record whether each fetch changed the content. Pages that change often get shorter recrawl intervals; static pages drift out to weeks or months. Prioritise recrawls by importance × expected change.

**Robustness.** Hard timeouts, size limits, redirect limits, and per-host URL caps so a calendar that generates infinite "next month" links cannot consume the crawl. Treat `429` and `503` as signals to back off that host.

## Bottlenecks and failure modes

- **DNS:** 400 lookups/s to a shared resolver will throttle; run a local caching resolver.
- **Hot hosts:** large sites have millions of pages; politeness means they crawl slowly by design, so spread across many hosts in parallel.
- **Frontier size:** billions of pending URLs do not fit in memory; keep the hot head in memory and spill to disk or a database.
- **Crash recovery:** checkpoint frontier state and fetch progress; make fetch and store idempotent so replaying a queue is safe.
- **JavaScript pages:** headless browsers cost 10–100× more per page; use them selectively for high-value sites.
