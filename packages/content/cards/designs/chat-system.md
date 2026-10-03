---
id: chat-system
deck: designs
type: design
difficulty: 3
tags: [realtime, messaging, storage]
prompt: >
  Design a messaging system like WhatsApp or Slack supporting 1:1 and group
  chats, online presence, and message history across devices.
keyPoints:
  - Uses a persistent connection tier (WebSocket gateways) separate from stateless chat services
  - Routes messages via a user → gateway mapping held in a fast store, with a message queue per user or per conversation for offline delivery
  - Stores messages in a wide-column or partitioned store keyed by conversation id and time so history is one partition read
  - Handles group fan-out server side, with limits on group size or a different path for very large channels
  - Covers delivery states (sent, delivered, read), ordering within a conversation, and push notifications for offline users
eli5:
  - Keep phone lines open on dedicated switchboards, and let the workers who handle messages hang up between jobs
  - A directory says which switchboard each person is plugged into, and a mailbox holds messages for anyone who is away
  - File each conversation in its own folder in date order, so reading history means opening one folder
  - The server makes the copies for a group, and a huge channel gets its own delivery route
  - Track whether each message was sent, arrived and was read, keep a chat in order, and buzz the phones of people who are offline
distractors:
  - text: Clients poll a REST endpoint every second for new messages, so no connection tier is needed
    why: Polling at that rate wastes requests and still adds delay. Chat needs a persistent connection tier
  - text: Store all messages in one relational table ordered by a global auto-increment id
    why: One table with a global counter is a single write bottleneck. History should be partitioned by conversation
  - text: A sender fans a group message out by sending one copy to each member from the client
    why: Fan-out belongs on the server, so delivery does not depend on the sender staying online or knowing the member list
followUps:
  - How do you guarantee message ordering within a group when senders are on different gateways?
  - How would you add end-to-end encryption and what server features does it break?
stages:
  - name: Requirements
    keyPoints:
      - 1:1 and group messages, delivery and read receipts, presence, history sync across devices, push notifications
      - Low latency delivery (<100 ms online), no message loss, ordering within a conversation
  - name: Estimates
    keyPoints:
      - e.g. 500M DAU × 40 msgs → ~230k msgs/s average, 50-100M concurrent connections
      - ~4 TB/day of text, media in object storage
  - name: API
    keyPoints:
      - WebSocket for send/receive/ack/typing/presence, REST for history, conversations and media upload URLs
      - Client-generated message ids for idempotent sends
  - name: Data model
    keyPoints:
      - messages partitioned by (conversation_id, time bucket), clustered by message id for ordering
      - conversations, members, per-user per-conversation last_read pointer, user → gateway presence map
  - name: High-level design
    keyPoints:
      - Gateway tier holds connections, chat service validates and persists, router looks up recipient gateways and pushes
      - Offline recipients get a queued message plus a push notification
  - name: Deep dives
    keyPoints:
      - Message ids from a per-conversation sequencer or time-ordered ids with server-assigned ordering
      - Group fan-out via a service that expands membership and delivers, small groups synchronous, large channels pull-based
      - Presence via heartbeats with last-seen timestamps and subscription to friends' status
  - name: Bottlenecks and failure
    keyPoints:
      - Gateway failure reconnects clients and resyncs from last acked message id
      - Hot conversations (huge groups) handled by pull on open rather than push to every member
      - Duplicate delivery after retries made safe by idempotent message ids
references:
  - title: Discord engineering, How Discord stores trillions of messages
    url: https://discord.com/blog/how-discord-stores-trillions-of-messages
  - title: Slack engineering, Real-time messaging
    url: https://slack.engineering/real-time-messaging/
updated: 2026-10-02
reviewed: true
---

## Requirements

Send and receive messages in 1:1 and group conversations with delivery and read receipts; show presence (online, last seen); sync history across a user's devices; notify offline users. Online delivery should feel instant (under 100 ms in-region), nothing may be lost, and messages within a conversation must appear in the same order for everyone.

## Estimates

500 million DAU × 40 messages ≈ 2 × 10^10 messages/day ≈ 230,000/s average, ~600,000/s peak. With ~3 recipients per message, ~2 million deliveries/s at peak. 10–20% online at once → 50–100 million persistent connections. Text storage ~4 TB/day; media (via object storage) 100× that.

## API

A WebSocket (or similar) channel carries `send`, `ack`, `receipt`, `typing` and `presence` frames. REST endpoints cover `GET /conversations`, `GET /conversations/{id}/messages?before=`, `POST /media/upload-url`. Clients attach a locally generated message id to each send so retries are idempotent.

## Data model

`messages` partitioned by `(conversation_id, time_bucket)` and clustered by `message_id`, so "load the last 50 messages in this chat" is one partition read in time order. `conversations(id, type, created_at)`, `members(conversation_id, user_id, joined_at, last_read_message_id)`. A presence/routing map `user_id → { gateway_id, device_ids, last_seen }` in Redis.

## High-level design

```mermaid
flowchart LR
  A[Alice's app] <--> G1[Gateway 1]
  B[Bob's app] <--> G2[Gateway 2]
  G1 --> CS[Chat service]
  CS --> DB[(Message store)]
  CS --> RT[Router]
  RT --> P[(Presence / routing map)]
  RT --> G2
  RT --> PN[Push notification service]
```

Alice's gateway forwards her message to the chat service, which validates membership, assigns a server-side message id and timestamp, persists it, and hands it to the router. The router looks up each recipient's gateway and pushes the message; recipients not connected get a push notification and will fetch on reconnect. Alice's gateway returns an ack with the server id so her client can mark it "sent".

## Deep dives

**Ordering.** Assign ids per conversation from a single writer (a per-conversation sequencer or the partition owner) so every client sorts by the same id. Time-ordered ids (Snowflake) are a reasonable approximation when strict per-conversation sequencing is too costly.

**Group fan-out.** For groups up to a few hundred members, the router expands membership and pushes to each. For huge channels (tens of thousands), pushing is wasteful; instead notify members that the channel has new messages and let clients pull when the channel is open, Slack-style.

**Sync across devices.** Each device tracks the last message id it has seen per conversation and requests everything newer on reconnect. Because history is in a partitioned store keyed by conversation and time, this is a cheap range read.

**Presence.** Clients heartbeat every ~30 s; the gateway updates `last_seen`. Friends subscribe to presence changes through a pub/sub channel; publish only on transitions, not on every heartbeat.

## Bottlenecks and failure modes

- **Gateway crash:** tens of thousands of clients reconnect at once. Use jittered reconnect and let them resync from last acked id; nothing is lost because messages are persisted before delivery.
- **Hot conversation:** a 50,000-member group is a hot partition for writes and a fan-out storm for reads; the pull model for large channels and time-bucketing the partition key handle it.
- **Duplicates:** at-least-once delivery means a client may see a message twice; dedupe by message id.
- **Media:** never through the chat path. Upload to object storage via presigned URL, send a message containing the reference.
