---
id: news-feed
deck: designs
type: design
difficulty: 2
tags: [caching, messaging, scalability]
prompt: >
  Design a social news feed: users follow others, post updates, and see a
  ranked timeline of posts from the people they follow.
keyPoints:
  - Frames the core decision as fan-out on write (precompute feeds) versus fan-out on read (merge at request time)
  - Chooses a hybrid, push for normal users and pull for celebrity accounts with millions of followers
  - Stores feeds as per-user lists of post ids in a cache, hydrating post content from a separate post store
  - Separates ranking from retrieval, fetch candidates then rank, with a chronological fallback
  - Handles consistency expectations, your own post appears immediately while others' can lag seconds
eli5:
  - The main choice is whether to drop each post into every follower's inbox when it is written, or to gather posts when someone opens the app
  - Deliver to inboxes for ordinary people, and gather on demand for celebrities whose posts would need millions of deliveries
  - Each person's feed is a short list of post numbers kept in fast memory, and the post text is looked up separately
  - First collect a pile of possible posts, then sort them by interest, and fall back to newest first if sorting breaks
  - You must see your own post straight away, but it is fine if other people's posts show up a few seconds late
distractors:
  - text: Fan out on write for every account, including those with tens of millions of followers
    why: One post from such an account would trigger tens of millions of feed writes. Those accounts are pulled at read time
  - text: Store the full post content inside every follower's feed list
    why: Copying content into every feed multiplies storage and makes edits and deletes expensive. Feeds hold post ids only
  - text: Rank all posts from everyone the user follows from scratch on every request, with no candidate step
    why: Ranking everything on every request is too slow. Retrieval first narrows to a candidate set, then ranking orders it
followUps:
  - How do you handle a user who follows 5,000 accounts and opens the app after a week away?
  - How would you add "likes" and comment counts to the feed without hammering the counters?
stages:
  - name: Requirements
    keyPoints:
      - Post text and media, follow users, view a feed of followed users' posts, newest or ranked
      - Feed load under 500 ms, posts visible to followers within seconds, highly available
  - name: Estimates
    keyPoints:
      - e.g. 300M DAU, 2 posts per user per day → ~7k posts/s, 10 feed loads per user per day → ~35k feed reads/s, peak 3x
      - Average 200 followers → ~1.4M fan-out writes/s on write path
  - name: API
    keyPoints:
      - POST /posts, GET /feed?cursor, POST /follow/{userId}
      - Cursor pagination on feed, never offsets
  - name: Data model
    keyPoints:
      - posts(id, author_id, content, media_refs, created_at), follows(follower_id, followee_id)
      - feed cache, per user a sorted list of (post_id, score) capped at a few hundred entries
  - name: High-level design
    keyPoints:
      - Post service writes post, publishes event, fan-out workers push post id into followers' feed caches
      - Feed service reads the user's list, hydrates posts from post cache/store, applies ranking
  - name: Deep dives
    keyPoints:
      - Fan-out on write for most users, fan-out on read for accounts above a follower threshold, merged at read time
      - Feed cache in Redis sorted sets or a wide-column store, trimmed to N entries
      - Ranking as a separate stage that scores candidates with engagement and recency features
  - name: Bottlenecks and failure
    keyPoints:
      - Celebrity posts causing millions of writes, solved by the hybrid approach
      - Inactive users wasting fan-out, skip users not seen in 30 days and rebuild on login
      - Cache loss rebuilt lazily by pulling recent posts from followees
references:
  - title: Twitter engineering, The infrastructure behind Twitter, scale
    url: https://blog.x.com/engineering/en_us/topics/infrastructure/2017/the-infrastructure-behind-twitter-scale
  - title: Instagram engineering, Instagration Pt. 2, Scaling our infrastructure to multiple data centers
    url: https://instagram-engineering.com/instagration-pt-2-scaling-our-infrastructure-to-multiple-data-centers-5745cbad7834
updated: 2026-10-02
reviewed: true
---

## Requirements

Users publish posts (text plus optional media), follow other users, and open a feed showing posts from people they follow, newest first or ranked. The feed must load in well under a second and a new post should appear for followers within a few seconds. Reads vastly outnumber writes.

## Estimates

Take 300 million DAU, 2 posts/user/day → 6 × 10^8 posts/day ≈ 7,000 posts/s. Ten feed opens per user per day → 3 × 10^9 reads/day ≈ 35,000 feed reads/s, ~100,000 at peak. With an average of 200 followers, pushing every post to every follower is 7,000 × 200 = 1.4 million feed-cache writes per second. That number is why the design has a decision to make.

## API

```text
POST /posts            { text, mediaIds[] }          -> { postId }
GET  /feed?cursor=...  -> { items: [post...], nextCursor }
POST /users/{id}/follow
```

## Data model

`posts(id, author_id, text, media_refs, created_at)` sharded by post id (Snowflake ids encode time, making recent-post scans cheap). `follows(follower_id, followee_id)` indexed both ways: "who do I follow" and "who follows me". The **feed cache** is per user: a sorted list of `(post_id, score)` capped at a few hundred entries, in Redis sorted sets or a wide-column table.

## High-level design

```mermaid
flowchart LR
  U[Client] --> GW[API gateway]
  GW --> PS[Post service] --> PDB[(Posts)]
  PS --> EV[(Post events)]
  EV --> FO[Fan-out workers]
  FO --> FC[(Feed cache per user)]
  GW --> FS[Feed service]
  FS --> FC
  FS --> PC[(Post cache)]
  FS --> RK[Ranker]
```

Writing a post stores it and emits an event. Fan-out workers look up the author's followers and insert the post id into each follower's feed list. Reading a feed fetches the user's list, hydrates the post objects from a post cache, ranks them, and returns a page with a cursor.

## Deep dives

**Fan-out on write vs on read.** Push (precompute every follower's feed) makes reads a single cache lookup but costs writes proportional to follower count. Pull (at read time, fetch recent posts from every followee and merge) makes writes trivial but reads expensive for users who follow many accounts. The hybrid: push for authors under a threshold (say 10,000 followers), and for celebrities above it do not fan out; instead the feed service pulls their recent posts at read time and merges them into the precomputed list. Twitter described exactly this split.

**Feed storage.** A sorted set per user keyed by post id with a score of creation time (or rank). Trim to the newest 500 on insert. Memory: 300M users × 500 entries × ~16 bytes ≈ 2.4 TB across a cache cluster, acceptable; skip inactive users to cut it.

**Ranking.** Keep retrieval and ranking separate. Retrieval returns a few hundred candidates; a ranking service scores them with features (recency, author affinity, engagement velocity) and the client shows the top N. If the ranker is slow or down, fall back to chronological.

**Own posts.** Insert the author's own post into their feed synchronously so they see it immediately; everyone else can wait a few seconds.

## Bottlenecks and failure modes

- **Celebrity storms:** handled by the pull path above.
- **Inactive users:** fan-out to someone who has not opened the app in a month is wasted work. Skip them and rebuild their feed by pulling when they return.
- **Feed cache loss:** rebuild lazily on read from followees' recent posts; degrade to chronological pull.
- **Hot posts:** engagement counters (likes, comments) on viral posts are a write hotspot; aggregate them asynchronously and cache them separately from the post body.
