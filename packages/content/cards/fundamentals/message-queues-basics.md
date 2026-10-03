---
id: message-queues-basics
deck: fundamentals
type: concept
difficulty: 1
tags: [messaging, availability, scalability]
prompt: >
  Why would you put a message queue between two services? What problems does it
  introduce?
keyPoints:
  - Decouples producer and consumer in time and availability, the producer does not need the consumer up
  - Buffers bursts so consumers can process at a steady rate and scale independently
  - Enables fan-out, retries and dead-letter handling without changing the producer
  - Introduces asynchrony, the caller no longer knows the outcome immediately and must design for eventual completion
  - Adds operational concerns, ordering, duplicates, backlog monitoring and the queue as a new critical dependency
eli5:
  - The sender drops a message in a box and leaves, so the receiver does not need to be awake at that moment
  - The box soaks up a sudden rush, and the receiver works through it at its own pace
  - You can add more receivers, retries and a pile for messages that keep failing without touching the sender
  - The sender no longer learns straight away how things went, so the design has to cope with finishing later
  - It brings new chores such as order, repeats and watching the backlog, and it is one more thing that must not break
distractors:
  - text: The producer still needs the consumer to be up at the moment it sends
    why: The queue holds the message until the consumer is ready. That decoupling in time is the main reason to use one
  - text: A queue guarantees every message is processed exactly once and in order, with no extra design
    why: Most queues deliver at least once and can reorder, so the consumer must handle duplicates and ordering itself
  - text: The caller learns the final outcome immediately, exactly as with a synchronous call
    why: The producer learns only that the message was accepted. The result arrives later, if at all
followUps:
  - How do you let the user know when an async job has finished?
  - What is a dead-letter queue and when does a message go there?
references:
  - title: AWS Builders' Library, Avoiding insurmountable queue backlogs
    url: https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/
  - title: RabbitMQ docs, Queues
    url: https://www.rabbitmq.com/docs/queues
updated: 2026-10-02
reviewed: true
---

A synchronous call couples two services tightly: the caller waits, and if the callee is slow or down the caller is too. A queue in between changes the contract: the producer writes a message and moves on; a consumer picks it up when it can.

**What you gain**

- **Temporal decoupling.** The consumer can be deploying, restarting or simply slower than the producer.
- **Load levelling.** A checkout spike produces 10,000 "send receipt" messages in a minute; the email workers drain them at 500 per minute without falling over.
- **Independent scaling.** Add consumers to drain faster; the producer never changes.
- **Resilience patterns for free.** Retries with backoff, dead-letter queues for poison messages, and fan-out to multiple consumers via topics.

**What you pay**

- **Asynchrony leaks into the product.** "Your export is being prepared" instead of "here is your export". You need status tracking, notifications or polling.
- **Delivery semantics.** Most queues are at-least-once; consumers must be idempotent. Ordering is usually per partition or per queue, not global.
- **Observability.** Queue depth and consumer lag become key health signals; a growing backlog is a silent outage.
- **A new dependency.** The broker itself must be highly available and sized for retention during a long consumer outage.

```mermaid
flowchart LR
  P[Checkout service] -->|order.placed| Q[(Queue / topic)]
  Q --> E[Email worker]
  Q --> I[Inventory worker]
  Q --> A[Analytics worker]
```

Interviewers want you to say *why* this particular edge should be async (the caller does not need the result, or the work is slow or bursty) and then immediately name the two consequences: idempotent consumers and a plan for telling the user when the work is done.
