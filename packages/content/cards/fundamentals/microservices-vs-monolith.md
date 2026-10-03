---
id: microservices-vs-monolith
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [architecture, scalability, availability]
prompt: >
  When should a team split a monolith into services, and when should it not?
  What does the split cost that people underestimate?
keyPoints:
  - Services buy independent deploys, independent scaling and clear ownership boundaries for separate teams
  - They cost network calls where there were function calls, distributed transactions, versioned contracts and much harder debugging
  - Split along business capabilities with low coupling and their own data, not along technical layers
  - A modular monolith with enforced module boundaries gets most of the organisational benefit with none of the network cost
  - Signals to split, teams blocking each other on deploys, a component with very different scaling or runtime needs, or a hard isolation requirement
eli5:
  - Separate services let each team ship, grow and own its part without waiting for the others
  - The price is that a simple in-program call becomes a network call, and transactions, versions and debugging all get harder
  - Draw the lines around business jobs that each own their data, not around technical layers
  - One program with strict internal walls gives teams most of the same independence without the network between parts
  - Split when teams keep blocking each other's releases, or one part needs very different scaling, or something must be kept apart
distractors:
  - Split by technical layer, one service each for the UI, the business logic and the data access
  - Services make debugging easier because each one is small
  - Let services share one database schema so that joins stay simple
followUps:
  - How do you handle a workflow that used to be one database transaction and now spans three services?
  - What platform capabilities do you need before microservices stop being a liability?
references:
  - title: Martin Fowler, Monolith first
    url: https://martinfowler.com/bliki/MonolithFirst.html
  - title: Shopify engineering, Deconstructing the monolith
    url: https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity
updated: 2026-10-02
reviewed: true
---

The question is less about technology than about teams and change rates. Services are an organisational tool with a steep technical bill.

**What services buy**

- **Independent deployment.** Team A ships without waiting for team B's test suite.
- **Independent scaling and runtime.** The video transcoder runs on GPU boxes with its own autoscaling; the billing service runs in a locked-down network.
- **Ownership and blast radius.** A memory leak in recommendations does not take down checkout.
- **Technology freedom**, within reason.

**What they cost**

- Every in-process call that crossed the new boundary is now a network call with latency, partial failure, retries and timeouts.
- The transaction that updated three tables is now a saga with compensating actions.
- Contracts must be versioned; a schema change becomes a multi-step migration across deploys.
- Debugging needs distributed tracing, centralised logging and correlation ids just to see one request.
- Local development, testing and on-call all get harder. You need a platform team or a lot of tooling.

**Where to cut.** Along business capabilities (orders, payments, catalog) that change for different reasons and can own their data outright. Cutting along technical layers (a "database service", a "UI service") creates chatty, tightly coupled services that must deploy together, which is a distributed monolith.

**The middle path.** A modular monolith enforces module boundaries in code (packages with explicit public interfaces, lint rules, separate schemas) while deploying as one unit. Shopify runs one of the largest Rails apps this way. If a module later needs to scale separately, the boundary is already drawn.

**When to actually split.** Teams blocked on each other's releases; a component with wildly different scaling or hardware needs; a compliance or security isolation requirement; a part of the system that must be written in another runtime. Not: "it is what big companies do."
