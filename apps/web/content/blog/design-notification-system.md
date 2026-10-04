---
slug: design-notification-system
title: Design notification system for interviews
description: Design notification system for interviews. Preferences, fan-out, quiet hours, and push, email, and SMS as separate workers.
primaryKeyword: design notification system
category: worked-designs
tags:
  - scalability
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

When you design notification system delivery for interviews, start from one event, one preference check, and one channel worker. Internal services ask you to tell a user something. You choose the channel. You enqueue. You leave. A slow provider must not hold the caller.

## The event, the preference, and the channel

Orders, social, and security all want to notify someone. The product is not one send. It is a decision about whether to send, on which channel, and under which rules.

Ask what the notification is for. A login code is transactional. A weekly digest is marketing. Transactional work must be fast and reliable. Marketing can wait. Say that split before you name a queue.

Ask which channels exist. Push, email, and SMS are the usual three. The caller may hint at a channel. The user's preferences win. A type that the user turned off never reaches a provider.

The create is `POST /v1/notifications`. The body carries a user id, a type such as `order_shipped`, a payload, an optional channel list, a priority, and an idempotency key. The response is a notification id and the status `queued`. Status later lives on `GET /v1/notifications/{id}`. Preferences live on `GET` and `PUT` of `/v1/users/{id}/preferences`.

The API validates the request. It looks up the idempotency key. A repeat of the same key returns the stored outcome. A new key continues.

It then loads devices, contacts, and preferences. Devices hold a platform and a token. Contacts hold a verified email and a verified phone. Preferences hold, per type and channel, whether the channel is on and which quiet hours apply.

Channels that survive those checks get a log row each. The row starts as `queued`. The API then enqueues one message per surviving channel. The caller is done. Rendering and the provider call happen later.

Do not call a provider inside the request that created the event. A slow SMS vendor would fail checkout. A down push vendor would fail login. The [message queues](/blog/message-queues-for-interviews) post is the reason the API only writes a queue.

Keep templates out of the request path too. Store a template per type, channel, and locale. Render it when the worker sends. A copy change is a template version, not a deploy. The log can show which version went out.

## Fan-out that cannot wake a million phones at once

One event can name one user. One event can also name an audience. A creator posts. A team scores. The API must not expand that audience while the caller waits.

Accept the event. Write that a fan-out job exists. Return. A fan-out worker reads the audience in pages. It applies preferences per user. It enqueues in batches. It throttles so the channel queues grow at a rate the workers and the providers can drain.

The [notification-system card](/cards/notification-system) starts from 10 million push, 1 million email, and 100,000 SMS a day. Average send rates sit in the tens to a few hundred per second. A broadcast still produces bursts of tens of thousands per second. Those bursts are why expansion is a job, not a request.

Each logged notification is about 1 KB. That is about 10 GB a day. Keep ninety days and the log is about 900 GB. That is a store you can shard by user or by day. It is not the hard part. The hard part is the burst that tries to wake a million devices in one second.

Throttle at two places. Throttle the fan-out worker so enqueue stays ahead of, but near, drain. Throttle each provider so you stay under its cap. SMS vendors limit per number. Shard sends across sender pools. A token bucket per provider is enough to say out loud.

Watch queue age, not only depth. A deep queue that is draining is a burst you planned for. An old queue is an outage or a worker that stopped. Provider failover and retries belong on that old queue. Dropping the burst is not the answer.

A popular creator is the same shape as a celebrity post in a feed. You do not push a million writes through the request that accepted the post. You spread the work. The difference here is that each write is a send to a vendor that will rate-limit you.

## Dedup, quiet hours, and retries

The same event must not notify the user twice. The same event must not notify the user on two channels when they asked for one. Dedup runs before enqueue.

The producer's idempotency key stops a retried `POST` from creating a second log row. Store the key and a hash of the body before you write the log. A second call with the same key returns the first notification id. A second call with the same key and a different body is a conflict. The [idempotency keys](/blog/idempotency-keys) post is the store-before-effect step. Use it here.

That key is per producer request. It does not collapse two legitimate events. A collapse key does that. Two "new message" pushes in a short window can replace each other. The newer payload wins. The older queued send is skipped or overwritten at the provider when the provider supports a collapse id.

Quiet hours run before enqueue as well. A preference says this type is silent from 22:00 to 07:00 in the user's locale. Hold the message. Do not send it and then apologise. Transactional types can skip quiet hours. Say which types skip. A 2FA code that waits until morning is a failed login.

Per-user rate limits sit next to quiet hours. The card's example is at most five marketing pushes a day. Transactional sends do not share that budget. A limiter that treats a receipt like an advert will hide a charge the user needed to see.

Digest mode is the other half of fatigue control. Buffer low-priority events. Send one summary on an hourly tick. The hourly job is a scheduled consumer, not a wait inside the original request. The log still records each source event, then the digest that covered them.

Retries are at-least-once. A worker that crashes after a successful provider call and a lost acknowledgement looks like a failure. The next attempt must not create a second user-visible send if the first one landed. Give the provider your idempotency key or a stable provider-facing id. Update the log to `sent` only after the provider accepts. After a fixed number of attempts, move the message to a dead-letter queue. Inspect it. Do not loop forever.

A provider outage is a growing queue, not a dropped event. Fail over to a backup vendor when error rates rise. Keep retrying the original vendor only while it is the healthy one. The user should not see two copies because you failed over and also retried the first path.

## Push, email, and SMS as separate workers

One queue per channel. Push workers talk to APNs or FCM. Email workers talk to an email provider. SMS workers talk to an SMS provider. A slow SMS vendor then holds only the SMS queue. Password-reset email still drains.

Each worker implements one interface. Send a rendered message. Return a provider message id or an error. Swap the implementation when a vendor degrades. Track error rate and latency per vendor. Shift traffic on those signals.

Priority is a second axis. Use separate queues or priority lanes. A marketing blast of 5 million emails must never delay a 2FA code. Reserve worker capacity for the high-priority lane. Equal priority in one queue is how a campaign hides a receipt.

The worker renders the template at send time. It uses the user's locale. It writes the rendered version id onto the log. It calls the provider. It stores `provider_message_id`. It sets `delivered_at` when the provider later confirms, if the provider confirms. Push and email often confirm asynchronously. The log is the place that status lands.

Device tokens churn. APNs and FCM report invalid tokens. Prune them. A token you keep sending to is a wasted call on every broadcast. Last-seen on the device row tells you which tokens are merely quiet.

The log is the audit trail. Columns worth naming are id, user, type, channel, status, provider message id, created time, delivered time, and error. Status moves from `queued` to `sent`, `delivered`, or `failed`. A support tool reads this table. A replay reads it too.

Do not share a worker pool across channels to save a box. The providers fail independently. Their rate limits differ. Their payload shapes differ. Three small worker groups are clearer on a whiteboard than one clever pool.

## What the notification-system card already asks you to say

The [notification-system card](/cards/notification-system) asks you to design a service that delivers push, SMS, and email at scale, with preferences, rate limits, and retries. Say the points in this order.

Decouple producers from delivery with a queue per channel. A slow provider must not block the caller.

Apply preferences, quiet hours, deduplication, and per-user rate limits before enqueueing. Checks after the send are theatre. The user already has the message.

Hide APNs, FCM, Twilio, and SES behind channel workers. Retry. Fail over. Name the vendors as examples of the interface, not as the design.

Render templates at send time. Store a notification log for status and audit.

Talk through idempotency, priority lanes for transactional versus marketing, and provider rate limits.

The card's estimates are the ones above. Ten million push, one million email, and 100,000 SMS a day. Tens to a few hundred sends per second on average. Broadcast bursts of tens of thousands per second. About 1 KB per log row. About 10 GB a day.

The API is `POST /notifications` with user id, type, payload, channels, priority, and an idempotency key. `GET /notifications/{id}` is status. Preferences have their own user-facing endpoints.

The data model is devices and contacts, preferences per type and channel, templates, and the log.

Deep dives the card will push. Provider health and failover. Priority so a 2FA code never waits behind a campaign. Rate limits per user and per provider. Batching for digest notifications.

Failure modes the card will push. A broadcast that fans out through the queue with throttling. A provider outage handled by failover and queued retries, not by dropping. Token churn, pruned from provider feedback.

Follow-ups on the card. How you stop one event from notifying a user twice across push and email. How you implement digest notifications that batch low-priority events hourly. Answer both from the checks that run before enqueue.

Start on the [classic designs study page](/study/designs). Run the notification card until the API, the three queues, and the preference check come out in that order. Then [open the study page](/study) and keep the neighbouring queue and idempotency cards in the same week.
