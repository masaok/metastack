---
slug: design-chat-system
title: Design chat system for the interview
description: Design chat system for the interview. Open connections, the path of one 1:1 message, group fan-out, history, and presence.
primaryKeyword: design chat system
secondaryKeywords:
  - design slack
category: worked-designs
tags:
  - scalability
  - messaging
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

To design chat system delivery, keep a persistent connection tier that holds sockets, and keep a stateless chat service that validates and writes. A 1:1 send is persist first, then a lookup of the other person's connection, then a push. A large channel stops pushing to every member and lets open clients pull. History is a range read on one conversation partition. Receipts and presence are separate, cheaper streams.

## Connections that stay open

Polling a REST endpoint every second is the wrong opening. It wastes requests and still adds delay. Chat needs a line that stays up. WebSocket is the usual name. The client opens it once. Frames then carry send, ack, receipt, typing, and presence. REST stays for history, conversation lists, and the presigned URL that starts a media upload.

The process that holds the socket is not the process that owns the message. The [chat-system card](/cards/chat-system) puts a tuned server in the 100,000 to 1,000,000 idle-connection range, and the fleet in the hundreds to about 1,000 servers once you have 50 to 100 million sockets. Those sockets come from 500 million daily users with 10 to 20 percent online at peak. Mix that fleet with request workers and a reconnect storm will pin the wrong pool.

The connection process is stateful about sockets and little else. On attach, it writes a map from user id to this process id, plus the device ids on this socket, into a fast store. Redis is the usual drawing. Heartbeats, about every 30 seconds on the card, refresh `last_seen`. When the socket dies, the map row for that device goes away. Friends do not need a publish on every heartbeat. Publish on a transition. Online to last-seen is a transition. Another 30-second tick is not.

Clients reconnect. They will reconnect in a herd when a connection process dies. Jitter the retry. On the new socket, the client sends the last message id it has acknowledged per conversation. Everything newer is a range read. Nothing was waiting only in the dead process, because a message is persisted before it is pushed. The reconnect is a catch-up, not a resurrection of RAM.

Media never shares this socket as a byte pipe. The client asks REST for an upload URL, writes the object store directly, and then sends a message that holds a reference. A picture through the chat path is how you stall every other frame on that process.

## The path of one 1:1 message

Alice is on connection process G1. Bob is on G2. Alice's client already has a locally generated message id. That id makes a retry the same send. The card calls this out on the API. Without it, a dropped ack looks like a lost message and Alice sends a twin.

| Step | Who | What happens |
| --- | --- | --- |
| 1 | Alice's client | Sends a frame on the open socket, with the local id, the conversation id, and the body |
| 2 | G1 | Forwards the frame to the chat service. It does not write the store itself |
| 3 | Chat service | Checks that Alice is a member. Assigns a server message id and a timestamp. Writes the row. Then hands the message to the router |
| 4 | Router | Reads the user-to-process map. Bob is on G2. Pushes the payload to G2. Alice gets an ack on G1 with the server id so her UI can mark sent |
| 5 | G2 | Writes a frame to Bob's socket. Bob's client acks. A delivered receipt goes back by the same kind of path |
| 6 | If Bob is offline | The router leaves the message in the store and in a per-user or per-conversation queue, and fires a push notification. Bob fetches on reconnect |

Persist before push. If you push first and the write fails, Bob has a message the history API will never return. If you write first and G2 is down, Bob is offline for a moment and the notification plus the reconnect catch-up cover him. The [message queues post](/blog/message-queues-for-interviews) is the place you already said that a later consumer can finish work the producer does not wait for. Offline delivery is that shape. The online path is a direct push after the write, not a hope that a worker will notice in time for a 100 ms in-region budget.

Ordering inside the conversation is a server job. A per-conversation sequencer, or the partition owner, issues the server id. Every client sorts by that id. Snowflake-style time-ordered ids are the approximation when a single sequencer is too hot. Two senders on two connection processes must still land in one conversation order. That is why G1 does not mint the id. The chat service, sitting on the write, does.

Duplicates happen. At-least-once delivery plus a retry will show Bob the same body twice unless he dedupes on the id. The local id and the server id are both useful. The local id stops Alice from inserting twice. The server id stops Bob from rendering twice.

## Group fan-out and the size that breaks it

Fan-out is a server job. Alice's phone does not hold the member list and does not open a socket to each person. If it did, a send would fail when she backgrounded the app, and every client would need a live view of membership. The chat service expands `members(conversation_id, ...)` and the router delivers.

For a group of a few hundred, the router can push to each member. That is the same path as 1:1 with a longer list. The card's estimate is the warning on volume, not on this small group. 500 million daily users times 40 messages is 20 billion messages a day, about 230,000 writes per second. Peak is about 500,000 to 700,000. With about three recipients on an average message, deliveries sit near 700,000 per second and about 2 million at peak. Those deliveries are map lookups plus a push or a notification. They have to be in memory. They do not require a special channel path yet.

A channel with tens of thousands of members breaks the push. The card's failure case is a 50,000-member group. One message becomes 50,000 pushes. The conversation partition is hot for the write. The router is a storm for the read. People who do not have the channel open still get work they will not look at. Switch the path. Notify members that the channel has new messages. Let a client that actually has the channel open pull the tail. Closed clients wait for a push notification and pull on open. That is the Slack-shaped split the card names.

The same split shows up in a feed. Ordinary authors get fan-out on write. Celebrity authors get fan-out on read. [Design news feed for the interview](/blog/design-news-feed) is that argument with follower counts. Chat uses member counts. A few hundred members, push. Tens of thousands, pull on open. Do not invent a QPS for the huge channel. The 50,000-member picture is already the proof that push does not fit.

Read the member list at send time. A user who left should not get the next message. A user who joins later loads history from the partition.

## History, receipts, and presence

History is a store problem. The card's table is `messages` partitioned by `(conversation_id, time_bucket)` and clustered by `message_id`. "Last fifty messages in this chat" is one partition read in time order. A global auto-increment across all chats is a single writer for the product. Do not do that. A single relational table ordered by one counter is the distractor the card already rejects.

`conversations(id, type, created_at)` and `members(conversation_id, user_id, joined_at, last_read_message_id)` sit beside the messages. The last-read pointer is how a device knows what to mark read and what to fetch next. Each device also tracks the last id it has seen per conversation. Reconnect is `GET /conversations/{id}/messages?before=` on REST, or a catch-up frame on the socket, from that id forward.

Receipts are three states. Sent means the server has the row and has acked Alice. Delivered means Bob's client has the frame. Read means Bob's last-read pointer has passed that id. Each state is a small write. Do not put them on the message row in a way that turns one popular message into a hotspot of updates. A per-user pointer per conversation is enough for read. Delivered can be an event. Offline users get a push instead of a delivered frame.

Presence is a heartbeat and a map, not a message. The connection process updates `last_seen`. Subscribers hear transitions. A friend list of a few hundred can listen on a pub/sub channel. A product that tries to show "typing" to 50,000 people is back in the huge-channel problem. Bound it. Typing is for open 1:1 and small groups. Large channels skip it, or they show it only to people who already have the channel open and pulled.

Storage numbers stay on the card. Text is about 100 to 300 bytes with metadata. 20 billion times 200 bytes is about 4 TB a day, about 1.5 PB a year, before media. If 2 percent of messages carry a 1 MB image, that is 400 TB a day, a hundred times the text. Object storage takes the bytes. The message takes the reference. Those figures are why the partition key and the off-path upload show up in the design.

An offline user should learn that a message exists. The notification is a tap. The source of truth is still the partition. Opening the app runs the same catch-up as a reconnect.

## What the chat-system card already asks you to say

The [chat-system card](/cards/chat-system) scores a spoken answer. Restate the points in the order you would say them.

Hold sockets on a dedicated connection tier. Keep the chat service stateless about sockets. Route with a user-to-process map in a fast store. Offline work sits in a per-user or per-conversation queue plus a notification. The online path is a push to the process the map names.

Store messages in a wide-column or partitioned store keyed by conversation and time. History is one partition read. Do not put every chat in one table behind one counter.

Fan out on the server. Cap the size of a push group. Give a huge channel a pull path. A client that sends one copy per member is the failure the card lists. Cover the delivery states, keep one conversation in one order, and notify people who are offline. Client-generated ids make the send idempotent. Server-generated ids make the order.

The estimates on the card are the ones you may use. 500 million daily users, 40 messages each, about 230,000 writes per second, peak near 600,000, about 2 million deliveries per second at peak with three recipients, 50 to 100 million sockets, about 4 TB of text a day. Do not invent a different QPS.

Follow-ups. How do senders on two connection processes agree on order in one group. That is the sequencer or the partition owner. How would end-to-end encryption change the server. Bodies become opaque. The server can still persist ciphertext, route, and store receipts. It cannot read the body to moderate or to index.

A design that only draws a socket and a table misses the map, the offline queue, the huge-channel pull, and the three delivery states. Run the card on the [classic designs study page](/study/designs) until the 1:1 path comes out in order and the 50,000-member channel switches to pull.

[Start drilling](/study/designs).
