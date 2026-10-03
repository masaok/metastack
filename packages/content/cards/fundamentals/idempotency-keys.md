---
id: idempotency-keys
deck: fundamentals
type: concept
difficulty: 2
tags: [idempotency, api, consistency]
prompt: >
  Design idempotency for a "create payment" endpoint so that client retries
  never double-charge. Walk through the request flow and the edge cases.
keyPoints:
  - Client generates a unique idempotency key per logical operation and sends it on every retry
  - Server atomically records the key before doing the work, so a concurrent duplicate sees it and waits or returns the in-progress result
  - Store the final response against the key and replay it for later retries with the same key
  - Reject a reused key with a different request body, it indicates a client bug
  - Keys expire after a window (hours to days) and are scoped per account to avoid collisions
eli5:
  - The client makes up a unique ticket number for each action and sends the same number every time it retries
  - The server writes the ticket number down before doing anything, so a twin request arriving at the same moment sees the work is under way
  - The server keeps the answer next to the ticket and hands back the same answer on any later retry
  - If the same ticket arrives with different details, refuse it, because the client has a bug
  - Tickets are thrown away after a while and belong to one account, so two customers never clash
followUps:
  - What should happen if the first request is still in flight when the retry arrives?
  - How does this interact with downstream calls to a bank that is itself not idempotent?
references:
  - title: Stripe docs, Idempotent requests
    url: https://docs.stripe.com/api/idempotent_requests
  - title: Brandur Leach, Implementing Stripe-like idempotency keys in Postgres
    url: https://brandur.org/idempotency-keys
updated: 2026-10-02
reviewed: true
---

A client calls `POST /payments`, the network drops the response, and the client retries. Without protection the customer is charged twice. Idempotency keys make the retry safe.

**Flow**

1. The client generates a UUID for the *intent* ("pay this invoice") and sends it as `Idempotency-Key`. Every retry of that intent reuses the same key.
2. The server does an atomic insert into an `idempotency_keys` table keyed by `(account_id, key)` with status `in_progress` and a hash of the request body.
   - Insert succeeds: this is the first attempt; proceed.
   - Insert conflicts and the stored body hash differs: return `422`, the client reused a key for a different request.
   - Insert conflicts and status is `completed`: return the stored response (same status code and body).
   - Insert conflicts and status is `in_progress`: return `409` with a `Retry-After`, or block briefly on the row lock and then return the completed result.
3. Perform the work. If it involves side effects outside your database (calling a card network), pass your own idempotency key downstream so *their* retries are safe too.
4. Store the response against the key and mark it `completed`, ideally in the same transaction as the business write so they cannot diverge.

```mermaid
sequenceDiagram
  participant C as Client
  participant S as Payments API
  participant D as DB
  C->>S: POST /payments (key K)
  S->>D: INSERT key K in_progress
  S->>D: create payment
  S->>D: mark K completed + response
  S--xC: response lost
  C->>S: POST /payments (key K) retry
  S->>D: SELECT K -> completed
  S-->>C: replay stored response
```

**Edge cases**

- *Crash between step 3 and 4:* the key stays `in_progress`. Use a lease timeout so a retry after the lease can re-run from a checkpoint, or make the business write and key update one transaction.
- *Expiry:* keep keys for 24 hours or more; after that a retry is treated as new, which is acceptable because clients do not retry for days.
- *Scope:* namespace keys by account so two tenants can never collide.

State the atomic insert, the stored response, the mismatch check, and the TTL.
