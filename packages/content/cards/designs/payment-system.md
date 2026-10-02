---
id: payment-system
deck: designs
type: design
difficulty: 3
tags: [consistency, idempotency, security]
prompt: >
  Design a payment system for an e-commerce platform that charges customers,
  pays out merchants, and never loses or duplicates money.
keyPoints:
  - Makes every external and internal operation idempotent with client-supplied keys, since retries are inevitable
  - Records money movement in a double-entry ledger that is append-only, with balances derived rather than overwritten
  - Treats the payment service provider (PSP) call as an unreliable external step and reconciles against the PSP's records daily
  - Uses a state machine per payment with explicit pending and failed states, and asynchronous webhooks to finalise
  - Avoids storing card data by tokenising through the PSP, keeping the platform out of most PCI scope
followUps:
  - What do you do when the PSP times out and you do not know whether the charge succeeded?
  - How do you handle a refund that spans a payout already sent to the merchant?
stages:
  - name: Requirements
    keyPoints:
      - Pay-in from customers via cards and wallets, pay-out to merchants, refunds, balances, audit trail
      - Exactly-once money movement, strong consistency on balances, PCI scope minimisation, reconciliation
  - name: Estimates
    keyPoints:
      - e.g. 1M orders/day → ~12 payments/s average, bursts of hundreds per second during sales
      - Volume is small, correctness and auditability dominate the design
  - name: API
    keyPoints:
      - POST /payments with idempotency key, order id, amount, currency, payment method token
      - GET /payments/{id}, POST /payments/{id}/refund, webhooks from the PSP for async status
  - name: Data model
    keyPoints:
      - payments(id, order_id, amount, currency, state, psp_reference, idempotency_key), state transitions logged
      - ledger_entries(id, account, debit, credit, currency, payment_id, created_at) double-entry, append only
  - name: High-level design
    keyPoints:
      - Payment service owns the state machine, calls the PSP, writes ledger entries, publishes events
      - Wallet/ledger service, payout scheduler, reconciliation job comparing ledger with PSP reports
  - name: Deep dives
    keyPoints:
      - Idempotency keys stored before calling the PSP, PSP also given an idempotency key
      - Double-entry ledger with invariant that debits equal credits per transaction, balances as sums or cached with versioning
      - Unknown outcomes resolved by querying the PSP by reference or waiting for the webhook, never by retrying blindly
  - name: Bottlenecks and failure
    keyPoints:
      - PSP outage, queue payments as pending and retry with the same key, communicate to the customer
      - Duplicate webhooks handled idempotently by event id
      - Reconciliation finds mismatches, with alerts and manual resolution tooling
references:
  - title: Stripe docs, Idempotent requests
    url: https://docs.stripe.com/api/idempotent_requests
  - title: Square developer blog, Books, an immutable double-entry accounting database service
    url: https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/
updated: 2026-10-02
reviewed: true
---

## Requirements

Customers pay for orders with cards or wallets; the platform holds funds and pays merchants out on a schedule; refunds and disputes flow back. Money must move exactly once, balances must be exactly right, every movement must be auditable, and card data should never touch the platform's servers. Throughput is modest; correctness is everything.

## Estimates

One million orders per day is ~12 payments per second average, perhaps a few hundred per second during a flash sale. Payouts are batched daily. This is a small system by volume, which is why the design spends its complexity on consistency and reconciliation rather than scale.

## API

```text
POST /payments
  Idempotency-Key: <uuid>
  { orderId, amount, currency, paymentMethodToken }
  -> 201 { paymentId, state: "pending" | "succeeded" | "failed" }

GET  /payments/{id}
POST /payments/{id}/refunds   Idempotency-Key  { amount }
POST /webhooks/psp            (signed events from the provider)
```

## Data model

`payments(id, order_id, amount_minor, currency, state, psp_reference, idempotency_key, created_at, updated_at)` with a `payment_events` log of every transition. A double-entry `ledger_entries(id, txn_id, account_id, debit_minor, credit_minor, currency, created_at)` table where each `txn_id` groups entries whose debits equal credits. Accounts include customer receivables, platform cash at PSP, merchant payable, fees and refunds. Amounts are integers in minor units; never floats.

## High-level design

```mermaid
flowchart LR
  CO[Checkout] --> PS[Payment service]
  PS --> IDK[(Idempotency keys)]
  PS --> PDB[(Payments + state log)]
  PS --> PSP[Payment provider]
  PSP -->|webhook| PS
  PS --> LED[Ledger service] --> LDB[(Double-entry ledger)]
  PS --> EV[(Payment events)]
  EV --> PO[Payout scheduler] --> PSP
  REC[Reconciliation job] --> LDB & PSP
```

## Deep dives

**Idempotency end to end.** Store the key and request hash *before* calling the PSP; on a repeat, return the stored outcome. Pass your own idempotency key to the PSP so their retries are safe too. Webhooks carry event ids; process each id once.

**The unknown-outcome problem.** The PSP call times out. Did the charge happen? Never retry blindly (that risks a double charge) and never assume failure (that risks an unpaid order). Mark the payment `pending_unknown`, then resolve by querying the PSP with your reference, or wait for the webhook, with a reconciliation sweep for anything stuck.

**Double-entry ledger.** Every money movement is a transaction with at least two entries whose debits equal credits: a customer payment debits "cash at PSP" and credits "merchant payable" and "platform fees". Entries are never updated or deleted; corrections are new entries. Balances are sums over entries (cached with a version for speed, recomputed for audits). This gives you an audit trail by construction and makes "where did the money go" a query.

**State machine.** `created → pending → succeeded | failed`, with `succeeded → partially_refunded → refunded` and `disputed` branches. The payment service is the only writer, and every transition is validated and logged.

**PCI scope.** The browser or app sends card details straight to the PSP, which returns a token. The platform only ever stores the token, keeping most of PCI DSS out of scope.

## Bottlenecks and failure modes

- **PSP outage:** accept the order, hold the payment as pending, retry with the same key, and tell the customer honestly. Consider a second PSP for failover, routed by BIN or region.
- **Duplicate webhooks and out-of-order events:** idempotent by event id; apply transitions only if valid from the current state.
- **Reconciliation gaps:** nightly compare your ledger against PSP settlement reports; every mismatch is an alert and a ticket with tooling to post correcting entries.
- **Refund after payout:** the merchant's payable goes negative; net it against future payouts or claw back per contract, all as ledger entries.
- **Hot merchant balance row:** many concurrent payments to one merchant contend on a cached balance; append entries freely and update the cached balance asynchronously or with optimistic versioning.
