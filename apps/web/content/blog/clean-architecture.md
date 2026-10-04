---
slug: clean-architecture
title: Clean architecture for system design interviews
description: Clean architecture for system design interviews. Dependencies that point inward, a payment cut this way, and when a simpler package layout is enough.
primaryKeyword: clean architecture
category: architecture
tags:
  - architecture
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the clean architecture answer an interviewer wants. Business rules sit in the middle. Adapters sit on the edge. Arrows point inward. A payment service that follows that cut can swap the HTTP layer or the card processor without rewriting the charge. A URL shortener that does not follow it still ships. The rest of this post is the dependency rule, the three kinds of code, why the full diagram rarely helps in the room, a payment cut this way, and when a simpler layout is enough.

## Dependencies that point inward

The rule is about compile-time and import-time arrows, not about folders. Inner code does not import outer code. Outer code imports inner code. A use case does not import Express, Next, SQLAlchemy, or a Stripe SDK. An HTTP handler may import the use case. A Stripe adapter may import the port the use case defined.

Inward means toward policy. The domain decides what a charge is. The use case decides the steps of a charge. The adapter decides how bytes move. If the domain imports the adapter, a change to Stripe's types ripples into the rule that says a refund cannot exceed the capture. That ripple is the thing the rule prevents.

Draw one arrow and say it. "The handler calls `ChargeCard`. `ChargeCard` calls a `Ledger` port and a `Processor` port. The Postgres ledger and the Stripe processor implement those ports. Nothing in the charge rule names a table or a vendor."

Frameworks want the opposite. A controller that inherits a request type, or a model that inherits an ORM row, points the dependency outward. You can still use those tools. You keep them in the adapter. The inner types are plain records and functions.

The same rule applies across services. A payment service that imports a shipping client's generated stubs in its domain has pointed the arrow at another team. A port named `NotifyFulfillment` keeps the charge rule stable when shipping changes its proto.

Testability is the practical check. If you can run the charge use case with an in-memory ledger and a fake processor, the arrows point inward. If the first test boots a web server and a database, the arrows already leaked.

Do not claim the rule makes the system correct. It makes a change land in one place. Consistency, idempotency, and the ledger still have to be designed. [SQL versus NoSQL](/blog/sql-vs-nosql) is still the store choice. Clean architecture does not pick the store. It keeps the store on the outside of the rule.

## Domain, use case, and adapter

Three kinds of code are enough for an interview. You do not need five concentric rings.

The domain is the language of the business. A `Payment` has an id, an amount in minor units, a currency, and a state. A `Refund` cannot exceed the captured amount. A ledger entry has two sides that balance. These rules do not know HTTP. They do not know SQL. They do not know Stripe. They are functions and types you could explain on a whiteboard without a framework.

The use case is one action the product offers. `ChargeCard` takes an account, an amount, a method token, and an idempotency key. It loads or creates the payment. It writes the intent. It calls the processor. It appends ledger entries. It returns a result. It talks to the world through ports. A port is an interface the use case owns. `Ledger.append`, `Processor.charge`, `Payments.save`. The use case does not construct a SQL client.

The adapter implements a port, or translates an incoming request. An HTTP adapter parses the body, calls `ChargeCard`, and writes the status code. A Stripe adapter turns `Processor.charge` into their API. A Postgres adapter turns `Ledger.append` into a transaction. Adapters may import vendors. That is their job.

A table keeps the cut visible.

| Kind | What it knows | What it must not know |
| --- | --- | --- |
| Domain | Payments, states, invariants | HTTP, SQL, vendors |
| Use case | The steps of one action, the ports it needs | Which library implements a port |
| Adapter | Requests, tables, SDKs | Other adapters' internals |

A fourth kind appears in larger codebases: a presenter or a view model. In an interview you can fold that into the HTTP adapter. The handler maps the use case result to JSON. That is enough.

Names vary. Hexagonal architecture says ports and adapters. Onion architecture says the same inward arrows. Clean architecture is the name most interviewers recognise. Do not spend the clock comparing the diagrams. Say the arrow. Name the three kinds. Move on.

Shared kernels are where teams cheat. A `models` package imported by HTTP, by SQL, and by the domain becomes a junk drawer. If a type is a domain rule, it lives with the domain. If a type is a row, it lives with the adapter. Duplicating a few fields is cheaper than one package that everyone is afraid to touch.

## Why interviewers rarely want the full diagram

The concentric circles are a teaching picture. They are a poor whiteboard. You will not be graded on whether the use case ring is inside the interface-adapters ring. You will be graded on whether a charge can be explained without naming Express, and whether a store change stays on the edge.

Interviewers ask you to design a system, not to refactor a repo. They want the API, the store, the consistency, and the failure. Clean architecture is a cut you apply to one service when the rules are dense. It is not a box you draw around every microservice.

A candidate who starts with entities, use cases, presenters, and gateways has used four minutes and has not yet said where the money lives. A candidate who says "the charge rule sits behind a port; Stripe and the ledger are adapters; the handler is thin" has spent twenty seconds and can go back to idempotency.

The full diagram also pretends every service needs the same depth. [Design URL shortener for the interview](/blog/design-url-shortener) is a key-value lookup and a unique code. The domain is a code and a target URL. A use case package around that lookup is costume jewelry. The interviewer will ask you to spend the time on minting and hot keys.

Use the language when the prompt is rich. Payments, bookings, and inventory have rules that outlive the HTTP stack. Use a simpler sentence when the prompt is a cache, a feed fanout, or a shortener. "Handlers talk to a store. I will extract a use case if a second adapter appears." That is an adult answer.

Do not correct the interviewer if they say "service layer" or "hexagonal." Those names point at the same cut. Translate and continue.

A diagram that helps is a small one. Three boxes. Domain and use case in the middle. HTTP on one side. Ledger and processor on the other. Arrows from the sides inward. No rings. No package tree.

## A payment service cut this way

Walk a charge. The client sends `POST /payments` with an amount, a currency, a method token, and an idempotency key. That is the adapter talking HTTP.

The handler maps the body to a `ChargeCard` command. It does not open a Stripe client. It does not write SQL.

`ChargeCard` is the use case. It asks the payment store if this key already finished. A completed key returns the stored result. An in-flight key waits or conflicts. A new key proceeds. The use case asks the processor port to charge. It asks the ledger port to append the double-entry pair. It saves the payment in a terminal state. Those three ports are types the use case owns.

The Stripe adapter implements the processor port. Timeouts and retries live here. Card data never enters the domain. The token is a string the processor understands.

The Postgres adapter implements the ledger and the payment store. One transaction writes the idempotency row, the payment, and the ledger entries. That transaction is an adapter detail that serves a domain need: the debit and the credit commit together. The use case asked for one append. The adapter chose a transaction.

A refund is a second use case. It loads the payment. The domain rejects a refund larger than the capture. The use case calls the processor and the ledger again. HTTP does not know that rule. Stripe does not know that rule. The rule lives in the middle.

Webhooks are an inbound adapter. Stripe calls `POST /webhooks/stripe`. The adapter verifies the signature, turns the event into `FinalizePayment`, and calls that use case. The domain still does not import Stripe's event type.

Tests follow the cut. Domain tests cover the refund limit with no I/O. Use case tests cover the idempotent retry with fakes. Adapter tests cover SQL and HTTP against a contract. You do not need a running stack to prove the refund rule.

This is also where people overbuild. A `PaymentEntity` with forty methods, a repository hierarchy, and a presenter per status code is not required. One command, three ports, two adapters, and a handler are enough to show the arrow.

## When a simpler package layout is enough

Most interview services do not earn the full cut. A shortener is a write of `code -> url` and a read. A feed list is a query. A cache is a get and a set. Putting those behind entities and use cases wastes the clock.

A simple layout is enough when the rules are thin and the adapters are few.

```
handlers/   HTTP and the JSON mapping
store/      SQL or the key-value client
domain/     the few types you still want names for
```

The handler calls the store. The domain, if it exists, is a function like `assertCodeFormat`. When a second adapter appears, a processor, a second store, or a consumer that must run the same rule, you extract a use case and a port. You do not extract them on the first box.

The signal that the simple layout is failing is duplication of a rule. The HTTP path and the webhook path both decide whether a refund is legal, and they drift. That is the moment to pull `RefundPayment` into the middle. Another signal is a vendor type leaking into the rule. If `StripeCharge` is imported by the refund check, the arrow already points the wrong way.

Package names are not the architecture. `internal/charge` with inward imports is clean. `clean/usecases/v2` with a Stripe import in the entity is not.

Keep the order of the answer straight.

1. Say the arrows point inward, toward the rules.
2. Name domain, use case, and adapter, and what each may import.
3. Draw three boxes, not five rings.
4. Cut a dense service, such as payments, that way.
5. Leave a thin service as handlers and a store until a second adapter appears.

You can recite the rings. In the room you still start by naming Express. Speak the rule and the ports before the framework.

Drill the store choice on the [fundamentals study page](/study/fundamentals) so the ledger stays a decision, not a habit. Then keep going on the [study page](/study).
