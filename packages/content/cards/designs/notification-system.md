---
id: notification-system
deck: designs
type: design
difficulty: 2
tags: [messaging, availability, api]
prompt: >
  Design a notification service that delivers push, SMS and email to users at
  scale, with user preferences, rate limits and retries.
keyPoints:
  - Decouples producers from delivery with a queue per channel so slow providers do not block callers
  - Applies preferences, quiet hours, deduplication and per-user rate limits before enqueueing
  - Abstracts third-party providers (APNs, FCM, Twilio, SES) behind channel workers with retries and failover
  - Uses templates rendered at send time and stores a notification log for status and auditing
  - Discusses idempotency, priority lanes for transactional vs marketing, and provider rate limits
eli5:
  - Senders drop messages in a line for each channel and walk away, so a slow delivery company holds nobody up
  - Before a message joins the line, check the person's wishes, quiet hours, repeats and how many they already got
  - Each channel has workers who know how to talk to the outside delivery company, try again on failure and switch to a backup
  - Fill in the message wording at the moment of sending, and keep a record of what was sent and what happened
  - Sending twice must do no harm, urgent messages get a fast lane ahead of adverts, and outside companies cap how fast you can send
distractors:
  - Call the push, SMS and email providers synchronously inside the request that triggers the notification
  - Check user preferences and quiet hours after the provider has sent the message
  - Put marketing and transactional messages in one queue with equal priority
followUps:
  - How do you prevent the same event from notifying a user twice across push and email?
  - How would you implement "digest" notifications that batch low-priority events hourly?
stages:
  - name: Requirements
    keyPoints:
      - Send notifications via push, SMS, email on behalf of internal services, honour user preferences
      - Reliable delivery with retries, no duplicates, priorities, delivery status tracking
  - name: Estimates
    keyPoints:
      - e.g. 10M push, 1M email, 100k SMS per day → tens to hundreds per second average, bursts of 10k/s on broadcast events
      - Logs at ~1 KB per notification, ~10 GB/day
  - name: API
    keyPoints:
      - POST /notifications with userId, type, payload, channels, priority, idempotencyKey
      - GET /notifications/{id} for status, user-facing preferences endpoints
  - name: Data model
    keyPoints:
      - users' devices and contact info, preferences per notification type and channel
      - notification log (id, user, type, channel, status, provider_message_id, timestamps)
  - name: High-level design
    keyPoints:
      - API validates, applies preferences and dedup, writes log row, enqueues per channel
      - Channel workers render templates, call providers, update status, retry with backoff, dead-letter on exhaustion
  - name: Deep dives
    keyPoints:
      - Provider abstraction with health-based failover between vendors
      - Priority queues so transactional (2FA codes) never wait behind marketing campaigns
      - Rate limiting per user and per provider, with batching for digest notifications
  - name: Bottlenecks and failure
    keyPoints:
      - Broadcast events (a popular creator posts) produce millions of notifications, fan out through the queue with throttling
      - Provider outages handled by failover and queued retries, not by dropping
      - Device token churn, prune invalid tokens from provider feedback
references:
  - title: Apple developer docs, Sending notification requests to APNs
    url: https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
  - title: Firebase docs, FCM architectural overview
    url: https://firebase.google.com/docs/cloud-messaging/fcm-architecture
updated: 2026-10-02
reviewed: true
---

## Requirements

Internal services (orders, social, security) ask the notification service to tell a user something. The service chooses channels based on the user's preferences and the notification type, renders content, delivers through third-party providers, retries failures, avoids duplicates, respects quiet hours and rate limits, and records delivery status. Transactional notifications (login codes, payment receipts) must be fast and reliable; marketing can wait.

## Estimates

Say 10 million push, 1 million email and 100,000 SMS per day: tens to a few hundred per second on average, but events like "your favourite team scored" create bursts of tens of thousands per second. Each notification logs ~1 KB → ~10 GB/day, keep 90 days.

## API

```text
POST /v1/notifications
{ userId, type: "order_shipped", data: {...}, channels?: [...], priority: "high"|"normal"|"low", idempotencyKey }
-> { notificationId, status: "queued" }

GET  /v1/notifications/{id}
GET/PUT /v1/users/{id}/preferences
```

## Data model

`devices(user_id, platform, token, last_seen)`, `contacts(user_id, email, phone, verified)`, `preferences(user_id, type, channel, enabled, quiet_hours)`, `templates(type, channel, locale, body)`, and a `notification_log(id, user_id, type, channel, status, provider_message_id, created_at, delivered_at, error)`.

## High-level design

```mermaid
flowchart LR
  S[Internal services] --> API[Notification API]
  API --> PREF[Preferences + dedup + rate limit]
  PREF --> LOG[(Notification log)]
  PREF --> QP[(Push queue)]
  PREF --> QE[(Email queue)]
  PREF --> QS[(SMS queue)]
  QP --> WP[Push workers] --> APNS[APNs / FCM]
  QE --> WE[Email workers] --> SES[Email provider]
  QS --> WS[SMS workers] --> TW[SMS provider]
  WP & WE & WS --> LOG
```

The API validates the request, checks the idempotency key, resolves the user's channels from preferences, writes a log row per channel with status `queued`, and enqueues one message per channel. Channel workers render the template in the user's locale, call the provider, and update the log. Failures retry with exponential backoff; after N attempts the message goes to a dead-letter queue for inspection.

## Deep dives

**Provider abstraction.** Each channel worker talks to an interface (`send(message) → providerId | error`) with multiple implementations. Track per-provider error rates and latency; on degradation, shift traffic to a backup vendor automatically.

**Priorities.** Separate queues (or priority lanes) per urgency. A marketing blast of 5 million emails must never delay a 2FA code. Reserve worker capacity for the high-priority lane.

**Deduplication and rate limiting.** The idempotency key stops duplicate requests from the same producer. A per-user limiter ("at most 5 marketing pushes a day") and collapse keys ("replace the older 'new message' notification") stop fatigue. Digest mode buffers low-priority events and sends one summary per hour.

**Templates.** Store templates with placeholders; render at send time so copy changes do not need code deploys, and version them so the log can show exactly what was sent.

## Bottlenecks and failure modes

- **Broadcast fan-out:** one event → millions of notifications. Expand the audience in a fan-out worker that enqueues in batches with throttling, rather than inside the API request.
- **Provider outage:** messages queue up; retries with backoff plus vendor failover. Monitor queue age, not just depth.
- **Invalid device tokens:** APNs and FCM report them; prune on feedback or every push wastes a call.
- **Provider rate limits:** SMS vendors throttle per number; shard sends across sender pools and respect their limits with a token bucket per provider.
