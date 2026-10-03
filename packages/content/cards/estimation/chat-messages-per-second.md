---
id: chat-messages-per-second
deck: estimation
type: estimation
difficulty: 2
tags: [estimation, realtime, messaging]
prompt: >
  A messaging app has 500 million DAU sending 40 messages each per day.
  Estimate message write rate, fan-out delivery rate for group chats, concurrent
  connections, and daily message storage.
keyPoints:
  - Writes, 500M × 40 = 20 billion messages per day ≈ 230,000 per second average, ~500,000-700,000 at peak
  - Fan-out, if the average message reaches 3 recipients the delivery rate is ~700,000 per second average, millions at peak
  - Concurrent connections, assume 10-20% of DAU online at peak, 50-100 million persistent connections, so on the order of 1,000 gateway servers at ~100k connections each
  - Storage, 20B × ~200 bytes ≈ 4 TB per day of text, ~1.5 PB per year before media
  - Media dwarfs text if even a few percent of messages carry a 1 MB attachment
eli5:
  - Multiply users by messages each, divide by the seconds in a day, and then allow two or three times that for the busy hour
  - Each message goes to a few people, so deliveries outnumber sends by that factor
  - Guess what share of users are online at once, then divide by how many open lines one server can hold to count servers
  - Multiply daily messages by a couple of hundred bytes each to get storage per day, then by 365 for the year
  - Pictures and video are so much bigger than text that even a small share of them outweighs all the text
distractors:
  - 500M × 40 = 20 billion messages per day, which is about 23,000 per second on average
  - Assume every daily user is connected at the same moment, so plan for 500 million connections
  - Text storage exceeds media storage, because messages far outnumber attachments
followUps:
  - How do you shard message storage so a conversation's history is a single-partition read?
  - What changes if you add read receipts and typing indicators to the delivery estimate?
references:
  - title: WhatsApp engineering, 1 million is so 2011 (connections per server)
    url: https://blog.whatsapp.com/1-million-is-so-2011
  - title: Discord engineering, How Discord stores trillions of messages
    url: https://discord.com/blog/how-discord-stores-trillions-of-messages
updated: 2026-10-02
reviewed: true
---

Chat is the estimation exercise where fan-out and connection count matter more than raw writes.

**Messages per second**
500 × 10^6 × 40 = 2 × 10^10 messages/day.
2 × 10^10 / 86,400 ≈ 2.3 × 10^5 → **~230,000 writes/s average**.
Peak at 2–3× → **~500,000–700,000 writes/s**. That is well beyond one database; message storage must be partitioned (by conversation id is the natural choice, so a chat's history is one partition).

**Fan-out**
Each message is delivered to every other member of the conversation. With a mix of 1:1 chats and groups, say an average of 3 recipients: 230,000 × 3 ≈ **700,000 deliveries/s average, ~2 million at peak**. Every delivery is a lookup of where the recipient is connected plus a push over that connection, or a push notification if offline. This is the hottest path in the system and must be in-memory.

**Concurrent connections**
Assume 10–20% of DAU are connected at any moment at peak: **50–100 million persistent connections** (WebSocket or similar). A tuned gateway server holds on the order of 100,000–1,000,000 idle connections (WhatsApp famously pushed past a million per server on Erlang), so **hundreds to ~1,000 gateway servers**. The gateways are stateless apart from the connection map, which must be shared (a presence/routing service keyed by user id → gateway).

**Storage**
Text messages are ~100–300 bytes with metadata. 2 × 10^10 × 200 B = 4 × 10^12 → **~4 TB/day**, ~1.5 PB/year. Discord stores trillions of messages this way in a wide-column store partitioned by channel and time bucket.

Media: if 2% of messages carry a 1 MB image, that is 4 × 10^8 × 1 MB = **400 TB/day**, 100× the text. Media goes to object storage via presigned uploads; the message only carries a reference.

**What the numbers tell you.** Hundreds of thousands of writes per second → partitioned message store. Millions of deliveries per second → in-memory routing and gateways. Connection count → a dedicated connection tier separate from business logic. Media → off the hot path entirely.
