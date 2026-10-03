---
id: queue-vs-log
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [messaging, streaming, architecture]
prompt: >
  Compare a traditional message queue (RabbitMQ, SQS) with a distributed log
  (Kafka, Kinesis). When do you want each?
keyPoints:
  - A queue deletes a message once a consumer acknowledges it, a log retains messages and consumers track their own offset
  - Logs allow many independent consumer groups to read the same stream and to replay history
  - Queues offer per-message routing, priorities and simple competing consumers, logs offer ordering within a partition and very high throughput
  - Replay and multiple readers make logs the backbone for event sourcing, CDC and stream processing
  - Queues are simpler for task distribution where each job should be done once and forgotten
eli5:
  - A queue throws a message away once someone has handled it, while a log keeps everything and each reader remembers its own place
  - With a log, many separate readers can go through the same stream and go back to reread
  - Queues are good at routing, priorities and sharing jobs among workers, and logs are good at strict order within a lane and sheer volume
  - Because it can be reread by many, a log is the base for rebuilding state, copying database changes and processing streams
  - A queue is the simpler pick when each job should be done once and then forgotten
distractors:
  - text: A log deletes each message as soon as one consumer acknowledges it
    why: That describes a queue. A log keeps messages for its retention period and each consumer tracks an offset
  - text: A traditional queue lets many independent consumer groups replay the full history
    why: A queue removes a message once it is acknowledged, so there is no history to replay. Replay is what a log offers
  - text: Kafka guarantees a global order across all partitions of a topic
    why: Order is guaranteed only inside one partition. Across partitions there is no global order
followUps:
  - How does a Kafka consumer group achieve parallelism, and what limits it?
  - What happens in each system when a consumer is slow for an hour?
references:
  - title: Apache Kafka docs, Introduction
    url: https://kafka.apache.org/intro
  - title: Jay Kreps, The Log, What every software engineer should know about real-time data's unifying abstraction
    url: https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying
updated: 2026-10-02
reviewed: true
---

Both move messages from producers to consumers asynchronously; they differ in what happens to a message after it is read.

**Message queue (RabbitMQ, SQS, ActiveMQ).** A message is delivered to one consumer, acknowledged, and deleted. Competing consumers share a queue to parallelise work. Brokers support routing rules, priorities, per-message TTL and delayed delivery. The mental model is a to-do list: each job is done by exactly one worker and then gone.

**Distributed log (Kafka, Kinesis, Pulsar, Redpanda).** Messages are appended to a partitioned, ordered log and retained for a configurable period (hours to forever). Consumers do not delete anything; each consumer group remembers its own offset. The same stream can be read by the billing team, the search indexer and a fraud model, each at its own pace, and any of them can rewind to reprocess. Throughput scales with partitions; ordering is guaranteed within a partition.

| Need | Queue | Log |
| --- | --- | --- |
| Background jobs done once | yes | awkward |
| Several teams consuming the same events | fan-out exchanges, copies per queue | native, one topic |
| Replay last week's events | no | yes |
| Strict ordering for a key | per queue only | per partition (key-based) |
| Millions of events per second | hard | designed for it |
| Per-message delay, priority | yes | no |

**Choosing.** Image resizing, email sending, webhook delivery: a queue. Order events that feed analytics, search, notifications and an audit trail: a log. Many systems use both: a log as the system of record for events and queues as work buffers in front of specific workers.

A good closing line: "a queue is about distributing work; a log is about sharing a durable history."
