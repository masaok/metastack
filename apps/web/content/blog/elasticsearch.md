---
slug: elasticsearch
title: Elasticsearch for system design interviews
description: Elasticsearch for system design interviews. The inverted index, relevance versus exact match, and why the search cluster sits beside the source of truth.
primaryKeyword: elasticsearch
category: caching-and-storage
tags:
  - search
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the Elasticsearch answer an interviewer wants. Elasticsearch is a search engine you put beside the source of truth, not in place of it. Writes still land in the primary store. An indexer copies documents into an inverted index so a later query can rank by relevance. The cluster is near-real-time, not transactional. You say that lag, how you rebuild, and the failures that take a shard offline. The rest of this post is the index you already drew, scored match versus exact filter, the refresh window, the feed from the primary, and the outages interviewers keep asking about.

## The inverted index you already drew

You have already drawn an inverted index on another prompt. A term points at the documents that contain it. That list is a posting list. It often carries a frequency and the positions of the term inside the document. Elasticsearch stores those lists, shards them, and answers a query by intersecting them.

A catalog search is a clean sketch. The primary row is a product. The searchable text is a title and a description.

```text
"wool"  -> [sku_12, sku_88]
"coat"  -> [sku_88, sku_201]
```

The query `wool coat` looks up two lists and intersects them. `sku_88` is the hit. The engine does not read every product row. It does not run `LIKE '%wool%'`. A leading wildcard cannot use a B-tree, so a relational scan would read the table and still know nothing about word forms or rank.

Analysis happens before a posting is written. The title is split on word boundaries, lowercased, and often stemmed so `Coats` and `coat` meet. The same pipeline runs on the query. If the two sides disagree, a well-typed search returns nothing. An English whitespace split is the wrong plan for a Chinese catalog.

New documents land in memory, then flush into an immutable segment. A merge later rewrites segments. A delete is a mark. An update is a delete plus a new document. You do not edit one posting in place.

The cluster splits the corpus across shards. Interviewers usually expect document sharding. All terms for one product live on the shard that owns that product id. A query fans out, then a coordinating node merges the top results. [Database partitioning explained simply](/blog/database-partitioning-explained) is the neighbouring vocabulary. Hash the document id. Watch the huge document, not the celebrity user.

`_source` is how you return a title after the posting lists have named the ids. Retrieval and hydration are two steps. Draw the arrows term to documents. The distractor reverses them and describes a forward index, which is useful for highlighting and useless for finding candidates.

## Relevance versus exact match

A search box and a SKU lookup are different questions. Elasticsearch can answer both. You must not use the same field mapping for both.

A `text` field is analysed. `Red wool coat` becomes tokens. A query on that field scores. BM25 is the usual rank: frequent in this document, rare in the corpus, with saturation and length normalisation. Name that family and stop.

A `keyword` field is not analysed. A filter on `status: published` or `sku: sku_88` is an exact match. It does not stem. It does not score.

Query context scores. Filter context does not. Put the user's words in a query. Put the facet, the tenant, and the stock flag in a filter. Scores are not a substitute for a predicate you can defend.

| Need | Field | Context | What you get |
| --- | --- | --- | --- |
| Typed words in a title | `text` | Query | A ranked page |
| SKU, status, tenant | `keyword` | Filter | An exact include or exclude |
| Price or date range | numeric or date | Filter | A bounded set, no rank |
| Phrase in a body | `text` with positions | Query | Adjacent tokens, then a score |

The same product needs both. The title is `text`. The SKU and category id are `keyword`. Price is a number you filter. Do not store the SKU as `text`. Analysis will split `sku_88`, and the exact lookup fails.

Relevance is allowed to be wrong in a way a payment cannot. The tenth result can be a slightly worse coat. A missing exact filter can show another tenant's product. Treat tenancy as a filter you cannot skip. Treat rank as a quality problem you can iterate.

Business signals sit on top of BM25. Recency. Popularity. Those can lag. A popularity counter that is a few minutes behind is fine for rank. It is not a stock count. Re-check stock at add-to-cart.

"I analyse the title and I score it. I filter on tenant, status, and SKU as exact values. Rank can be a few minutes stale. The filter that hides another tenant's document cannot."

## Near-real-time, not transactional

Elasticsearch makes a document searchable after a refresh, not after the primary commit. Near-real-time is the honest label. A default refresh is on the order of a second. You can lengthen it for a bulk index. You cannot make the search shard join the Postgres transaction.

Walk the gap. The catalog service writes `sku_88`. The commit returns. The outbox has not been published, or the indexer has not refreshed. A search for `wool coat` misses `sku_88`. That is expected. State the window.

The seller who just saved a draft should see their own document immediately. Read those ids from the primary. Merge them into the result page. Public search stays on the index.

`refresh=wait_for` makes that one document visible before the HTTP response. It does not join the primary transaction. Use it on an admin save if you must. Do not put it on checkout or on every product write in a burst.

A replica and a translog protect an Elasticsearch write that already arrived. They do not protect the product row that never reached the indexer. If the primary committed and the publisher died, the cluster is consistent with itself and wrong relative to the catalog. Rebuild from the primary.

Deletes lag too. A taken-down listing can still rank until the delete is refreshed. If a legal takedown cannot wait, the request path must check the primary, or a small deny list, before it returns the hit.

Do not sell Elasticsearch as a system of record that happens to search. The moment money, inventory, or a unique constraint matters, you are back in the primary.

## How it sits next to the source of truth

Draw two stores. The primary accepts the write. Elasticsearch accepts a copy.

The write path is:

1. The API writes the product in the primary.
2. The same transaction writes an outbox row, or the database emits a change event.
3. A publisher or a stream consumer upserts the search document.
4. A refresh makes it visible to queries.

A crash after step 1 and before step 3 is a missing document, not a missing product. Replay inserts it. A crash after the index write can index twice. An upsert by product id makes that safe.

Reindex is required. Mapping changes. A bad analyser ships. You rebuild from the primary, or from a snapshot plus the stream, into a new index. You alias the query path when it is warm. You do not mutate field types in place.

[SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) already keeps search engines secondary. Feed them from the primary. Elasticsearch is the relevance engine you add when the question is full-text rank. It is not the store you pick because someone said NoSQL.

Keep unique constraints, money, and multi-row transactions in the primary. Elasticsearch can store a projection of an order for "find my purchases by a word in the gift note." The order and the payment row do not live there.

```text
Client
  -> Catalog API
      -> Postgres (products, outbox)
      -> Outbox publisher
          -> Elasticsearch (products index)
  -> Search API
      -> Elasticsearch
      -> Postgres (hydrate or author-own reads)
```

Hydration is a choice. Return `_source` when the card is title and score. Return ids and load the primary when the card must show live stock.

When the indexer falls behind, keep taking writes on the primary. Page the lag. Serve stale results. A blocked checkout because search is down is a drawing that failed.

## Failure modes interviewers like

Interviewers like failures that follow from the placement you just drew. Name the failure. Name what the user sees. Name the repair.

Heap pressure is the first. Field data, query caches, and a burst of unique terms blow the JVM heap. The node stalls, then dies. Bound aggregations. Review the mapping. Circuit breakers fail one query so the node survives. They are not a capacity plan.

Mapping explosion is the second. Arbitrary keys, one field per user-defined attribute, create thousands of fields. Dynamic mapping on an unknown JSON blob is how you get there. Flatten the attributes, or keep free-form text in one analysed field.

Yellow and red are the third. Yellow means a replica is missing. Reads still work. Red means a primary is unassigned. That slice does not answer. You add a node, free disk, or restore. Eventual consistency is about document lag. Red is about a shard that is not there.

Split brain is the fourth. Two sides of a partition both accept writes. Modern Elasticsearch elects with a majority of master-eligible nodes. Provision three. Do not run a one-node cluster and claim it survives a loss.

Refresh storms, a hot shard, and a silent hole finish the list. Waiting for refresh on every write turns a bulk import into a segment storm. One shard or one coordinating node can melt. Partition on document id and add replicas for reads. A dropped event is a product that exists and a search that never heard. Replication inside the cluster will not fix a document that never arrived. Replay the outbox. Sample primary ids against the index.

Keep the order straight.

1. Draw the inverted index and shard it by document id.
2. Score analysed text. Filter exact fields.
3. Call the cluster near-real-time. Refuse a shared transaction with the primary.
4. Feed it from an outbox. Rebuild with an alias.
5. Name heap, mapping explosion, red shards, and a dropped event.

Speak the primary first. Speak the copy second. Drill the [search-indexing card](/cards/search-indexing-basics) until the inverted index and the lag come out before the logo. Start on the [fundamentals study page](/study/fundamentals).
