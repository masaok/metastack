---
id: delivery-guarantees
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [messaging, idempotency, consistency]
prompt: >
  Explain at-most-once, at-least-once and exactly-once delivery. Why is
  exactly-once so hard, and how do systems approximate it?
keyPoints:
  - At-most-once sends without retry, so messages can be lost but never duplicated
  - At-least-once retries until acknowledged, so nothing is lost but duplicates are possible after timeouts
  - True exactly-once delivery is impossible across unreliable networks, you get exactly-once processing via idempotent consumers or transactional dedup
  - Idempotency keys, upserts and conditional writes make duplicate processing harmless
  - Kafka-style transactions provide exactly-once within the system by committing output and offsets atomically
eli5:
  - Send once and never retry, so a message might vanish but never arrives twice
  - Keep sending until you hear it arrived, so nothing vanishes but a message may arrive twice
  - Nobody can promise exactly one arrival over a flaky network, so make the receiver ignore repeats and the effect happens once
  - Tag each action with an id, or write in a way that repeating changes nothing, and repeats become harmless
  - Some log systems save the result and the bookmark of how far you read in a single step, so inside them each message counts once
distractors:
  - text: At-least-once delivery never produces duplicates, because the broker tracks acknowledgements
    why: If an acknowledgement is lost the sender retries, and the receiver gets the message twice
  - text: Exactly-once delivery across a network is achieved simply by retrying until an acknowledgement arrives
    why: Retrying gives at-least-once. Duplicates still have to be made harmless with idempotent processing
  - text: At-most-once is the safest guarantee when a lost message is unacceptable
    why: At-most-once never retries, so it is the guarantee that loses messages
followUps:
  - Where would you store processed message ids and for how long?
  - Why does acknowledging before processing give you at-most-once?
references:
  - title: AWS Builders' Library, Making retries safe with idempotent APIs
    url: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
  - title: Apache Kafka docs, Message delivery semantics
    url: https://kafka.apache.org/documentation/#semantics
updated: 2026-10-02
reviewed: true
---

Networks lose packets and processes crash at the worst moment, so every messaging system has to decide what happens when a sender is unsure whether a message arrived.

**At-most-once.** Send and forget. If the acknowledgement never comes, do not retry. Simple and never duplicates, but messages can vanish. Fine for metrics samples or presence pings where the next one is coming anyway.

**At-least-once.** Retry until acknowledged. Nothing is lost, but if the ack was the thing that got lost, the receiver sees the message twice. This is the default for SQS, Kafka consumers and most RPC retry policies, and it means every consumer must tolerate duplicates.

**Exactly-once.** Every message is processed once and only once. Delivery alone cannot guarantee this: the receiver might process the message and crash before acknowledging, and the sender cannot tell that apart from a lost message. What you can achieve is **exactly-once processing**: duplicates may arrive but have no additional effect.

**Techniques**

- **Idempotent operations.** `SET balance = 100` is idempotent; `balance += 10` is not. Model updates as absolute state or upserts where possible.
- **Idempotency keys.** The producer attaches a unique id; the consumer records processed ids (with a TTL) and skips repeats. Stripe's API works this way.
- **Conditional writes.** `UPDATE ... WHERE version = 7`, or DynamoDB condition expressions, so a replayed update fails harmlessly.
- **Transactional outbox / inbox.** Write the business change and the message record in the same database transaction, then publish from the outbox, so publish and state never diverge.
- **Kafka transactions.** A consumer-transform-producer loop commits its output messages and its input offsets atomically, giving exactly-once *within Kafka*.

Interviewers want you to say that exactly-once is a property of the consumer's processing, not of the wire, and then name the dedup store and how long it keeps ids.
