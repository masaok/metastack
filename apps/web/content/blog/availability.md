---
slug: availability
title: Availability in system design interviews
description: Availability in system design interviews. What a nine hides, planned versus unplanned work, independent redundancy, and the user-visible error budget.
primaryKeyword: availability
category: consensus-and-coordination
tags:
  - availability
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Availability in system design interviews is the share of user-visible work that succeeds in a window you name. It is not a nine you recite from a poster, and it is not the CAP word that means every non-failed node returns a non-error. The interviewer wants a definition they can test, a place the system is allowed to fail, and a drawing that still works when one replica, one zone, or one shared dependency dies. This post walks the usual nine table as arithmetic, the planned-versus-unplanned split, redundancy that actually fails independently, the error budget a user can see, and how that budget becomes an SLO.

## What a nine means, and what it hides

A nine is a percentage of a window. Three nines means 99.9 percent of the events you chose to count succeeded. The complementary 0.1 percent is the downtime, or the failed requests, you are allowed. The conversion into hours is ordinary school arithmetic. A 365-day year has 8,760 hours. One tenth of one percent of that is 8.76 hours, which interview tables round to 8.77 hours. MetaStack does not treat those hours as a product target. They are the conversion everyone in the room already knows, so you can spend the time on what the percentage is measuring.

| Spoken target | Allowed failure in a 365-day year |
| --- | --- |
| 99 percent, two nines | about 3.65 days |
| 99.9 percent, three nines | about 8.77 hours |
| 99.99 percent, four nines | about 52.6 minutes |
| 99.999 percent, five nines | about 5.26 minutes |

The table hides the hard part. You have not said which events count. Server-side HTTP 200s are a different set from client-side successes. A handler that returns 200 with an empty body, or a spinner that never resolves, is up in the access log and down for the person who waited. A multi-step checkout that fails on the last call can still have most of its requests succeed. A regional outage that takes one country offline can leave a global success rate looking fine.

You also have not said which window. A year that includes one four-hour incident still prints 99.95 percent. The same four hours in a 30-day month is about 99.4 percent. Monthly windows punish a single bad day. Yearly windows hide it. Say the window before you say the nine.

Partial failure is the third hide. One of three replicas is dead. Reads that land on the other two succeed. Writes that need a majority still complete. The cluster is "up". The clients hashed onto the dead replica are not. If the load balancer has not removed that replica, the user-visible rate is worse than the process-up rate. [Load balancing for system design interviews](/blog/load-balancing-for-interviews) is the place health checks edit the pool. Availability talk without that edit is a claim about processes, not about users.

The last hide is the dependency you did not draw. API processes can be up while the primary is down, or while a cache miss storm drowns that primary. Count the path the user needs, not the tier you own.

## Planned work versus unplanned

Unplanned loss is a crash, a disk that fills, a network partition, a bad deploy that you did not mean to ship, a certificate that expired. Planned work is a deploy you scheduled, a schema migration, a failover drill, a certificate you rotated on purpose, a region you drained so the building could lose power. Both spend the same user-visible minutes. The difference is whether you chose the minute.

Some teams subtract planned work from the availability number. They call the remainder unplanned availability. That split is a reporting choice, not a law of the system. In the interview, say which number you are quoting. "Three nines including deploys" is a harder target than "three nines of unplanned incidents". An interviewer who hears only "we run at 99.9" will ask whether last Tuesday's migration counts. Have the sentence ready.

Planned work still has to be designed. A rolling deploy that takes one instance in twelve out of rotation spends almost no user-visible budget if the remaining eleven hold the load and health checks drop the one that is restarting. A stop-the-world migration that locks a hot table spends the budget in one shot. Blue-green or canary releases move traffic after the new binary has proved it can serve. Feature flags turn a risky path off without a rollback deploy. None of that is decoration. It is how planned work stays inside the same error budget as a crash.

Extra replicas help unplanned loss only when they fail independently. A failover drill that still shows a user-visible error will not do better in a real death.

The sentence to say out loud. "I count user-visible failures, planned and unplanned, in a 30-day window. Deploys are designed so they do not spend that budget. Incidents do, and that is what the error budget is for."

## Redundancy that actually fails independently

Redundancy is a second copy that can serve when the first copy cannot. The word fails when both copies share a fate. Two processes on one host die together when the host dies. Two hosts on one rack die together when the top-of-rack switch dies. Two availability zones in one region still share some control planes, some identity services, and sometimes the same primary database you forgot to draw. Independent failure is a claim about the blast radius, not about the replica count.

Start with the replica. A second read replica helps when the primary dies only if promotion is automated, if clients can find the new primary, and if the replica was not already so far behind that promotion loses acknowledged writes. A replica in the same zone does not help when the zone is the fault. Put the second copy in another zone if the SLO has to survive a zone. Put a third copy in another region only if the SLO has to survive a region, and only after you have said what a cross-region write costs.

Then name the shared dependency. Three stateless API servers behind a balancer look independent. They all call one primary. Losing the primary loses the product. The redundant tier was the wrong one. Three cache nodes with no replica of the hot key lose that key together if the data is not copied. Three queue brokers that all wait on one coordinator lose the queue when the coordinator loses its disk.

[The CAP theorem explained for interviews](/blog/cap-theorem-explained) uses availability in a stricter sense. During a partition, a non-failed node either answers with a value that may be stale, or it refuses. That is not the uptime nine. A system that fails over to a healthy majority in seconds can have excellent uptime and still have returned errors on the cut-off side. Say which meaning you are using. "I am talking about user-visible uptime, not CAP availability" is a sentence that saves the rest of the answer.

Health checks are how redundancy becomes user-visible. A dead replica left in the pool is worse than no replica. The probe has to exercise the dependency the user needs. A `/health` that returns 200 while the database is down is a lie. [Load balancing for system design interviews](/blog/load-balancing-for-interviews) covers the pair of balancers so the balancer itself is not the single copy. Three zones that can lose one and stay under your utilisation target is N plus one for a zone. Two copies that still need the same writer is not.

## The user-visible error budget

An error budget is the failure the SLO still allows. If the availability target is 99.9 percent of valid requests in 30 days, the budget is 0.1 percent of those requests. In a month with 432 million valid requests, that is 432,000 failures. In time terms, 0.1 percent of 30 times 24 hours is 43.2 minutes if you measure "the product is down for everyone". Request-weighted budgets and time-weighted budgets disagree when a two-minute blip at peak burns more user journeys than a two-hour blip at 04:00. Say which one you are using.

User-visible is the filter. A worker that retries a thumbnail and succeeds before anyone opens the photo did not spend the budget. A send-message call that returned 503 did. An internal queue depth alert is useful operations data. It is not the budget. The budget is the event the product promised: the feed loaded, the message landed, the charge captured, the short link redirected.

What counts as valid matters as much as what counts as success. A `400` from a malformed client is usually excluded. A `401` from a missing token is usually excluded. A `500`, a timeout, and a `429` you did not intend as a product limit are usually included. A `429` that is the rate limiter doing its job is a product response, not an availability miss, if the client was over quota. Draw that line once and keep it.

Who spends the budget is a staffing question. If deploys already used most of the month, you stop shipping risk and you work on reliability. The number is a governor, not a trophy.

Partial degradation spends the budget in slices. If the SLO is "the feed loads", a missing ranker does not spend it. If the SLO is "the ranked feed loads", it does. Name the promise before you name the fallback.

## Tying availability to an SLO

An SLO is the target you hold yourself to. An SLI is the measurement. An SLA is a contract, usually looser, and you only need it if the prompt is a billed API.

The availability SLI is successful events over valid events, in the window. You define both sides. A chat send might require an ack plus a later read-your-writes. A CDN object might also require a latency you SLO. A feed read and a post write should not share one percentage.

Tie the SLO to a number you can defend with capacity, not to a nine that sounds senior. Three nines on a single-primary database with a human failover is hope. Three nines on a stateless tier with three zones, automated health checks, and a replica set that can lose one member is a design. Four nines usually forces multi-region, and multi-region forces a consistency sentence. If you are not willing to say what a stale read looks like, do not write four nines on the board.

Write the SLO next to the box it applies to. "API availability 99.9 percent of valid requests per 30 days, excluding client 4xx." Then write the dependency SLOs that have to be better, or the budget math does not close. If the database offers 99.9 and the API offers 99.9, the product cannot offer 99.9 unless those failures never coincide. Independent failures multiply. Two 99.9 components in series are about 99.8 if they fail independently. That is the sentence that earns the point.

The [fundamentals deck](/study/fundamentals) is where this becomes automatic. Timeouts, retries, heartbeats, and load-balancing health checks are the cards that keep a nine from being a wish. Start there a few weeks before the loop. When the interviewer asks how available the design is, you will already be defining the event, the window, and the copy that fails independently.
