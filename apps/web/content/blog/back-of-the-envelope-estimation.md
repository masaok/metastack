---
slug: back-of-the-envelope-estimation
title: Back-of-the-envelope estimation for system design
description: A step-by-step method for back-of-the-envelope estimation in system design interviews, with worked QPS and storage examples and the numbers to memorise.
primaryKeyword: back-of-the-envelope estimation
secondaryKeywords:
  - capacity estimation interview
  - latency numbers every programmer should know
category: worked-designs
tags:
  - estimation
  - interviews
createdAt: 2026-10-02
publishedAt: 2026-10-02
draft: false
---

Back-of-the-envelope estimation is a fixed procedure. You state an assumption, you multiply, you round to a power of ten, and you say what the result means for the design. The interviewer is not checking your digits. They are checking that you can turn "100 million users" into "about 20,000 requests per second, so a fleet of web servers and one primary database" without stalling. This post gives you that procedure, the handful of numbers it depends on, two examples worked line by line, and the mistakes that lose points even when the arithmetic is right.

## What the estimate is for

An interviewer asks for numbers early in a design question for one reason. The numbers decide the architecture. Forty writes per second is one database. Two hundred thousand writes per second is a partitioned store and a sharding key. Fifteen terabits per second of video egress cannot come from a datacenter at all, and it forces a CDN into the design before you have drawn a box. Until you have the number you are guessing which problem you are solving.

The estimate also sets the scale of everything that follows. If you say the storage is six terabytes, the interviewer will notice if you later propose a hundred-node cluster for it. If you say the read rate is four thousand per second, a single cache in front of a single primary is a defensible answer. The number is a commitment. A good candidate uses it to keep the design honest.

The precision expected is low. Within a factor of two or three is fine. Within an order of magnitude is often fine. What is not fine is a wrong order of magnitude, or a silence while you try to recall how many seconds are in a day.

## The procedure, step by step

Every estimation card in the MetaStack deck follows the same five steps, and so should you.

1. **State the inputs as assumptions.** Say the numbers out loud before you use them. "I will assume 100 million daily active users, 20 requests per user per day, and a peak of three times average. Tell me if your numbers differ." This gives the interviewer a chance to correct you, and it makes the arithmetic auditable.
2. **Convert to a per-second or per-byte unit.** Daily totals become per-second rates when you divide by 86,400, which you round to 10^5. Object counts become bytes when you multiply by a size you have memorised.
3. **Round to one significant figure and powers of ten.** Write 2 × 10^9, not 2,000,000,000. Keep the exponent and the leading digit. Nothing else survives the interview anyway.
4. **Apply the multipliers that change the answer.** Peak factor. Read-to-write ratio. Replication factor. Growth over the years asked. Each one is a single multiplication, and skipping one is the most common error.
5. **Say what the number means.** This is the step candidates forget and the step interviewers grade. "Twenty thousand QPS means tens of application servers and one primary database with replicas." If you stop at the number, you have done arithmetic. If you say what it implies, you have done system design.

A sixth step belongs on the end. Sanity check the result against a number you know. If a server count comes out at ten thousand, question the per-request cost. If it comes out at five, question the traffic.

## The numbers worth memorising

You need fewer facts than you think. The table below is pulled from the [latency numbers card](/cards/latency-numbers) and the [powers of two and data sizes card](/cards/powers-of-two-and-data-sizes), plus the capacity rules of thumb that recur across the estimation deck. Learn these and most estimation questions become multiplication.

| Fact | Value to carry |
| --- | --- |
| Seconds in a day | 86,400, round to 10^5 |
| Peak traffic over average | 2 to 5 times |
| 2^10, 2^20, 2^30, 2^40 | thousand, million, billion, trillion |
| 2^32 | about 4.3 billion, fits in 4 bytes |
| int, long or timestamp, UUID | 4 bytes, 8 bytes, 16 bytes |
| Short text post or chat message | 100 to 500 bytes |
| JSON API response | 1 to 10 KB |
| Compressed photo | 1 to 3 MB |
| Full web page with assets | about 2 MB |
| Main memory reference | 100 ns |
| SSD random read | 100 µs |
| HDD seek | 10 ms |
| Round trip inside a datacenter | 0.5 ms |
| Round trip across a continent | 100 to 150 ms |
| One stateless web server | 1,000 to 10,000 simple requests per second |
| One relational primary | a few thousand writes per second |
| One cache node | 100,000 to 200,000 simple reads per second |
| Hot set under the 80/20 rule | 20% of items serve 80% of reads |
| Replication | 3 copies, or about 1.4 to 1.5 times with erasure coding |

The latency rows matter less for the arithmetic and more for the design consequences. Disk is a thousand to a hundred thousand times slower than memory. A cross-continent round trip costs as much as hundreds of in-region calls. Those ratios are why caches dominate read-path design and why a synchronous cross-region call is a mistake. The ladder is easier to recall in bands. Nanoseconds for CPU and memory. Microseconds for SSD and the local network. Milliseconds for spinning disk and the wide-area network.

## A worked example for QPS from daily active users

This is the first number every design needs, and it is the prompt on the [QPS from daily active users card](/cards/qps-from-daily-active-users). A product has 100 million daily active users. Each makes 20 requests a day. Find average and peak QPS.

Requests per day. 100 × 10^6 × 20 = 2 × 10^9.

Average QPS. Divide by seconds per day. 2 × 10^9 / 10^5 = 2 × 10^4, so about 20,000 QPS. If you use 86,400 instead of 10^5 the exact figure is 23,148. The rounding error is under 15%, and nobody in the room cares.

Peak QPS. Traffic concentrates in waking hours and around events. A global product is flatter, so use two to three times average. A single-country or event-driven product spikes harder, so use three to five. Say which you are assuming. At three times, plan for about 60,000 QPS, and quote a range of 50,000 to 100,000.

Split reads from writes. Ask for the ratio or assume one. A feed-style product might see 100 reads per write. A messaging product is closer to one read per write. At 10 to 1 the average breaks into roughly 18,000 reads per second and 2,000 writes per second. The split matters because reads scale with caches and replicas, while writes decide the primary database and the sharding story.

Now the step that earns the points. A stateless web server handles 1,000 to 10,000 simple requests per second, so 100,000 peak QPS is tens of application servers behind a load balancer. That is normal. A single relational primary handles a few thousand writes per second comfortably, so 2,000 writes per second is fine on one node, and 20,000 would push you to sharding. Say both sentences and the interviewer knows you can size a tier.

The follow-up question is usually "what is the next number you need?" The answer is storage, which is the second example.

## A worked example for URL shortener storage over five years

The URL shortener is the classic warm-up, and the [URL shortener capacity card](/cards/url-shortener-capacity) drills it. The service creates 100 million links a month with a 100 to 1 read-to-write ratio. Estimate the write rate, the read rate, storage over five years, and how long the short code must be.

Write rate. A month is about 30 × 86,400 ≈ 2.6 × 10^6 seconds. 10^8 / (2.6 × 10^6) ≈ 40 writes per second. Peak perhaps 100.

Read rate. 100 to 1 gives about 4,000 reads per second, peak around 10,000. These numbers are small. Saying so out loud is part of the answer.

Rows over five years. 100 million × 12 months × 5 years = 6 × 10^9 rows. Six billion links.

Bytes per row. A short code of 7 bytes, a long URL of 200 to 500 bytes, a user id, created and expiry timestamps at 8 bytes each, and a click count. Call it 500 bytes. Most of it is the URL.

Total storage. 6 × 10^9 × 500 bytes = 3 × 10^12 bytes, so about 3 TB. Over ten years, which is the horizon the card uses, that doubles to 12 billion rows and 6 TB. Either way the result is large for one disk and small for a sharded relational database or a key-value store. Three-way replication takes 3 TB to 9 TB, which changes the bill and not the design.

Short code length. Base62 uses the letters a to z, A to Z and the digits 0 to 9. Six characters gives 62^6 ≈ 57 billion codes. Seven gives 62^7 ≈ 3.5 trillion. Six billion codes in five years fits inside six characters, but at about ten percent occupancy randomly generated codes collide often, and ten years of growth squeezes it further. Seven characters leaves the keyspace nearly empty, with about 0.2% occupancy at five years, so random generation almost never collides and the URL stays short. Seven is the usual answer.

Cache. If 20% of links get 80% of reads, caching the hot 20% of one year's links is 240 million × 500 bytes ≈ 120 GB. That fits a modest in-memory cluster and removes most reads from the database.

The conclusion to say out loud. Tens of writes and thousands of reads per second with single-digit terabytes is one primary database with read replicas and a cache in front. The interesting problems are id generation, the choice between a 301 and a 302 redirect, and analytics. Scale is not one of them. Recognising a small system is as valuable as sizing a large one.

## How to turn a rate into a machine count

The two examples above produce rates and bytes. The third shape of estimation question turns a rate into a number of machines, and it needs one formula. Little's law says the number of requests in flight equals the arrival rate times the time each request spends in the system. The [server count from QPS card](/cards/server-count-from-qps) uses it like this.

An API must serve 60,000 peak QPS, and each request takes about 50 ms of service time on one core. In flight, 60,000 × 0.05 s = 3,000 requests. A core at full utilisation handles 1 / 0.05 = 20 requests per second, so 3,000 cores at 100% busy.

Never plan for 100%. Queueing delay grows roughly as 1 / (1 minus utilisation), so at 90% a request waits nine extra service times. Target 50 to 70%. 3,000 / 0.6 ≈ 5,000 cores. On 32-core machines that is about 160 servers. Spread across three zones with enough headroom to lose one, call it 240.

The sanity check is the point of the exercise. A couple of hundred mid-size servers for 60,000 QPS doing real work is reasonable. Then ask what the 50 ms is spent on. If 40 ms of it is waiting on a database, one core can overlap many requests, the server count collapses, and the real constraint becomes a database that must absorb 48,000 queries per second. That is the harder problem.

The same move hides in the [cache sizing card](/cards/cache-size-80-20) and the [read replica card](/cards/read-write-ratio-and-replicas). A news feed with 10 billion reads a day is about 115,000 reads per second. A cache that serves 80% of them leaves 23,000 per second for the database, and the cache itself is 100 million posts at 1 KB plus overhead, about 150 GB across a few nodes. Whenever the replica math gives more than ten nodes, the right answer is usually a cache, and you should say so.

## Mistakes that cost points

**Forgetting the peak factor.** Average QPS is the number you compute. Peak QPS is the number you build for. Candidates who size for the average have under-provisioned by a factor of two to five before the design starts.

**Sizing for text when media dominates.** 500 million posts a day at 300 bytes is about 150 GB per day. The same users uploading one 2 MB photo each is 1 PB per day, three orders of magnitude more. Find the term that dominates before you spend time on the others.

**Treating replicas as free capacity.** A read replica must also apply every write the primary accepts. If a node does 15,000 queries per second and 2,000 of those are replicated writes, each replica has about 13,000 left for reads. Divide by 13,000, not 15,000.

**Stopping at the number.** "Twenty thousand QPS" is not an answer. "Twenty thousand QPS, so tens of application servers and one primary" is. The interviewer wants to hear the consequence.

**Silent assumptions.** If you assumed 20 requests per user and the interviewer had 200 in mind, every number after that is wrong by ten. Saying the assumption out loud costs a sentence and buys you a correction before the damage spreads.

**Precision theatre.** Quoting 23,148 QPS when the inputs were round guesses signals that you do not know which digits matter. Round early. Keep one significant figure and the exponent.

**Confusing storage with bandwidth.** Adaptive bitrate video stores six to ten renditions per title, which multiplies storage. Each viewer pulls one rendition, so egress is unchanged. The two numbers answer different questions and drive different parts of the design.

**Not knowing the unit conversions cold.** Pausing to work out seconds in a day, or whether 10^12 bytes is a terabyte, is the stall interviewers remember. These are the facts in the table above, and they are the ones to drill until they are reflex.

## Making the procedure automatic

The procedure is simple. The hard part is doing it quickly, out loud, under observation, with someone waiting. That is a fluency problem, and fluency comes from repetition spaced over days, not from reading a method once.

MetaStack's estimation deck is ten cards that drill exactly these procedures. Each card gives a scenario and asks for a number, and the key points on the back are the steps rather than the final figure. Did you state assumptions? Did you round to 10^5? Did you apply the peak factor? Did you say what the result implies? You tick the steps you actually said, the tick count sets the rating, and a card you fumbled returns tomorrow while a card you nailed waits weeks. The grading approach is described in [System design interview flashcards that actually stick](/blog/system-design-interview-flashcards), and the reason spacing beats one long session is covered in [Spaced repetition for system design: why it works](/blog/spaced-repetition-for-system-design). The scheduler that picks the order is FSRS, and [FSRS vs SM-2: which scheduler should you study with?](/blog/fsrs-vs-sm-2) explains why.

Ten cards take about ten minutes. Start the [estimation deck](/study/estimation) a few weeks before the interview and the stall goes away. When the interviewer asks how much storage, you will already be dividing by 10^5.
