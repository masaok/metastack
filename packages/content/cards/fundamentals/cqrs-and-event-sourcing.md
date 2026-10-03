---
id: cqrs-and-event-sourcing
deck: fundamentals
type: concept
difficulty: 3
tags: [architecture, messaging, consistency]
prompt: >
  Explain CQRS and event sourcing. What problems do they solve, how do they
  relate, and what makes them expensive?
keyPoints:
  - CQRS separates the write model from one or more read models optimised for specific queries
  - Event sourcing stores the sequence of domain events as the source of truth and derives current state by replaying them
  - Together, events from the write side feed projections that build the read models asynchronously
  - Benefits, full audit history, temporal queries, replay to build new views, and read models shaped exactly for each screen
  - Costs, eventual consistency between write and read, event schema evolution, snapshotting for long streams, and higher conceptual load
eli5:
  - Use one model for making changes and separate ones shaped for answering questions
  - Keep the full list of things that happened as the truth, and work out the current state by replaying it
  - Combined, each recorded happening flows out to update the question-answering copies a moment later
  - You gain a complete history, the ability to ask what things looked like in the past, and new views built by replaying
  - You pay with answers that lag slightly, old event formats to keep supporting, checkpoints for long histories, and more to learn
distractors:
  - CQRS requires event sourcing, the two cannot be used separately
  - With event sourcing, read models are updated in the same transaction as the write, so they are never stale
  - Events can be edited in place when a schema changes, since they are ordinary rows
followUps:
  - How do you handle a bug in a projection that has been running for a year?
  - When is plain CRUD with a few denormalised tables the better answer?
references:
  - title: Martin Fowler, Event sourcing
    url: https://martinfowler.com/eaaDev/EventSourcing.html
  - title: Martin Fowler, CQRS
    url: https://martinfowler.com/bliki/CQRS.html
updated: 2026-10-02
reviewed: true
---

**CQRS (Command Query Responsibility Segregation).** Most apps use one model for both updating and reading data. CQRS splits them: *commands* go to a write model that enforces business rules, and *queries* go to read models that are denormalised and shaped for each screen or API. The read models can live in different stores (Postgres for the write side, Elasticsearch for search, Redis for a leaderboard) and are updated from the write side's changes.

**Event sourcing.** Instead of storing current state (`balance = 80`), store every change as an immutable event (`Deposited 100`, `Withdrew 20`) in an append-only log per aggregate. Current state is computed by replaying events. The log is the truth; everything else is a cache.

**How they combine.** The write side appends events; projections subscribe to the event stream and update each read model. A new requirement ("show me how many users downgraded last quarter") becomes a new projection that replays history rather than a migration that guesses.

```mermaid
flowchart LR
  C[Command] --> W[Write model]
  W --> E[(Event store)]
  E --> P1[Projection: search]
  E --> P2[Projection: dashboard]
  P1 --> R1[(Read store)]
  P2 --> R2[(Read store)]
  Q[Query] --> R1
```

**Why bother**

- Complete audit trail by construction; regulators love it.
- Temporal queries ("what did this order look like at 3 pm?").
- Debugging by replaying production events into a test environment.
- Read models tuned per use case without compromising the write model.

**Why it is expensive**

- Read models lag the write side; the UI must tolerate not seeing its own write immediately.
- Events are forever, so schema changes require upcasters or versioned event types.
- Long-lived aggregates need snapshots or replay gets slow.
- Idempotent projections, replays, and rebuilding stores all need tooling.
- Teams need a shared understanding of the pattern or it decays into chaos.

Recommend it for domains where history *is* the product (ledgers, orders, collaboration) and steer away from it for simple CRUD.
