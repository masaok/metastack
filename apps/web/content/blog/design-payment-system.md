---
slug: design-payment-system
title: Design payment system for the interview
description: Design payment system for the interview. The ledger, idempotent charges, capture and refund, and what the provider keeps.
primaryKeyword: design payment system
category: worked-designs
tags:
  - scalability
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

When you design payment system flows for the interview, start from a ledger that never overwrites a balance. Customers pay. Merchants get paid. Refunds come back. The volume is modest. The work is making money move once, and proving it later.

## The ledger is the source of truth

A mutable `balance` column is the wrong store. Two concurrent payments overwrite each other. A later audit cannot see the path the money took. You need a book, not a cell.

Use double-entry. Every movement is a transaction with at least two entries. Debits equal credits inside that transaction. Entries are append-only. A correction is a new entry, not an edit. Balances are sums over those entries. You may cache a sum with a version. You recompute the sum when you audit.

Name the accounts out loud. Customer receivables. Platform cash at the payment service provider. Merchant payable. Fees. Refunds. A customer payment debits cash at the provider and credits merchant payable and platform fees. The invariant is visible on the whiteboard. The numbers add.

Store amounts as integers in minor units. Never floats. A currency code sits on the entry. Mixed-currency sums are a bug you can point at.

The payments table is not the ledger. `payments` holds the state machine for one customer charge. `ledger_entries` holds the money. A payment id on an entry ties them. When someone asks where the money went, you query the book.

The [payment-system card](/cards/payment-system) sizes this as about one million orders a day. That is about 12 payments per second on average. A sale may push a few hundred per second. Payouts batch daily. Say those numbers, then say that correctness and auditability dominate. You are not sharding for throughput first.

A hot merchant does contend if you update a cached balance on every payment. Append the entries freely. Refresh the cached balance asynchronously, or with optimistic versioning. The book stays correct while the cache catches up.

[SQL versus NoSQL](/blog/sql-vs-nosql) is the neighbouring choice. A ledger wants transactions that make the debit-credit pair atomic. A relational store is the default you defend. The access pattern is append and sum, not a document per merchant.

## Idempotent charges and the provider boundary

Retries are inevitable. The client times out. The provider times out. Your process dies after the charge and before the response. Doing the work twice is a double charge.

The client sends an idempotency key on `POST /payments`. Store that key and a hash of the body before you call the provider. A repeat returns the stored outcome. A repeat with a different body is a conflict. The [idempotency keys](/blog/idempotency-keys) post is this step. Do not restate the race here. Use it.

Pass your own idempotency key to the provider as well. Their retries must be safe too. Two layers of keys are not decoration. You control your row. They control their charge.

The provider call is an unreliable external step. A success response can be lost. A timeout can hide a charge that already happened. Never treat the HTTP result as the last word. Reconcile against the provider's records on a schedule. Daily is the interval the card uses.

Webhooks finalise state you already marked pending. They arrive late. They arrive twice. They arrive out of order. Process each provider event id once. Apply a transition only if it is valid from the current state.

The unknown-outcome case is the one interviewers keep. The provider call times out. You do not know whether the charge succeeded. Do not retry blindly. That risks a second charge. Do not assume failure. That risks an unpaid order that you already took. Mark the payment `pending_unknown`. Resolve by querying the provider with your reference, or by waiting for the webhook. A sweep picks up anything still stuck.

Store the key first. Call the provider second. Write the ledger when you know the money moved. That order is the design.

## Capture, refund, and a double charge

Name the states. `created` to `pending` to `succeeded` or `failed`. From `succeeded` you can move to `partially_refunded` then `refunded`. Disputes are a branch. The payment service is the only writer. Every transition is validated and logged on a `payment_events` table.

Authorise and capture are two provider steps when the product holds a reservation. Checkout may authorise. Fulfilment captures. A cancel before capture releases the hold. Say whether your prompt needs that split. Many e-commerce prompts do. A simple charge can go straight to capture. Do not invent a split the interviewer did not ask for. Do name it if they mention delayed fulfilment.

An authorise that never captures still needs a ledger story. You have a hold, not a capture. The merchant is not yet owed. Expiry of the hold is a provider event. Your state returns to failed or cancelled. No payable entry appears until capture succeeds. That keeps a reserved amount from looking like cash you can pay out.

A refund is `POST /payments/{id}/refunds` with its own idempotency key and an amount. A retried refund must move the money once. The ledger records the refund as new entries. The payment state moves only after those entries exist.

A double charge is what you are designing away. It happens when a timeout is retried without a key, or when a key is stored after the provider call. It also happens when a webhook is applied twice without an event id. Walk one of those timelines if you are asked. The stored key before the provider call is the fix for the first two. The event id is the fix for the third.

Refund after payout is the other ugly path. The merchant already received a batch. The payable goes negative. Net it against future payouts, or claw back per the contract. Both are ledger entries. Do not delete the payout row. Do not overwrite the merchant balance.

A provider outage does not delete the order. Accept the order. Hold the payment as pending. Retry with the same key. Tell the customer the truth. A second provider, routed by BIN or region, is a failover you can mention. It is not required on the first pass.

## What you store, and what the provider keeps

The browser or the app sends card details to the provider. The provider returns a token. You store the token, the amount, the currency, the order id, the state, the provider reference, and the idempotency key. You do not store the card number. That is how you stay out of most of the PCI burden. Holding raw cards so you can retry without the provider is the distractor on the card. Do not pick it.

The provider keeps the card, the network response, and the settlement. You keep the payment row, the state log, and the ledger. Settlement reports from the provider are inputs to reconciliation, not a replacement for your book.

Reconciliation is a job. Compare your ledger to the provider's settlement report. Every mismatch is an alert and a ticket. The tool that closes the ticket posts a correcting entry. It does not edit the old one.

Payouts read merchant payable from the ledger. A scheduler batches them. It calls the provider to pay the merchant. That call also carries an idempotency key. The ledger then moves payable to paid. A failed payout stays payable and retries with the same key.

What you can answer from your store. Whether this order was charged. Whether it was refunded. What the merchant is owed. What fee you took. What you cannot answer without the provider. Whether a specific card network code was returned. Whether a later dispute has opened, until their webhook or report says so.

Keep the payment service as the owner of the state machine. A wallet or ledger service owns the book. The payout scheduler is a consumer of payment events. The reconciliation job reads the book and the provider. That split keeps a charge from becoming a spreadsheet.

Fees belong in the same book. A payment that credits merchant payable and platform fees in one transaction is how you avoid a later job that "takes the cut" by overwriting a balance. The fee is visible on day one. A later fee adjustment is another pair of entries.

## What the payment-system card already asks you to say

The [payment-system card](/cards/payment-system) asks you to design payments for an e-commerce platform that charges customers, pays merchants, and never loses or duplicates money.

Make every external and internal operation idempotent with client-supplied keys. Retries will happen.

Record money movement in a double-entry ledger that is append-only. Derive balances. Do not overwrite them.

Treat the provider call as an unreliable external step. Reconcile against the provider's records daily.

Use a state machine per payment with explicit pending and failed states. Asynchronous webhooks finalise.

Avoid storing card data. Tokenise through the provider.

The API on the card is `POST /payments` with an idempotency key, an order id, an amount, a currency, and a payment method token. `GET /payments/{id}` reads state. `POST /payments/{id}/refund` refunds. Webhooks arrive from the provider for async status.

The data model is `payments` with a state log, and `ledger_entries` grouped by a transaction id whose debits equal credits.

Deep dives. Keys stored before the provider call, and a key sent to the provider. The debit-credit invariant, with balances as sums or a versioned cache. Unknown outcomes resolved by query or webhook, never by a blind retry.

Failure modes. Queue payments as pending during a provider outage and retry with the same key. Duplicate webhooks handled by event id. Reconciliation that finds mismatches and gives you a way to post corrections. A refund that spans a payout already sent. A hot merchant balance that must not serialise every append.

Follow-ups on the card. What you do when the provider times out and you do not know whether the charge succeeded. How you handle a refund that spans a payout already sent to the merchant. Both answers are ledger entries plus a state you can defend.

Start on the [classic designs study page](/study/designs). Run the payment card until the key, the ledger, and the unknown-outcome path come out without a stall. Then [open the study page](/study) and drill the idempotency card in the same sitting.
