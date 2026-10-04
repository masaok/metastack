---
slug: database-indexing
title: Database indexing for system design interviews
description: Database indexing for system design interviews. What a B-tree buys you, why column order matters, and the write cost you name before you add another index.
primaryKeyword: database indexing
category: data-and-consistency
tags:
  - databases
  - consistency
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the database indexing answer an interviewer wants. An index is a separate structure that turns a scan of every row into a short walk to the matching ones. You add one because a named query is too slow without it. You name the write cost in the same breath. You order the columns so the walk can start. You skip the index that would return half the table. The rest of this post is that sentence, B-tree versus hash, the composite that misses, the write tax, and the covering index you actually keep.

## What an index is for, in one sentence

An index exists so a query can find matching rows without reading the whole table.

Say that first. Then say what the query is. `WHERE email = ?` on a users table with no index reads every row. The engine compares the email on each one and throws the rest away. An index stores the email values in an ordered structure and keeps a pointer to the heap row, or to the primary-key value that finds it. The same filter then walks a few pages and stops.

The sentence is not "indexes make reads fast". Plenty of indexes do not. A filter that matches most of the table still has to visit most of the rows. The planner may ignore the index and scan anyway. The sentence is about the job, not a guarantee. The job is to replace a full read with a seek plus a short range.

Keep the index next to the access pattern. [SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) starts from the key the caller already holds. The index is how a relational table answers that key, and how it answers the next filter you invent after launch. A document store and a key-value store still have indexes. The interview default is still the B-tree on a table you can name.

Start from the clause. Equality. Range. Sort. The columns those clauses touch. If you cannot point at the clause, you do not yet know whether you need an index.

[The database indexes card](/cards/database-indexes) asks how a B-tree speeds a query and what it costs. The one-sentence job is the first half. The cost is later in this post. Tick the job only when you said it without the word "always".

A tiny table that already fits in a few pages does not need this structure. The scan is the whole table. Say that when the interviewer hands you a lookup of twenty rows.

## B-tree versus hash, and when each wins

A B-tree keeps keys sorted in a balanced tree of pages. Fan-out is high, so a large table is still only a few levels deep. A lookup walks from the root to a leaf. That walk is logarithmic in the number of keys. Leaves are linked, so a range continues along the leaf chain. `BETWEEN`, `>`, prefix match, and `ORDER BY` on the same columns ride that chain. The engine does not rebuild the sort. It reads in the order the tree already has.

A hash index maps a key to a bucket. An equality lookup is a hash and a probe. There is no order among keys. A range has to fall back to something else. `ORDER BY` has to sort. A prefix query has nothing to walk. Hash wins only when every use of that column is an exact match and you will not later ask for a range on it.

| Kind | What a lookup does | Ranges and sort | A query that fits |
| --- | --- | --- | --- |
| B-tree | Walk root to leaf, then along linked leaves | Yes. The leaves already have order | `email = ?`, `created_at BETWEEN ? AND ?`, `ORDER BY created_at` |
| Hash | Hash the key and open one bucket | No. Buckets have no order | `session_id = ?` and nothing else on that column |

Offer the B-tree as the default. Interviewers expect that default. Name hash as the exception for a pure equality path. Session tokens, device ids used only as exact keys, and a lookup table keyed by a UUID you never range over are the usual examples. The moment someone asks for "the last twenty sessions for this user", you wanted a B-tree on `(user_id, created_at)`, not a hash on `session_id`.

Do not claim constant time for a B-tree. The walk is a handful of page reads. That handful does not grow like a scan, and it is not one probe. Do not claim a hash can satisfy `ORDER BY`. If you need both exact match and order, you need the sorted structure.

Write-heavy engines sometimes store data in an LSM tree. That is a storage engine choice, not a second index type for the first drawing. The contrast on the board is ordered leaves versus hashed buckets.

## Composite order and the query that misses

A composite index is one structure sorted by the first column, then the second inside that, then the third. It can be used from the left. It cannot be entered in the middle. The phone-book picture is enough. You can find every Rivera. You can find Rivera, Ana. You cannot find every Ana without reading the book.

Equality columns go first. The range or the sort column goes last. That order lets the engine seek to one group and then read that group already sorted.

Take a comments table. The product shows the newest open comments for one post.

```sql
SELECT id, body
FROM comments
WHERE post_id = ? AND state = 'open'
ORDER BY created_at DESC
LIMIT 30;
```

Index `(post_id, state, created_at)` seeks to one post, then to `open`, then reads backward along `created_at`. Thirty entries and it can stop. No extra sort. No visit to closed comments for that post.

Index `(created_at, post_id, state)` is sorted by time first. The open comments for one post are scattered across the whole index. The engine cannot seek to the post. It scans time, checks `post_id` and `state` on the way, and sorts what remains. That is the query that misses. The index exists. The query cannot enter it where it needs to.

Index `(post_id, created_at, state)` seeks to the post and reads in time order. It still checks `state` on every comment. A post with mostly closed comments walks far more than thirty entries. The sort is free. The filter is not.

| Index | Seek | What you still do | Fits this query? |
| --- | --- | --- | --- |
| `(post_id, state, created_at)` | One post, then open | Read 30 in time order | Yes |
| `(post_id, created_at, state)` | One post | Skip closed rows while walking time | Weak |
| `(created_at, post_id, state)` | Nothing useful | Scan and filter | No |

[The composite index column order card](/cards/composite-index-column-order) uses a tenant and a status. Same rule. Different table. Say the rule, then show the seek. Then name the query that cannot use the index because it starts on a column that is not a prefix.

Prefix reuse is the second reason order matters. `(post_id, state, created_at)` also serves `WHERE post_id = ?` and `WHERE post_id = ? AND state = ?`. It does not serve `WHERE created_at > ?` alone.

Low cardinality is fine in the middle when a selective equality sits in front of it. `state` may have three values. After `post_id` it still cuts the block. Alone, those three values are a bad index.

## The write cost you must say out loud

Every insert, update, and delete maintains the table and each index that mentions a changed column. Say that before you add the next index. Interviewers listen for it. A silent add looks like a free read win.

The write does more than append a pointer. The B-tree may split a page. The split can cascade. A wide key makes a fat leaf. A fat leaf splits sooner. An update that changes an indexed column deletes the old entry and inserts a new one. A delete removes the table row and the entry in every index.

Storage grows with each index. An index on a long text column can rival the table. You pay that space on disk and in the buffer pool. Pages that used to hold rows now share the cache with copies of those keys.

The planner has more shapes to consider. Stale statistics pick a bad one. That is not a reason to avoid indexes. It is a reason not to spray them on every column "just in case".

Write-heavy tables with rare reads are the place you refuse. An append-only event log that is scanned in large ranges by a batch job may want a different shape, or no secondary index at all. A table that is the source of truth for a checkout still wants the index that the checkout uses. [Database partitioning explained simply](/blog/database-partitioning-explained) is the next move when one machine cannot hold the writes even after you have been honest about indexes. Partitioning splits rows. It does not remove the need for an index on each piece.

A worked cost you can redo on a board. One users table. Primary key on `id`. Secondary indexes on `email`, on `created_at`, and on `(account_id, created_at)`. An insert writes the heap row, or the primary-key leaf, then three more leaves. Count the structures out loud. Four places for a new user. That count is the tax. Do not invent a percentage. The interviewer did not give you one.

## Covering indexes and the ones you skip

A covering index holds every column the query needs. The engine never visits the table. That is an index-only scan. For the comments query, include `body` if you select it and you have decided the extra width is worth it. The seek stays the same. The extra column rides along in the leaf.

Covering is a width trade. A narrow index stays cheap to write and cheap to cache. A covering index that copies half the row is a second table. Use it for a hot path that always asks for the same small set of columns. Skip it when the selected list keeps growing.

Skip an index on a column with almost no selectivity. `is_active` on a table where most rows are active returns a huge fraction of the table. The engine will often scan. The index still slows writes. A composite that starts with a selective equality and then includes `is_active` is a different thing. The flag alone is not.

Skip an index on a table that already lives in a few pages. The scan is cheaper than the seek plus the bookmark lookup. Skip an index on a column that is written on every request and read once a week. Build it if that weekly read is a report you cannot afford to scan. Otherwise leave it.

A partial index with `WHERE state = 'open'` keeps only the open rows. Closed rows do not bloat the leaves. Writes to closed rows skip that index.

What you say in the room, in order.

1. An index exists so this query does not scan the table.
2. Default to a B-tree. Use a hash only for pure equality with no range and no sort.
3. Composite order is left to right. Equality first. Range or sort last.
4. Show the query that misses because it starts on a non-prefix column.
5. Every write updates every relevant index. Say the extra writes.
6. Cover when the selected columns are stable and few. Skip low-selectivity, tiny, and write-only cases.

Drill [the database indexes card](/cards/database-indexes) until the cost comes out with the benefit. Drill [the composite order card](/cards/composite-index-column-order) until you can draw the seek. Start on the [fundamentals study page](/study/fundamentals).
