---
slug: distributed-transactions
title: Distributed transactions for interviews
description: Distributed transactions for interviews. Why one BEGIN is gone, how outbox, saga, and 2PC differ, and a charge that must match a ledger row.
primaryKeyword: distributed transactions
secondaryKeywords:
  - sagas
  - outbox
  - two phase commit
category: consensus-and-coordination
tags:
  - consistency
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the distributed transactions answer an interviewer wants. One `BEGIN` is gone the moment the write touches two systems that do not share a log. You then pick a tool. An outbox keeps a database write and a message in one local commit. A saga chains local commits and compensates. Two phase commit asks every participant to prepare and then commit. You pick from the invariant you are actually protecting, not from a brand. A charge that must match a ledger row is the worked case. The rest of this post is why the single transaction ended, what the three tools do, how you name the invariant, that charge, and what to say when the interviewer pushes.

## Why one BEGIN is gone

A local transaction is one engine and one commit record. Several rows change, or none of them change. A crash before the commit leaves the old state. A crash after the commit leaves the new state. Readers may wait. They do not see a half write.

That property stops at the process boundary. Your service writes a payment row in Postgres. It then calls a processor. It then writes a message to a broker. Those are three commits. A crash between them leaves a row without a charge, a charge without a row, or a message that does not match either. Retrying the handler can make the mismatch worse unless each step has a name.

This is what people mean by distributed transactions. They do not mean a bigger `BEGIN`. They mean a write that has to land in two places that cannot share a rollback. [SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) is the first fork. If the two records can live in one relational engine, put them there and use one transaction. The distributed problem starts when they cannot. A processor you do not own. A search index. A shard that does not share the same log. A queue that is a different piece of software.

Say the crash. Point at the line between the two calls. Say what a restart would see. If you cannot say that, you are not ready to pick a tool. The tool is how you make that crash boring.

Do not reach for a global transaction manager as the first sentence. That manager is two phase commit with a coordinator you now have to run. It is a valid last tool. It is a heavy first tool. Most interview designs need the local commit plus a retry that cannot double the effect.

## Outbox, saga, and 2PC as three tools

The outbox is a table in the same database as the state you just changed. In one transaction you update the order and insert a row that says "publish `order_placed`." A worker reads that table and publishes to the broker. If the process dies after the commit, the row is still there. The worker will publish. If the process dies before the commit, there is no order and no outbox row. The two facts stay together because they share a log.

The outbox does not make the consumer transactional with you. It makes the produce step recoverable. The consumer still needs an idempotency key, or a version, so a second publish does not apply twice. The outbox solves the lost message after a successful write. It does not solve two databases that must move money together.

A saga is a sequence of local transactions. Each step commits. Each step has a compensation if a later step fails. You reserve inventory. You charge the card. You mark the order placed. If the charge fails, you release the inventory. If the place fails after a successful charge, you refund. The system passes through states a user can see. Reserved. Charged. Placed. Compensating. You must name those states. You must make each step and each compensation safe to retry.

Two phase commit is prepare then commit. Participants vote. A yes holds resources. The coordinator writes a decision. Everyone applies that decision. There is no user-visible middle state if the protocol finishes. There is a blocked state if the coordinator vanishes at the wrong time. Use it when the middle state is unacceptable and the participants can speak the protocol.

| Tool | What commits together | What a crash leaves | When you pick it |
| --- | --- | --- | --- |
| Outbox | Your row and the "please publish" row | A message not yet sent, which a worker will send | A write you own plus an event you must not lose |
| Saga | Each local step, alone | A named middle state, then a compensation | You can explain the window and undo a step |
| 2PC | All participants, or none | Prepared locks until a decision record is found | The window itself is the bug |

These are tools, not layers you must stack. An order service can use an outbox to emit `order_placed` and a saga to talk to inventory and billing. It should not also wrap those same steps in two phase commit. Pick the tool that matches the pair of systems in front of you.

[Idempotency keys in system design](/blog/idempotency-keys) sit under all three. The outbox worker retries a publish. The saga retries a step. The coordinator retries a tell. Each retry needs a key so the second attempt is the same attempt.

## The invariant you are actually protecting

An invariant is a sentence that must stay true. "The number of reserved seats plus the number of free seats equals the room." "A captured charge has a ledger row of the same amount." "An order in `placed` has a reservation that was not released." Write that sentence before you name a tool.

If the sentence talks about two rows in one database, use one transaction. The invariant is the engine's job. If the sentence talks about a row you own and a message someone else must see, use an outbox. If the sentence talks about two services and the business already has a word for "reserved" and "cancelled," use a saga. If the sentence talks about two ledgers that must never disagree, even briefly, you are in two phase commit or in a redesign that puts both rows under one log.

Interviewers push on the sentence. They change the product rule. "Users can see a reserved seat for a minute." That is a saga. "Auditors cannot see a charge without a ledger row, ever." That is a tighter tool, or one database. "We can replay the event if the search index is behind." That is an outbox plus an idempotent consumer. The product rule is the pick. The brand of queue is not.

Write the bad state you refuse. A reserved seat with no payment attempt is acceptable for a hold period. A captured charge with no ledger row is not. A search document that lags the order by seconds is acceptable. A search document that invents an order is not. Those refusals are different. They do not all want the same protocol.

Keep the invariant small. "The system is consistent" is not an invariant. "These two rows match" is. The smaller sentence is the one you can test. It is also the one you can draw.

## A charge that must match a ledger row

A customer pays invoice 42. You must capture 50 with the processor. You must insert a ledger row for 50. You must mark the invoice paid. The processor is another company. The ledger is your database. The invoice is also your database.

The ledger row and the invoice can share one `BEGIN`. That part is local. The capture cannot. If you capture and then crash before the local commit, you have taken money and have no row. If you commit the row and then capture, you can crash before the capture and have a row for a charge that never happened. Both crashes are real.

A shape that works. Insert a payment intent in the same transaction as a hold on the invoice. The intent has an idempotency key. A worker reads intents that are `created` and calls the processor with that key. The processor charges once. The worker writes the processor id back onto the intent and, in one local transaction, posts the ledger row and marks the invoice paid. If the worker dies after the capture and before the local write, a retry uses the same key. The processor returns the first charge. The worker posts the row. The money and the row meet.

If the processor is down, the intent stays `created`. The invoice stays held. Nothing has been captured. A later worker tries again. If you must give up, a compensation releases the hold. That is a saga around a local outbox of intents. You did not need two phase commit with the processor. The processor will not be your participant.

When would 2PC appear. If the ledger were a second database you own that cannot take the invoice in the same log, and the auditor rule forbids a charge row in one without the other, you now have two participants. Prepare both. Commit both. Or move the ledger into the same database as the invoice and go back to one `BEGIN`. The second option is allowed. It is often the better design.

Walk the crash between capture and ledger. Then walk the retry. Then show the key on the processor call. If that walk is clean, you have answered the charge. If you wave at a transaction manager the processor does not run, you have not.

## What to pick when the interviewer pushes

They will add a store. They will add a retry. They will add a rule that the middle state is forbidden. Change only the part they changed.

They add a search index. Keep the order transaction. Add an outbox row. The indexer consumes with the order id as the key. Lag is allowed. Invention is not.

They add a second region that must keep taking orders. You are now in a multi-leader or a queued-replication talk. Distributed transactions across regions are a poor default. A saga that places locally and syncs later matches the new rule. Two phase commit across a ocean is a coordinator that blocks on a cable.

They forbid any window where inventory is reserved and unpaid. Then the reserve and the charge must be the same atomic outcome, or the reserve must not exist as a user-visible state. That is either one database, or two phase commit with a participant that can hold the reservation, or a product change that does not show reserved seats.

They ask why you will not just use 2PC for everything. Say blocking. Say the coordinator log. Say a participant you do not own. Say the timeout that cannot abort after a yes. Then offer the smaller tool that still protects the invariant they named.

What you say in the room.

1. One `BEGIN` ends when two logs appear.
2. Name the crash between the two calls.
3. Outbox for a write plus an event you own.
4. Saga for steps you can compensate and a window you can name.
5. Two phase commit when the window itself is the bug and both sides can prepare.
6. Put rows back under one engine when you can. That is a valid pick.

The charge and the ledger row is enough practice for this prompt. Start on the [fundamentals study page](/study/fundamentals).
