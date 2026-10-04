---
slug: slo
title: SLO design for system design interviews
description: SLO design for system design interviews. How an SLI, an SLO, and an SLA differ, and how an error budget changes the week's work.
primaryKeyword: slo
secondaryKeywords:
  - sli
  - sla
category: observability-and-ops
tags:
  - observability
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

When you write an SLO in a system design interview, start with the user-facing event you will count. An SLO is a target on a measurement. It is not a list of gauges. The measurement is the SLI. The target is the SLO. The contract that pays out when you miss is the SLA. Keep those three in that order and the rest of the answer stays usable.

## SLI, SLO, and SLA in one pass

An SLI is good events divided by valid events. Each event is a success or a failure against a rule you named. The redirect finished under a latency bound. The feed returned a first page. Health checks are not valid. A cancelled client is not a failed redirect. Say what you exclude before you name the percentage.

An SLO is the number you promise on that ratio, including the window. `99.9% of valid redirects finish in under 100 ms over 28 days` is an SLO. A ratio without a window is a slogan.

An SLA is the same kind of number with a payout outside the team. Credits. A contract clause. Most interview designs do not need one. Offer it only for a paid API, and keep it weaker than the SLO so a miss on the internal bar does not write a cheque.

| Term | What it is | Who feels a miss |
| --- | --- | --- |
| SLI | A ratio of good events to valid events | Nobody yet. It is a number. |
| SLO | A target on that ratio over a window | The team. The week's work changes. |
| SLA | A target with an external payout | The customer, and whoever pays the credit. |

Pick one user journey. One success SLI and one latency SLI are enough. A freshness SLI is worth it on a feed. More than three and you are listing dashboards. CPU and queue depth are diagnostics. They explain a miss. They do not define one.

Say the three in one breath if the interviewer only gives you a minute. The SLI is what you measure. The SLO is the bar. The SLA is the bar you sold. Then pick the user event and stop talking about hosts.

## A latency SLO with a good and a bad window

Latency SLOs fail when the window is wrong. The percentage can be fine. The window makes it true or useless.

Take a redirect. The [URL shortener design](/blog/design-url-shortener) needs the lookup in the tens of milliseconds. A valid event is `GET /{code}` the service accepted. A good event is a 302 or a correct 404 under 100 ms. A 500 is bad. A slow 302 is bad. A fast 404 on an expired code is good.

Assume 100 valid redirects per second. A 28-day window holds `28 × 86,400 × 100` events, about 240 million. A 99.9% SLO allows about 240,000 bad events. A one-hour window at the same rate holds 360,000 events and allows 360 bad ones. A five-minute blip is 30,000 events. If they are all slow, the hour is gone. The 28-day window still has most of its budget.

That is a bad window and a good one. The hour pages on a deploy or a cache flush. A year hides a week of slow redirects. I pick a multi-week rolling window. Twenty-eight days is long enough that a short incident is a dent, and short enough that last month is not still padding you. A 7-day window swings on low volume. Say why if you pick it.

Write a good event as both successful and fast. One ratio. One budget. Do not put `p99 < 100 ms` on the board without the window. A percentile over one minute is a chart, not a promise. Prefer event ratios to wall-clock minutes when load is uneven. Ten minutes at noon is not ten minutes at 4 a.m. `99.9%` of a 30-day month is `0.001 × 30 × 24 × 60` minutes, 43.2 minutes of full downtime if you insist on time. Compute the SLO from two counters, valid and good, not from a feeling. Write the sentence a pager can test. `99.9% of valid redirects in the last 28 days were correct and finished in 100 ms.`

## Error budgets that change the week's work

An error budget is the room between a perfect ratio and the SLO. At 99.9% it is 0.1% of valid events. The budget exists so the team can ship. A 100% SLO has no budget. The only legal change is never.

Name two states. Budget left: deploy, run an experiment, loosen a cache TTL. Budget gone: freeze risky deploys and spend the week on the miss. A number that never changes the calendar is a slide. The [news feed design](/blog/design-news-feed) has the same shape. A ranking experiment that slows the first page is not free if the feed SLO is already red.

A burn rate makes the policy faster than waiting for the whole window. Spend a week of budget in a day and you act now, even if the 28-day number is still green. Spend it slowly and you keep shipping. A launch, a new region, or a cache cutover will miss some events. Say you are spending the budget if the prompt asks for that week.

A budget that is always full means the SLO is too loose. Tighten it. A budget that is always empty means the SLO is a wish. Raise the bound, cut a synchronous dependency, or admit the design cannot hold the number. Write the remainder on the board. `99.9% over 28 days, 0.1% left to spend.` That sentence is the ops half of the design. Without it you have a percentage and no policy.

## What not to put in an SLO

Do not put CPU, memory, disk, or queue depth in an SLO. A host at 90% CPU can still redirect in 20 ms. A host at 40% can time out on a lock. The user sees the redirect.

Do not put "the system is available" without an event. A primary that accepts writes while redirects fail is not available to a reader. Split journeys. A write SLO on create. A read SLO on redirect. Do not put an SLO on every hop and call that the product. The user hits the feed. The product SLI is the feed request. A ranker number is useful inside the team. It is not the interview answer unless you roll it up.

Do not put a target the design cannot emit. The redirect handler can increment `redirects_valid` and `redirects_good`. A hope cannot. Do not put 100%. You will miss. Disks fail. Deploys go out. A 100% SLO either lies or freezes the team. `99.9%` and `99.99%` are the usual interview numbers. Pick one and defend the budget. Tighter means more replicas, more caching, and less experimental work. Do not put an SLO on a cron start. A digest that lands by 9:00 is an SLI. The cron is not. Do not copy 99.9% onto a path that cannot hold it. Celebrity fanout to millions of lists will miss. Drop it from the SLI, loosen it, or keep it off the reader's path. The hybrid feed exists for that reason.

| Candidate | Keep as SLO? | Why |
| --- | --- | --- |
| Redirect success and latency | Yes | The user event. |
| Feed first page under 500 ms | Yes | The user event. |
| CPU under 70% | No | A cause, not an event. |
| Queue depth under 1,000 | No | A diagnostic. |
| 100% of deploys succeed | No | No budget. Wrong journey. |

CPU and queue depth belong on a dashboard. That is operations. It is not the SLO.

## A feed or a redirect that needs one

Put the SLO on the read the user waits for.

On the URL shortener the read is `GET /{code}`. The SLI is a correct, fast redirect. Creates can be slower. Click counts can lag. A create that fails is a different SLI if the prompt cares about writers. I would still lead with the redirect. The service is read-heavy. The [URL shortener post](/blog/design-url-shortener) already keeps analytics off that path. The SLO should too. A slow aggregator must not turn a good redirect into a bad event. Write it. `99.9% of valid redirects in 28 days return 302 or a correct 404 in under 100 ms.` Cache hits make that easy. Cache misses still have to hit a primary-key lookup. A viral code tests the cache and the CDN. It is not a reason to loosen the number. If you cannot hold 100 ms on a hot key, the design is wrong.

On the news feed the read is `GET /feed`. The [news feed post](/blog/design-news-feed) already asks for a first page in under 500 ms. That is the latency SLI. Fanout lag is a freshness SLI. Do not fold them. A fast page of slightly stale posts is a good load and a weaker freshness event. Celebrity accounts stay on fanout-on-read so the reader's SLO does not wait on a write storm. The hybrid split keeps the load-time SLI honest. A cache node can die. Fallback to the post store can still be a good event. A missing ranker can still be a good load if chronological fallback is success. Then a ranker outage burns a quality signal, not the load SLO.

One user event. One ratio. One window. One budget. Point at the counters. If you cannot, you do not have an SLO yet.

Close the answer on the board the same way every time. One user event. One ratio. One window. One budget. Then point at the path that emits the counters. If you cannot point at it, you do not have an SLO yet. The letters stay in order on every later design. SLI, then SLO, then SLA only if someone is paying.

Drill the designs that need this language on the [classic designs study page](/study/designs). Run the shortener until the redirect SLO comes out with the off-path counters. Run the feed until load time and freshness are two sentences. Start that loop from [/study](/study).
