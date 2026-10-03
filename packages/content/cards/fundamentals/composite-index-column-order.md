---
id: composite-index-column-order
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [indexing, databases]
prompt: >
  A query filters on tenant_id and status and sorts by created_at. How do you
  order the columns in a composite index, and why?
keyPoints:
  - A composite index is sorted by the first column, then the second within it, so it can only be used left to right
  - Put equality predicates first, then the range or sort column, so the index delivers rows already in the desired order
  - Here (tenant_id, status, created_at) lets the engine seek to one tenant and status and read in time order with no sort step
  - Putting the range column before an equality column forces a scan across many values and a separate sort
  - Column order also decides which other queries can reuse the index via its prefix
eli5:
  - A multi-column index is like a phone book sorted by surname then first name, so it only helps if you start with the surname
  - Put the columns you match exactly first and the one you sort or range over last, so rows come out already in order
  - In this case the database jumps to one tenant and one status and reads straight down in time order with no sorting
  - Put the range column too early and the database must wade through many values and sort afterwards
  - The order also decides which other queries can use the same index, since they must start from its first columns
followUps:
  - What if status has three values and queries often omit it?
  - How would you include a selected column to make the index covering?
references:
  - title: Use The Index, Luke, Concatenated indexes
    url: https://use-the-index-luke.com/sql/where-clause/the-equals-operator/concatenated-keys
  - title: Use The Index, Luke, Indexing ORDER BY
    url: https://use-the-index-luke.com/sql/sorting-grouping/indexed-order-by
updated: 2026-10-02
reviewed: true
---

Think of a composite index as a phone book sorted by last name, then first name. You can find all "Smiths" quickly and all "Smith, Johns" quickly, but you cannot find all "Johns" without reading the whole book. Column order determines which lookups are fast.

**The query**

```sql
SELECT id, title FROM tickets
WHERE tenant_id = ? AND status = 'open'
ORDER BY created_at DESC
LIMIT 50;
```

**The rule: equality columns first, then the range or sort column.**

Index `(tenant_id, status, created_at)`:

1. Seek to the block of entries where `tenant_id = X`.
2. Within it, seek to `status = 'open'`.
3. Those entries are already ordered by `created_at`, so read the last 50 backwards and stop. No sort, no extra rows.

Index `(created_at, tenant_id, status)`: the engine cannot seek on `tenant_id` because entries are grouped by time first. It must scan the time range (potentially all of it), filtering rows as it goes.

Index `(tenant_id, created_at, status)`: seeks to the tenant, reads in time order, but must check `status` on every entry and skip the closed ones, so a tenant with mostly closed tickets reads far more than 50 entries.

**Second-order considerations**

- *Prefix reuse.* `(tenant_id, status, created_at)` also serves `WHERE tenant_id = ?` and `WHERE tenant_id = ? AND status = ?`. Order shared prefixes so the most common queries benefit.
- *Covering.* Add `title` as an included column so the query is answered entirely from the index.
- *Low cardinality is fine* in a composite index when it follows an equality on a selective column; it still narrows the block you read.

Say the rule, show the seek, and note which other queries get a free ride.
