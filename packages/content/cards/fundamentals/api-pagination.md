---
id: api-pagination
deck: fundamentals
type: tradeoff
difficulty: 1
tags: [api, databases, latency]
prompt: >
  Compare offset pagination with cursor (keyset) pagination for a list endpoint.
  When is offset acceptable?
keyPoints:
  - Offset/limit is simple and supports jumping to page N, but the database still scans and discards offset rows, so deep pages get slow
  - Inserts or deletes between requests shift offsets, causing skipped or repeated items
  - Cursor pagination encodes the last seen sort key and uses an indexed WHERE clause, giving constant cost per page and stability under writes
  - Cursors need a unique, stable sort order (tie-break on id) and make arbitrary page jumps hard
  - Offset is fine for small, slowly changing lists and admin tables, cursors for feeds and anything infinite-scroll
eli5:
  - Skipping to page fifty is easy to ask for, but the database still walks past every earlier row, so far pages are slow
  - If rows are added or removed while you page, everything shifts and you see an item twice or miss one
  - A cursor is a bookmark that says continue after this item, so every page costs the same and new rows do not shift it
  - The bookmark only works if the order never ties, and you cannot jump straight to an arbitrary page
  - Use page numbers for short lists that rarely change, and bookmarks for feeds and endless scrolling
distractors:
  - text: Cursor pagination lets a client jump straight to any page number, which offset pagination cannot do
    why: A cursor only knows the item after the last one seen, so it cannot land on an arbitrary page. Jumping to page N is what offset is good at
  - text: With an index on the sort column, the database skips the offset rows for free, so deep pages cost the same as the first
    why: An index gives the order, but the database still walks past every skipped row before returning the page
  - text: A cursor can sort on any column, even one with many duplicate values, with no tie-breaker
    why: Without a unique tie-breaker, rows that share the sort value can be skipped or repeated at a page boundary
followUps:
  - How do you encode a cursor so clients cannot tamper with it?
  - How would you paginate a result set sorted by a non-unique column like score?
references:
  - title: Use The Index, Luke, Paging through results
    url: https://use-the-index-luke.com/sql/partial-results/fetch-next-page
  - title: Slack engineering, Evolving API pagination at Slack
    url: https://slack.engineering/evolving-api-pagination-at-slack/
updated: 2026-10-02
reviewed: true
---

**Offset pagination**

```sql
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 40000;
```

The database must still produce and throw away 40,000 rows before returning 20, so page 2,000 is far slower than page 1. Worse, if a new post is inserted between two requests every subsequent offset shifts by one and the client sees a duplicate; a deletion makes it skip one. Its virtues are simplicity and the ability to show "page 7 of 52".

**Cursor (keyset) pagination**

```sql
SELECT * FROM posts
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

The client sends back an opaque cursor that encodes the sort key of the last item it saw. With an index on `(created_at, id)` the query seeks directly to that position, so every page costs the same and concurrent inserts do not shift anything. The tie-break on `id` is essential whenever the sort column is not unique.

**Costs of cursors.** No random access to page N, no total count without a separate query, and the cursor must be opaque (base64 of the key, optionally signed) so clients do not depend on its structure. Sorting by something that changes, like `score`, is tricky: use a snapshot timestamp or accept minor instability.

**When offset is acceptable.** Admin tables with a few thousand rows, search results where users rarely go past page 5, or any list that is small and changes slowly. For feeds, logs, messages and infinite scroll, use cursors.

Say the performance problem, the correctness problem, the keyset fix with its index, and the limitations you accept.
