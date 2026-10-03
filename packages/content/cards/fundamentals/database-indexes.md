---
id: database-indexes
deck: fundamentals
type: concept
difficulty: 1
tags: [databases, indexing]
prompt: >
  How does a B-tree index speed up a query, and what does it cost? When would
  you not add an index?
keyPoints:
  - A B-tree keeps keys sorted in a balanced tree so lookups and range scans are O(log n) page reads instead of a full table scan
  - Every index must be updated on insert, update and delete, so writes slow down and storage grows
  - Covering indexes include all needed columns so the query never touches the table
  - Low-selectivity columns, tiny tables and write-heavy tables with rare reads often do not justify an index
  - Hash indexes give O(1) equality lookups but no range or ordering support
eli5:
  - An index is a sorted lookup tree, like the index of a book, so finding rows takes a few hops instead of reading every page
  - Every change to the table must also update each index, so writes get slower and more space is used
  - If the index already holds every column the query wants, the table itself is never opened
  - An index is not worth it when most rows match, when the table is tiny, or when the table is written constantly and rarely read
  - A hash index finds exact matches in one step but cannot do ranges or sorted output
distractors:
  - text: Indexes speed up writes as well as reads, because the database finds the row to change faster
    why: Every index must also be updated on each insert, update and delete, so more indexes mean slower writes
  - text: A B-tree lookup is O(1) regardless of table size
    why: A B-tree lookup walks from root to leaf, which is O(log n) page reads
  - text: A hash index is the right choice for range scans and ORDER BY
    why: A hash index has no order, so it serves equality lookups only
followUps:
  - Why can a query planner choose a full scan even when an index exists?
  - How does an LSM tree differ from a B-tree for write-heavy workloads?
references:
  - title: Use The Index, Luke, Anatomy of an SQL index
    url: https://use-the-index-luke.com/sql/anatomy
  - title: PostgreSQL docs, Indexes
    url: https://www.postgresql.org/docs/current/indexes.html
updated: 2026-10-02
reviewed: true
---

Without an index, `WHERE email = ?` reads every row of the table. An index is a separate structure that stores the indexed column values in sorted order along with pointers to the rows.

**B-tree mechanics.** Keys live in fixed-size pages arranged as a balanced tree with a very high fan-out (hundreds of children per node), so even a billion rows is only three or four levels deep. A lookup descends from the root to a leaf in a handful of page reads, and because leaves are linked in order, `BETWEEN`, `ORDER BY` and prefix queries can walk the leaf chain without visiting the tree again.

**What it costs**

- Every write updates the table and each index; page splits can cascade.
- Storage: an index on a wide column can rival the table in size.
- Planner complexity: more indexes means more candidate plans and stale statistics hurt more.

**When not to index**

- A column with few distinct values (`is_active`) where the index would return half the table anyway; a sequential scan is cheaper.
- Tables small enough to fit in a few pages.
- Columns written constantly but queried rarely.

**Variants worth naming.** A *composite* index on `(user_id, created_at)` serves queries that filter on `user_id` and sort by time. A *covering* index also stores the columns the query selects, so the table is never touched (index-only scan). *Partial* indexes cover only rows matching a predicate. *Hash* indexes answer equality in O(1) but cannot do ranges. *LSM trees* trade read amplification for sequential writes and are the engine behind Cassandra, RocksDB and LevelDB.

The crisp version: "an index turns a scan into a tree walk, costs you on every write, and should mirror your hottest `WHERE` and `ORDER BY` clauses."
