---
slug: capacity-planning
title: Capacity planning for system design interviews
description: Capacity planning for system design interviews. QPS, storage, machine count, peak versus average, and the headroom you can defend out loud.
primaryKeyword: capacity planning
category: observability-and-ops
tags:
  - estimation
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Capacity planning in a system design interview is the conversion of a product story into three numbers you can defend: a request rate, a storage size, and a machine count. It is the same arithmetic as back-of-the-envelope estimation, used as a plan rather than as a single worked example. The interviewer wants assumptions said out loud, a peak that is not the average, headroom that survives a lost zone, and a sentence about what happens when the read-to-write ratio moves. This post is that plan, tied to the estimation cards you should already be drilling.

## QPS, storage, and the machine count

Every capacity answer starts with traffic. Daily active users times requests per user per day, divided by seconds in a day, is average QPS. The [QPS from daily active users card](/cards/qps-from-daily-active-users) is that multiplication. 100 million users times 20 requests is 2 billion requests a day. Divide by 10^5, which is 86,400 rounded, and you have about 20,000 QPS. The exact figure with 86,400 is 23,148. Nobody in the room wants that many digits. They want 2 times 10^4 and the next sentence.

The next sentence is what 20,000 QPS means for a tier. A stateless web server handles 1,000 to 10,000 simple requests per second, so tens of application servers is normal. A relational primary handles a few thousand writes per second, so you must split reads from writes before you size the database. At 10 reads per write, average traffic is about 18,000 reads per second and 2,000 writes per second. The read number goes to caches and replicas. The write number goes to the primary and to the sharding story.

Storage is the second number. Objects per day times bytes per object times days of retention, then multiply by the replica factor. A short-text row is hundreds of bytes. A compressed photo is a few megabytes. A year of 100-byte messages at 2,000 writes per second is 2,000 times 100 times 86,400 times 365, which is about 6 times 10^12 bytes, about 6 TB before copies. Three-way replication takes that to about 18 TB. The design does not change. The bill does. Media dominates when it is present. One 2 MB photo per user per day at 100 million users is 200 PB per day. Find the term that dominates before you spend time on the others.

The machine count is the third number. Little's law says in-flight requests equal arrival rate times time in the system. The [server count from QPS card](/cards/server-count-from-qps) uses 60,000 peak QPS and 50 ms of service time: 3,000 in flight, 3,000 cores at 100 percent busy, then more cores once you refuse to run that hot. Divide by cores per machine. Add the copies that let you lose a zone. Say what the 50 ms is spent on. If 40 ms is a database wait, the machine count collapses and the database becomes the plan.

Three numbers, in that order, out loud. Rate. Bytes. Machines. Capacity planning is repeating those three for each tier that can run out.

## Peak versus average

Average QPS is the number you compute from a daily total. Peak QPS is the number you buy for. Traffic follows waking hours and events. A global product is flatter, so a peak of two to three times average is a defensible assumption. A single-country product, or a product that spikes around a match or a launch, needs three to five. The [QPS from daily active users card](/cards/qps-from-daily-active-users) plans for about 50,000 to 100,000 QPS on the 20,000 average example. Say which multiplier you picked and why.

Sizing for the average is the most common miss. A fleet that holds 20,000 QPS at 60 percent utilisation sits at 90 percent when the peak is 1.5 times average, and it sits above 100 percent when the peak is three times. Queueing delay grows roughly as 1 over 1 minus utilisation. The last ten percent of utilisation is where p99 falls apart. Peak is not a courtesy multiplier. It is the difference between a plan and an outage every evening.

Peak is also not one number. Reads peak when people open the app. Writes peak when people post. The cache is sized for the read peak. The primary is sized for the write peak. The queue is sized for the burst consumers cannot drain in time.

Write the two columns on the board.

| Quantity | Average | Peak you plan for |
| --- | --- | --- |
| Requests | 20,000 QPS | 60,000 QPS at 3 times |
| Writes, 10 to 1 reads | 2,000 QPS | 6,000 QPS |
| Reads | 18,000 QPS | 54,000 QPS |
| New objects per day | the daily total | the same total, arriving in fewer hours |

The last row is the trap. Daily storage does not triple because the peak is 3 times. The bytes still land over the day. Bandwidth and in-flight work do triple. Do not multiply retention storage by the peak factor. Do multiply the machines that serve the live path.

## Headroom you can defend

Headroom is unused capacity you can explain. "I left 40 percent free because I like round numbers" is not an explanation. Three reasons survive an interviewer.

Queueing. A core at 100 percent busy has no slack for a burst or a slow request. Target 50 to 70 percent utilisation on CPU-bound work so a 50 ms service time does not become a 200 ms wait. The server-count card takes 3,000 cores at full load to about 5,000 cores at 60 percent, then about 160 machines with 32 cores each. That 60 percent is the first headroom.

Failure. A zone will disappear. If you run three zones at 70 percent each, losing one puts the other two at more than 100 percent. You needed each zone to run at most about 50 percent so the remaining two hold the peak. 160 machines times 1.5 is about 240, or 80 per zone. That is the second headroom. N plus one on a single pool is the smaller version: one extra machine so a single host death does not saturate the rest.

Growth and uncertainty. The inputs were guesses, each maybe wrong by a factor of two. Extra headroom on a back-of-the-envelope plan is the admission you have not load-tested yet.

Headroom is per resource. CPU slack does not help a full disk or a miss storm on the primary. Name the resource you are leaving free. The [back-of-the-envelope estimation](/blog/back-of-the-envelope-estimation) post is the procedure. The number you build is the peak, plus the utilisation cap, plus the lost-zone copy. Do not stack every multiplier. A couple of hundred mid-size servers for 60,000 QPS of real work is reasonable. Ten thousand means the 50 ms was wrong. Five means the QPS was wrong.

## What the estimation cards already force you to compute

MetaStack's estimation deck is ten cards that already force the capacity plan's arithmetic. You do not need a second method. You need to treat the card outputs as a plan.

The [QPS from daily active users card](/cards/qps-from-daily-active-users) forces requests per day, average QPS, peak QPS, and the read/write split. It also forces the sanity check: tens of application servers, one primary if writes stay in the low thousands.

The [server count from QPS card](/cards/server-count-from-qps) forces in-flight work, cores, utilisation, machines, and zone headroom. It also forces the I/O question. If most of the 50 ms is a wait, you are not buying cores. You are buying concurrency limits and a downstream that can absorb the overlapped calls.

The URL shortener, photo, and video cards force storage and the media term that dominates. The cache-size card forces the hot set. The read-replica card forces the trap that every replica also applies every write, so you divide by leftover QPS.

Walk the cards in order. DAU to QPS. QPS to machines. Objects to bytes. Reads to cache and replicas. Writes to primary and shards. The [back-of-the-envelope estimation](/blog/back-of-the-envelope-estimation) post is the shared procedure. Grade yourself the way the cards grade you. A silent 23,148 is a fail. A spoken 2 times 10^4, so tens of servers and one primary, is a pass.

## A plan that changes when the read ratio moves

The read-to-write ratio is the knob that rewrites the plan without rewriting the product story. Hold writes at 2,000 per second and move the ratio.

At 1 to 1, a messaging-style path, you have 2,000 reads per second. One primary can often take both. A cache is still useful for hot conversations, but you are not building a read fleet. Capacity sits on the write path: commit latency, idempotency, and how fast the primary can append.

At 10 to 1 you have 20,000 reads per second. A handful of replicas, or a small cache in front of one primary, is enough. The [server count from QPS card](/cards/server-count-from-qps) still sizes the stateless tier from total QPS. The database plan is still one writer.

At 50 to 1 you have 100,000 reads per second. The replica card's arithmetic matters. A node that does 15,000 queries per second and must also apply 2,000 writes has about 13,000 left for reads. 100,000 divided by 13,000 is about 8 replicas at average, about 16 at a 2 times peak. Past about 10 to 15 replicas, fan-out and lag argue for a cache first. A 90 percent hit rate drops database reads to 10,000 per second and the replica count collapses.

At 100 to 1, a feed-style path, the cache is no longer optional. Peak QPS is almost all reads. Headroom on the cache and a stampede plan matter more than another replica. [Caching for system design interviews](/blog/caching) is the placement and invalidation half of that plan.

Write the fork. "Near 1, I size the primary. Tens or hundreds, I size a cache, then replicas from the miss rate." Ask for the ratio if the prompt omitted it. Growth is the same fork over time as old objects are viewed again. The plan is the rule that tells you which fleet to grow.

The [estimation deck](/study/estimation) is ten cards and about ten minutes. Run it until the peak factor and the read-ratio fork are reflex. Capacity planning in the loop is those cards, said as a plan, with headroom you can defend.
