---
slug: microservices
title: Microservices vs a monolith in interviews
description: Microservices vs a monolith in interviews. Independent deploys, the network cost, and when a modular monolith is the honest split.
primaryKeyword: microservices
secondaryKeywords:
  - monolith
  - service oriented architecture
category: architecture
tags:
  - architecture
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the microservices versus monolith answer an interviewer wants. Services buy independent deploys, independent scaling, and a blast radius you can name. They cost a network hop where there was a function call, a workflow where there was one transaction, and a platform you must already have. Split on a business capability that owns its data. Do not split on a technical layer. A modular monolith sits in the middle and is often the honest drawing. Service oriented architecture is the older name for the same cut when the units were bigger and the bus sat in the centre. That is the whole tradeoff. The rest of this post is the bill, the cut, the middle path, a checkout that used to be one commit, and the lines the card already grades.

## Independent deploys and the cost that comes with them

A monolith is one deployable. One pipeline. One process in production, or a set of identical replicas of that same process. Every change rides the same release. That is a constraint and a simplification.

Microservices turn that one deployable into several. Team A ships the catalog without waiting for team B's payment tests. The video worker scales on a different machine shape than billing. A leak in recommendations does not take checkout with it. Those are real gains. Say them as organisational facts, not as a fashion.

The cost starts the moment a call crosses the new boundary. A function call becomes an HTTP or RPC call. You now have latency, timeouts, retries, and a partial failure. The callee can be up and still return slowly. The caller can retry and double the effect unless the callee is idempotent. You own that now.

The transaction that updated three tables in one commit is gone. Each service owns its database. A write that must touch orders and payments is a workflow. You will hear saga, outbox, and "eventual consistency" in the same breath. None of those restore a single `BEGIN`. They sequence local commits and they describe what you do when step three fails.

Contracts must be versioned. A field you add is easy. A field you rename is a migration across deploys. You run two shapes until the last caller moves. A shared library that both sides import is how the cut quietly disappears. Prefer an explicit schema and a compatibility rule.

Debugging is now a trace. A request id has to follow the hop. Local development needs stubs or a composed stack. On-call needs a board that shows which service is failing.

You also bought a platform bill. Discovery, pipelines, dashboards, and a way to roll one unit without locking the rest. Without that platform, microservices are a distributed monolith plus toil. Name the platform as a prerequisite.

Independent scaling only matters when one part has a different load or runtime. A catalog read path that dwarfs billing is a reason. Five CRUD services that idle together are not.

## Split on a business capability, not a layer

The cut is the design. A bad cut is worse than no cut.

A business capability is a job the company already has a word for. Orders. Payments. Catalog. Notifications. Each job changes for a different reason. Each job can own its data outright. An order service writes the order tables. A payment service writes the payment tables. Nobody else writes those tables. Reads of another service's data go through an API or through an event you consumed into your own store.

A layer cut is the failure mode. A UI service, a business-logic service, and a database service look tidy on a slide. Every feature then changes all three. Every request hops twice before it does work. The three units still deploy together because a contract change in the data service blocks the logic service. That is a distributed monolith. You paid the network price and kept the coupling.

Ownership of data is the test. If two "services" share a schema and join across it, they are one service with two processes. The shared table is a secret meeting. A new column blocks both deploys. [SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) is about access patterns inside one store. Here the question is who is allowed to write the store at all. One writer. Copies for readers if they must not join live.

Low coupling is the other test. Ask what changes together. If a catalog edit always ships with a search-analyser change, the indexer should consume catalog events, not write product rows. If checkout always changes when you change the fee table, look at the workflow, not at another hop.

Service oriented architecture made the same cut with coarser grains and a bus in the middle. The lesson that survived is the capability boundary. The lesson that did not is a shared enterprise bus every team must ask before they ship. Prefer a dumb pipe. A queue or a log carries bytes. The meaning lives in the services.

Draw boxes with nouns the business uses, then the data each box owns. If you cannot name the data, you do not have a service yet.

## The modular monolith in the middle

A modular monolith is one deployable with hard walls inside it. Packages have public interfaces. Other packages may not import the internals. Lint or architecture tests fail a forbidden import. Schemas can be separate even though one database process hosts them. Modules talk in process, with function calls, inside one transaction when they still must.

You get most of the organisational gain. A team owns a module. A review can reject a leak across the wall. A later extract has a boundary already drawn. You avoid the network, the distributed transaction, and the platform bill until a module actually needs its own machine, its own runtime, or its own isolation.

This is the default you should defend for a small team, and when you do not yet have tracing, on-call ownership, and a pipeline per unit. Enforcing the wall now is cheaper than pretending six HTTP services are simpler.

Public write-ups of large modular monoliths exist. A well-known commerce platform has described keeping a large Rails application in this shape and extracting only when a module needed the extra isolation. You do not need their numbers. Start joined. Split a module that has earned the split.

The extract is mechanical if the wall was real. The module already owns its tables. You wrap the public interface in an RPC and replace the in-process call with a client. The first workflow that used to share a transaction is the first saga you will design. If that sentence scares you, keep the workflow in one process.

Interviewers will ask when you would finally split. Teams blocked on one release train. A component with a different scaling or hardware need. A compliance boundary that cannot share a process. A runtime you cannot host inside the main app. "Because big companies do it" is not a signal.

## A workflow that used to be one transaction

Checkout is the example. In the monolith, one request reserved inventory, created the order, and recorded a payment intent in a single commit. A crash rolled the three back. The customer never saw a reserved unit without an order.

Split along capabilities and those tables move. Catalog owns inventory. Orders owns the order. Payments owns the charge. One request now has three local commits. A crash between them leaves leftovers. That leftover is the design.

The honest tools are an outbox, a queue, and a saga. The order service writes the order and an outbox row in one local transaction. A publisher sends `OrderPlaced`. Payments charges. Catalog reserves. Each step is local. Each step has a compensating action if a later step fails. Say the leftover. Do not claim a distributed `BEGIN`.

[Message queues for system design interviews](/blog/message-queues-for-interviews) is the pipe. The queue is how payments learns about the order without sitting inside the order request. At-least-once delivery means the reserve can run twice. The reserve must be idempotent on the order id.

A sketch:

```text
Client
  -> Order service
      -> orders table + outbox (one commit)
      -> publisher
          -> queue
              -> Payments (charge, idempotent on order id)
              -> Catalog (reserve, idempotent on order id)
```

If the charge fails, the saga releases the reserve and marks the order failed. If the reserve fails after the charge, the saga refunds. The customer can see a short window where the order is pending. That window is the product change you took on when you split the commit.

Some workflows should not leave the monolith yet. If the leftover is unacceptable and the compensation is uglier than the deploy pain, keep the tables in one module and one transaction. Split the workers that can be async: email, search, thumbnails. Those were never in the checkout commit if you were careful.

## What the microservices-vs-monolith card already asks you to say

The [microservices versus monolith card](/cards/microservices-vs-monolith) grades a short list. Say it in this order.

Services buy independent deploys, independent scaling, and clear ownership. A leak in one unit should not take the others down. Technology freedom is a side effect, not the reason.

They cost network calls, distributed workflows, versioned contracts, and harder debugging. Local development and on-call get worse until a platform exists.

Split along business capabilities with low coupling and their own data. Do not split along technical layers. A UI service plus a logic service plus a database service is the distractor. A shared schema is the other distractor. Both keep the coupling and add a hop.

A modular monolith with enforced module boundaries gets most of the organisational benefit without the network. Extract when a module earns it.

The signals to split are specific. Teams blocking each other on deploys. A component with very different scaling or runtime needs. A hard isolation requirement. Not a blog post about what large companies run.

The follow-up on the card is the workflow that used to be one transaction. Name the leftover, the compensation, and the queue.

| Shape | Deploy | Call | Transaction | When it wins |
| --- | --- | --- | --- | --- |
| Monolith | One | In process | One commit | Small team, shared change rate |
| Modular monolith | One | In process, across a wall | One commit if the modules share the request | You want ownership without a network |
| Microservices | Many | Network | Local commits plus a saga | Different teams, loads, or isolation |

A sentence you can reuse:

"I start with a modular monolith. I cut modules on orders, payments, and catalog. I extract a service when that module blocks deploys or needs its own machines. Checkout that still must commit together stays in one module until we can name the leftover and the compensation."

Keep the order straight.

1. Name what independent deploys buy, then name the network bill.
2. Cut on a capability that owns its data.
3. Offer the modular monolith as the default.
4. Walk the workflow that used to be one transaction.
5. Recite the card's signals, not a company name.

Speak the capability first. Speak the leftover second. Drill the card until the cost comes out with the benefit. Start on the [fundamentals study page](/study/fundamentals).
