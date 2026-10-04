---
slug: design-url-shortener
title: Design URL shortener for the interview
description: Design URL shortener for the interview. The read path, the write path, how short codes are minted, and a capacity estimate you can redo.
primaryKeyword: design url shortener
secondaryKeywords:
  - url shortener
  - short codes
category: worked-designs
tags:
  - designs
  - estimation
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

When you design URL shortener systems, start with a key-value lookup from a short code to a long URL. The service is read-heavy. The hard part on the write path is minting a unique code. The hard part on the read path is surviving a hot link.

## What you clarify first

Ask how many new links arrive. Ask how long a link lives. Ask whether the caller may choose the code.

The service creates a short link for a long URL. It redirects when someone opens that link. It accepts an optional alias and an optional expiry. It reports click counts.

Redirects need to finish in the tens of milliseconds. Availability needs to be very high. Codes must stay hard to guess by walking a counter. Creates may be slower than the redirect.

Assume 100 million new links a month. Assume 100 reads for every write.

## The write path

A create is `POST /api/links`. The body carries the long URL, an optional alias, and an optional expiry. The response carries the code and the short URL.

A load balancer hands the call to a stateless API server. The server checks that the URL is well formed. It rate-limits creates per user. It checks the destination against phishing lists and known bad domains.

An alias from the caller is the code. Otherwise a code allocator mints one. The server inserts `links(code, long_url, owner_id, created_at, expires_at)`. The code is the primary key, because every redirect is a point lookup on it.

That unique key is the uniqueness rule. A taken alias fails the insert. A minted code that loses a race fails the same insert. The API returns a conflict. A generated code gets one fresh try from the allocator. Aliases and generated codes share this column.

The API returns the short URL. The first redirect can fill the cache. Warming the cache on the create is optional at the write rate below.

Creates stop when the allocator is down. Existing codes still redirect. The read path never calls the minter.

## Two ways to mint the code

The code has to be unique, short, and hard to walk. Two schemes are worth defending. I pick base62 of a unique id.

**Base62 of a unique id.** A counter, or a Snowflake-style generator, issues an integer no other writer will issue. Encode it in base62. The alphabet is `a` to `z`, `A` to `Z`, and `0` to `9`.

Use seven characters. `62^7` is about 3.5 trillion codes. Ten years of links need 12 billion of them. A dense counter fits. Almost all of that keyspace stays empty.

`2^64` is about `1.8 × 10^19`. `62^10` is about `8.4 × 10^17`. `62 × 8.4 × 10^17` is about `5.2 × 10^19`, so `62^11` is the first power above `2^64`. A raw Snowflake id takes 11 characters. A timestamp and a worker id are what make the integer large. For seven characters, take the id from a counter inside `62^7`. Shuffle it before encoding.

A bare counter leaks volume. `00000ab` and `00000ac` are neighbors, so creation order is public. The newest code equals the create count. Bit-shuffle the id, or encrypt it, before the base62 step, so consecutive ids land far apart. A random offset only hides the absolute count. Keep the transform reversible with a key you control, so resolution stays a lookup.

**A hash of the URL, with collision handling.** Hash the long URL. Encode the hash in base62. Keep the first seven characters. Look that code up.

Insert when the code is missing. Return the existing short link when the stored URL is the same. When the stored URL differs, you have a collision. Append a salt and hash again. A counter or a random nonce can be the salt. Stop when the code is free or the URL matches. The primary key still rejects two writers who race.

You can defend the hash. It runs without a separate id service. Identical URLs can share one row when you want dedup. A new insert collides about as often as the occupancy below, near 0.3% after ten years.

I still pick the unique id. This API lets two owners shorten one URL. A pure hash puts both on one code. A salt on every request separates them by dropping the stable hash. An alias is an arbitrary string, so it needs the unique insert on its own. Anyone who knows the public hash can compute the code for a URL they already have. The hash create also reads the store before it writes. The id create is one insert.

The [URL shortener design card](/cards/url-shortener) also allows a random seven-character code with a clash check. A pre-built pool leased in batches is the other option there. Retries are rare at 0.3% occupancy. The primary key catches the unlucky draw. At about 40 creates a second, from the estimate below, I would skip the pool service.

## The read path

A redirect is `GET /{code}`. The load balancer picks any stateless server. The server reads the code from a cache such as Redis. The value is the long URL and the expiry.

A hit answers immediately. A miss loads `links` by primary key and fills the cache. An unknown code returns 404. A code past `expires_at` returns 404 as well. A background sweeper deletes those rows later.

A live code returns 302. The Location header is the long URL.

A 301 is a permanent redirect. Browsers and CDNs may store it. The next visit never reaches you. The click is missing from your counts. A 302 is temporary. Each click hits your redirect servers, so a full count is possible. Most commercial shorteners send 302 for that reason. Send 302 when the prompt includes analytics. You accept the reads that a 301 would have pushed out to clients.

Keep the counter off this path. A synchronous increment piles writes onto one hot code. It also adds a database round trip to the click. Write an event instead. Put the code, a timestamp, the referrer, and the user agent on it. Publish the event to a stream. Send the 302 without waiting for a consumer.

An aggregator writes `link_clicks_daily(code, day, count)`. Store one row per code per day with clicks. One row per click would turn a popular code into a write hotspot. Stats live on `GET /api/links/{code}/stats`, which reads the daily table. The redirect never joins that table.

Drop the cache row when a link changes, disappears, or expires. If targets can be edited, avoid 301. Clients that cached the permanent redirect will keep the old URL. A 302 plus a short cache TTL lets the edit show up.

## Capacity you can redo on a whiteboard

Follow the steps in [Back-of-the-envelope estimation for system design](/blog/back-of-the-envelope-estimation). State each assumption. Multiply. Round to a power of ten. Say what the result does to the design. These inputs are the ones on the [URL shortener capacity card](/cards/url-shortener-capacity).

Assume 100 million new links a month. Assume 100 reads per write. A month has 30 days. A day has 86,400 seconds. A row is about 500 bytes. Keep ten years. The hottest 20% of links draw 80% of reads. Cache that hot slice for one year of creates.

Writes. `30 × 86,400 = 2,592,000` seconds, about `2.6 × 10^6`. `10^8 / 2.6 × 10^6` is about 40 writes per second. The card puts the peak near 100 writes per second. `100 / 40` is 2.5 times the average.

Reads. `100 × 40` is about 4,000 reads per second. The card puts the peak near 10,000 reads per second. `10,000 / 4,000` is the same 2.5 times.

Storage. `100 million × 12 × 10 = 1.2 × 10^10` rows, 12 billion. Build the 500 bytes from a 7-byte code, a long URL of a few hundred bytes, an owner id, created and expiry timestamps, and a click count. The URL dominates the row. `12 × 10^9 × 500 = 6 × 10^12` bytes, about 6 TB. Five years, the horizon in the estimation post, is `100 million × 12 × 5 = 6` billion rows. At 500 bytes that is about 3 TB. Defend the card's ten-year number, 6 TB.

Six terabytes is large for one disk and ordinary for one database with replicas.

Code length in base62.

| Length | Codes |
| --- | --- |
| 5 | `62^5` is about 916 million |
| 6 | `62^6` is about 57 billion |
| 7 | `62^7` is about 3.5 trillion |

Five characters hold about 916 million codes, short of 12 billion. Six characters hold about 57 billion, so the decade fits. Occupancy is `12 / 57`, about 21%. Random codes collide often at that fill. Seven characters give `12 × 10^9 / 3.5 × 10^12`, about 0.3% full. Random inserts rarely collide. `3.5 × 10^12 / 1.2 × 10^10` is about 300 times the ten-year total, roughly 3,000 years. Pick seven.

Cache. One year is `100 million × 12 = 1.2` billion links. Twenty percent is 240 million. `240 million × 500` bytes is about 120 GB, a modest cache. If that set serves 80% of reads, the database sees the other 20%. Twenty percent of 4,000 is about 800 reads a second. Twenty percent of the 10,000 peak is about 2,000.

Say the result in one breath. About 40 writes a second, about 4,000 reads a second, and about 6 TB fit on one primary with replicas and a cache. Ids, 301 versus 302, and analytics are the rest of the interview. A single well-cached service handles this comfortably.

## Hot links, expiry, and abuse

A viral code on the design card is millions of redirects an hour. One million an hour is `10^6 / 3,600`, about 300 requests a second on that one key. The shared cache serves the key from memory after the first miss. A CDN can cache the 302 for a short interval and absorb the burst. Keep the interval short. Later clicks should still reach you. An expired or edited target should not linger at the edge.

When the cache has several nodes, place codes with the ring from [Consistent hashing explained for the interview](/blog/consistent-hashing-explained). Adding a node moves about `1/N` of the codes. The hot code is still one key. Virtual nodes leave that key on one node.

If the whole cache tier is down, size the database for the full read load for a few minutes, or fail some requests gracefully. The load is the peak you already have, about 10,000 primary-key reads a second. Name the option you are taking.

Creation is where abuse control belongs. Scan the destination. Rate-limit the caller. Reject known bad domains. A sequential code lets a scraper walk every link and harvest the long URL. The shuffle or the encryption blocks that walk. A custom alias uses the same primary key, so a duplicate fails the insert.

An edit or a delete removes the cache entry. After a delete, load the miss from the primary so a stale replica cannot refill the cache.

## Drill the design, then the numbers

Drill the design card first. The [URL shortener design card](/cards/url-shortener) asks for create, a fast redirect, and click counts. Reads dwarf writes, about 100 to 1. The code is seven base62 characters from a unique id, or a random code with a collision check. A cache sits in front of a key-value store or a relational store. Choose 301 or 302 from the analytics requirement. Count clicks in a side stream or a counter service, off the redirect. Then cover a hot link, expiry, and abuse, including bad destinations and guessable sequences.

The follow-ups are a custom alias that preserves uniqueness, and a link that can change or vanish after creation. One primary key on `code` covers the alias. Invalidate the cache when the target changes. Prefer 302 so clients fetch the new URL.

Then drill the [URL shortener capacity card](/cards/url-shortener-capacity). Start from 100 million links a month and 100 reads per write. Derive writes per second, reads per second, ten-year storage, and the code length. Include the hot cache, about 120 GB. Close with the card's conclusion. One database, replicas, a cache, and the real work on ids, redirect status, and analytics.

That card then asks what a raw auto-increment leaks in base62, and when you would shard. The shuffle is the leak fix. These rates and this disk size stay on one primary.

Start drilling on the [classic designs study page](/study/designs). Run the design card until both paths come out in order. Then run the capacity card until 40, 4,000, 6 TB, and seven characters show up without a stall.
