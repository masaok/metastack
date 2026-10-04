---
slug: sagas
title: Sagas for distributed transactions, explained
description: Sagas for distributed transactions, explained. Choreography versus orchestration, compensating steps, and why a saga is not two-phase commit.
primaryKeyword: sagas
category: architecture
tags:
  - architecture
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the sagas answer an interviewer wants. A saga finishes a workflow that spans services when one database transaction no longer can. Each step commits locally. If a later step fails, earlier steps run a compensating action. Choreography lets each service react to events. Orchestration puts a coordinator in charge of the sequence. A saga is not a two-phase commit. It does not hold locks across services, and it does not give you atomicity. It gives you a story you can still tell when step three dies. That is the whole tool. The rest of this post is the two styles, the compensations that actually run, the contrast with two-phase commit, a payment-plus-inventory walk, and a failure you can draw.

## Choreography versus orchestration

Both styles implement the same idea. A sequence of local transactions. A path backward when the sequence cannot finish. They differ in who knows the sequence.

Choreography is implicit. The order service writes the order and publishes `OrderPlaced`. Payments hears that, charges, and publishes `PaymentCaptured` or `PaymentFailed`. Inventory hears the capture and reserves, or hears the failure and does nothing. Inventory publishes `StockReserved` or `StockRejected`. The order service hears the end and marks the order. No central brain has the list. Each service knows its neighbour events.

Orchestration is explicit. A coordinator, often in the order service or in a workflow engine, sends a command to payments. It waits for a reply or a timeout. It then sends a command to inventory. It records which step it is on. On failure it sends the compensating commands in reverse. The other services do not need to know who comes next.

| | Choreography | Orchestration |
| --- | --- | --- |
| Who knows the path | Each subscriber | The coordinator |
| Coupling | Event names | Command names the coordinator owns |
| Visibility | A trace across topics | One workflow record |
| Failure | Easy to miss a subscriber | Easy to see a stuck step |
| Fits | A few steps, stable path | Longer paths, branching, timeouts |

Choreography looks simple on a happy path with two hops. It hides the workflow in subscriptions. A new step means a new subscriber and a new event you hope everyone understood. Cycles appear when A reacts to C that reacted to A. Timeouts live in every service.

Orchestration looks heavier. You drew an extra box. That box is where you put retries, deadlines, and the current step. Interviewers can ask "where is the saga state." You point at a `sagas` table: id, type, current step, payload, status. That is a better answer than "the events know."

Pick choreography when the path is short and the consumers are independent. Pick orchestration when you have four steps, a branch, or a deadline you must enforce in one place. Mixed drawings exist. The coordinator can publish an event at the end so search and email still subscribe without joining the saga.

Do not choreograph a compensation you cannot see. If `PaymentFailed` must release stock and cancel the order and notify the user, an orchestrator that still holds the step list will do that more reliably than three services that each "should" hear the event.

## Compensating steps that actually run

A compensation is a real action with a real leftover. It is not a rollback of a shared transaction. The first step already committed. The world changed. You emit a second change that makes the business outcome acceptable.

Reserve then release. Charge then refund. Create an order then mark it cancelled. Send a receipt then send a correction. Each pair is a product decision. A refund is not the inverse of a charge in the physics sense. Fees may remain. A released unit may have been sold to someone else if you did not hold it.

Write the forward step so the compensation can find it. The charge stores a provider reference and an idempotency key. The refund uses that reference. The reserve stores an order id. The release deletes or expires that id. A compensation that has to search "maybe we charged this customer something" is not a design.

Compensations must be idempotent. The coordinator will retry them. The event will replay. [Idempotency keys in system design](/blog/idempotency-keys) is the neighbouring mechanism. The saga step id is a good key. A second `ReleaseStock` for `order_1001` is a no-op if the first already released.

They must also be possible after a crash in the middle of compensating. Store the saga state before you send the command. Mark the step `compensate_inventory` before you call inventory. If you die, the recovery loop reads the row and sends again. If you call first and write later, you can forget that stock was released and release again, or worse, forget and try to reserve.

Not every step has a compensation. An email you already sent cannot be unsent. You send a follow-up. A notification you already pushed is the same. Put those steps last, after the points of no return you can still reverse. Or accept a "we charged you and then failed, here is a refund plus an email" outcome and write it into the product.

Semantic lock is the leftover you should name. You reserved a unit. No one else can buy it while the saga is in flight. That is a hold, not a sale. Expiry on the hold is part of the design. A stuck saga that never compensates is a leak of inventory. A timeout that releases the hold and marks the saga failed is the escape.

## What a saga is not (a two-phase commit)

Two-phase commit tries to keep a single atomic outcome across participants. A coordinator asks every participant to prepare. Each participant votes yes and holds locks and a prepared state. If all vote yes, the coordinator commits. If any votes no, everyone aborts. While prepared, a participant cannot forget. If the coordinator dies after prepare and before commit, those locks stay. That blocking behaviour is why people avoid 2PC across services and across a network they do not own.

A saga does not prepare. A saga commits. Payments captures. That capture is done. Inventory then fails. The saga refunds. For a window, money had moved and stock had not. Readers can see that window. The business decides the window is acceptable. The algorithm does not hide it.

Do not tell the interviewer a saga "is distributed 2PC." It is the opposite trade. You give up isolation and atomicity. You gain progress without cross-service locks. You gain a path that still works when a participant is an HTTP API you cannot put in a prepare phase, such as a card network.

| | Two-phase commit | Saga |
| --- | --- | --- |
| During the work | Locks held, prepared | Local commits done |
| On failure | Abort, no leftover | Compensate, leftover then a fix |
| If the coordinator dies | Participants may block | Recovery retries the recorded step |
| Isolation | One outcome | Intermediate states exist |
| Fits | One database, or a rare cross-shard write you control | Services and provider APIs |

You can still mention 2PC as the thing you are not doing. A cross-shard write inside one database system may use it. A checkout that calls Stripe cannot. The provider will not join your prepare.

Idempotency does not turn a saga into 2PC either. It only makes retries safe. The customer can still see `pending` then `failed` then a refund on a statement. Say that visibility. It is the honest cost.

## A payment-plus-inventory example

Walk one checkout. Do not invent a merchant name. Use `order_1001`, SKU `mug-blue`, quantity 2.

The order service writes `order_1001` as `pending` and starts an orchestration. Step 1 asks payments to charge. Payments uses an idempotency key derived from `order_1001`. The provider captures. Payments writes its row and replies `captured`.

Step 2 asks inventory to reserve `mug-blue` x2 for `order_1001`. Inventory decrements a reserved count, or writes a reservation row, and replies `reserved`. The order moves to `placed`.

Happy path, two local commits after the order insert. The customer sees placed. Email is not in the saga. A queue carries `OrderPlaced` to a mail worker. [Message queues for system design interviews](/blog/message-queues-for-interviews) is that hop. If mail fails, the order is still placed.

Now fail step 2. Inventory has 1 unit. The reserve rejects. The orchestrator writes `compensate_payment` and asks payments to refund the capture, same order id, new idempotency key for the refund. Payments refunds. The order moves to `failed`. The customer sees a failed order. The statement may show a capture and a refund. You say that.

Now fail after a timeout on step 2. Inventory never replied. You do not know whether the reserve landed. You do not retry a new reserve blindly if a first reserve might exist. You query inventory by `order_1001`, or you send the same reserve command with the same key. Inventory returns the stored outcome. Then you continue or you compensate. Unknown outcomes are the same shape as a payment timeout.

```text
order_1001 pending
  -> payments.charge(order_1001)      -- captured
  -> inventory.reserve(order_1001)    -- rejected
  -> payments.refund(order_1001)      -- refunded
order_1001 failed
```

A choreography version publishes `OrderPlaced`, then `PaymentCaptured`, then `StockRejected`, then `PaymentRefunded`, then `OrderFailed`. Same leftovers. Harder to see the current step. Either drawing is acceptable if you name the leftover.

Do not put the provider call and the inventory write in one local transaction. They do not share a database. That wish is how people reach for 2PC and then discover the provider cannot vote.

## Failure you can still explain on a whiteboard

Pick one crash and stay there. The coordinator dies after payments captured and before it wrote `step = reserve`. On restart the saga row still says `step = charge`. The recovery loop sends the charge again. Payments sees the idempotency key and returns the captured result. The coordinator then moves to reserve. That is why the key exists, and why you write the next step only after a durable reply.

Pick the other crash. The coordinator wrote `step = compensate_inventory` and died before the release landed. Recovery sends release again. Inventory is idempotent on `order_1001`. Stock returns to free. A third crash during refund is the same story with the refund key.

Draw the states. Interviewers can follow boxes.

```text
pending -> charging -> reserving -> placed
                \            \
                 \            -> compensating_payment -> failed
                  -> failed (charge declined)
```

Every arrow is a local commit plus a message. Every box is a value in the saga row. A timeout is an arrow you own. From `reserving`, a deadline moves you to `compensating_payment`. You do not wait forever for a worker that will not return.

Partial failure is visible. Ops can see `reserving` for ten minutes. That is better than three services that each think they are fine. Page on stuck sagas. A growing count of `reserving` is an inventory or network outage.

What you cannot explain away: a user who saw `pending` and refreshed into `failed`, a statement with two lines, a unit that was held for five minutes and then freed. Those are the product. If they are unacceptable, keep the tables in one module and one transaction. The saga is for the split you already chose.

Keep the order straight.

1. Choose choreography or orchestration and say who holds the path.
2. Name each compensation as a real action with a key.
3. Contrast with two-phase commit. No prepare. No cross-service locks.
4. Walk charge then reserve, and the refund on reject.
5. Crash the coordinator once and recover from the saga row.

You can say "saga" and still hope both writes commit together. Speak the leftover first. Speak the compensation second.

Start on the [fundamentals study page](/study/fundamentals).
