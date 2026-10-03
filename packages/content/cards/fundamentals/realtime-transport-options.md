---
id: realtime-transport-options
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [realtime, api, networking]
prompt: >
  Compare short polling, long polling, server-sent events and WebSockets for
  pushing updates to a browser. Which would you use for a chat app, a stock
  ticker and a build-status page?
keyPoints:
  - Short polling is simple and stateless but wastes requests and adds latency up to the poll interval
  - Long polling holds the request until data arrives, reducing wasted calls but still paying connection setup per message
  - SSE is a one-way, HTTP-native stream with automatic reconnect, ideal for server-to-client feeds
  - WebSockets give a persistent bidirectional channel, best for chat and collaborative editing, but need stateful servers and sticky routing or a pub/sub backbone
  - Match the choice to direction, message frequency and infrastructure constraints such as proxies and HTTP/2
eli5:
  - Asking again every few seconds is simple, but most asks come back empty and news can be as late as the gap between asks
  - Asking and having the server hold the line until there is news wastes less, but you redial after every message
  - A one-way stream from server to browser over plain web requests reconnects without help and suits live feeds
  - A two-way open line suits chat and shared editing, but each server must remember its callers and pass messages between servers
  - Pick by which way messages flow, how often they come, and what the network in between allows
distractors:
  - text: Server-sent events are bidirectional, so the browser can send messages on the same stream
    why: SSE flows from server to browser only. The browser needs a separate request to send anything
  - text: WebSockets work with stateless servers, with no sticky routing and no shared pub/sub layer
    why: Each connection lives on one server, so reaching a user needs sticky routing or a pub/sub layer between servers
  - text: Short polling delivers updates the instant they happen
    why: An update waits for the next poll, so the delay is up to the polling interval
followUps:
  - How do you scale WebSocket servers horizontally and route a message to the right connection?
  - What does a mobile client on a flaky network change about this choice?
references:
  - title: MDN, Using server-sent events
    url: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
  - title: MDN, The WebSocket API
    url: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
updated: 2026-10-02
reviewed: true
---

HTTP is request-response; the server cannot speak first. Each technique works around that differently.

**Short polling.** The client asks every N seconds. Trivial, cacheable, works through any proxy. Latency averages N/2 and most requests return nothing, so it is wasteful at scale.

**Long polling.** The client asks and the server holds the request open until there is something to say (or a timeout), then the client immediately asks again. Latency drops to near zero, wasted requests vanish, but each message still costs a full HTTP round trip and the server holds many open connections.

**Server-sent events (SSE).** One long-lived HTTP response with `Content-Type: text/event-stream`; the server writes events as they happen. Browsers reconnect automatically and resume from the last event id. One direction only (server to client), text only, and over HTTP/1.1 limited to six connections per origin, which HTTP/2 removes.

**WebSockets.** An HTTP upgrade to a persistent, full-duplex, low-overhead frame protocol. Either side can send at any time. The server becomes stateful: you need to know which connection belongs to which user, route messages between servers (Redis pub/sub, a message broker) and handle reconnection yourself.

| Use case | Choice | Reason |
| --- | --- | --- |
| Chat | WebSockets | bidirectional, frequent small messages, typing indicators |
| Stock ticker | SSE (or WebSockets) | server-to-client only, high frequency, auto reconnect |
| Build status page | SSE, or long polling if infra is simple | rare updates, one direction |

Pick by direction (one-way favours SSE), frequency (high favours persistent connections) and operational appetite (WebSockets need the most infrastructure).
