---
slug: design-search-engine
title: Design search engine for the interview
description: Design search engine for the interview. Crawl, index, and query as three systems, plus typeahead as a smaller, hotter index.
primaryKeyword: design search engine
secondaryKeywords:
  - design autocomplete
category: worked-designs
tags:
  - scalability
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

When you design search engine systems for the interview, split crawl, index, and query before you name a product. Full-text search is not `LIKE`. Autocomplete is not the same index as the result page. Both are derived stores. Both lag the source of truth.

## Crawl, index, and query as three systems

A crawler finds documents. An indexer turns documents into a structure a query can intersect. A query service reads that structure and ranks a page. Those are three systems. They fail independently. They scale independently.

For a web-scale prompt, the crawler owns a frontier, politeness, and a seen-set. It fetches. It parses. It enqueues new URLs. Freshness and coverage trade off. That prompt has its own card. On a site-search prompt the "crawl" is often a change stream from your primary database. Writes still go to that database. An outbox or a stream feeds the indexer seconds later.

Do not update the search index in the same transaction as the primary write. The index is a derived store. State the lag. State how you would rebuild from scratch if the indexer falls behind or corrupts a shard.

`LIKE '%term%'` is the wrong baseline. A leading wildcard cannot use a B-tree. The engine reads every row. Even a fast scan would miss "databases", match "databaseness", and have no ranking. Say that, then draw the inverted index.

Query is a read path. It tokenises the string with the same analysis the indexer used. It looks up posting lists. It intersects. It ranks. It hydrates titles and snippets from a document store. It does not crawl. It does not write the index.

Keep the three boxes on the board even when one team owns all three. Interviewers fail answers that treat "Elasticsearch" as the system. The product is a name for the index and the query service. The crawl or the outbox is still yours.

A news feed ranks a candidate set after it retrieves ids. Search does the same job on a different candidate set. The [news feed](/blog/design-news-feed) post is the reminder that ranking stays off the storage path. Retrieval here is posting-list intersection, not a per-user list.

## The inverted index and what a document costs

An inverted index maps each term to the documents that contain it. That list is a posting list. It often carries term frequency and positions.

```text
"cache"    -> [doc3, doc17, doc42]
"eviction" -> [doc17, doc99]
```

The query `cache eviction` intersects the two lists and returns `doc17`. It does not read the other documents. Posting lists are sorted and compressed. Intersection stays cheap as the corpus grows. Positions make phrase queries and proximity scoring possible.

The forward index, if you keep one, maps a document to its terms. That is useful for highlighting and for deleting a document. It is not how a query finds candidates. The distractor on the [search-indexing card](/cards/search-indexing-basics) reverses the arrows. Do not reverse them.

Analysis runs before you write a posting. Tokenise on word boundaries. Lowercase. Strip stop words. Stem or lemmatise so "Running" and "run" meet. Add synonyms if the product needs them. Run the same pipeline on the query. Language matters. Chinese and Japanese need a dictionary or an n-gram tokeniser. An English whitespace split is not a universal plan.

What a document costs is the work to analyse it plus the postings you append. A short title writes a handful of terms. A long body writes many, and it writes positions if you want phrases. Those postings land on the shards that own those terms, or on the shard that owns the document, depending on how you partition.

Partition the index the way you would partition any large store. A document-sharded index puts all terms for one document on one shard. A query then fans out to many shards and merges. A term-sharded index puts one term's list in one place and makes intersection a cross-shard join. Interviewers usually expect document sharding plus a merge. The [database partitioning](/blog/database-partitioning-explained) post is the neighbouring vocabulary. Hash the document id. Watch the celebrity document that is huge, not the celebrity user.

Deletes and updates are new work, not edits in place. Mark a document deleted. A later merge drops its postings. An update is a delete plus a new document id, or an in-place replace if your engine supports it. Either way the primary database already has the new body. The index catches up.

## Ranking that is allowed to be eventually consistent

The index is fed asynchronously. A document that just wrote to the primary may be missing from results for a short window. Say that window. Say that a user who just published should see their own document immediately, the same way a feed shows the author's own post before fan-out finishes. A read-through of the primary for that author's recent ids is enough.

Relevance is not a filter. TF-IDF rewards a term that appears often in the document and rarely in the corpus. "The" is worth nothing. A rare technical term is worth a lot. BM25 adds saturation so the tenth occurrence counts less than the second, and length normalisation so a match in a short title beats a match in a long body. You can name those two families and stop. Implementing BM25 from memory is not the point.

Business signals sit on top. Recency. Popularity. A penalty for thin pages. Those signals can be stale too. A popularity counter that lags by minutes is fine for ranking. It is not fine as a stock count.

Do not put ranking inside the posting-list store as a write-time score you never revisit. Scores depend on corpus statistics. Those statistics move. A periodic job, or a score computed at query time from stored frequencies, is the honest story.

Eventual consistency is allowed because search is a derived view. Orders, balances, and unread counts are not this store. If the prompt needs a result to appear in the same transaction as the write, you are no longer designing search. You are designing a primary read.

When the indexer falls behind, serve stale results and page the lag. Do not block writes to the primary. Rebuild from the primary or from a snapshot plus the stream when a shard is wrong. That rebuild is why the outbox matters. A lost event you cannot replay becomes a silent hole.

Near-real-time is the honest label. A document can appear in seconds. It is not in the same commit as the row. If the interviewer wants "immediately searchable," offer the author's own ids from the primary and keep the public index async.

## Typeahead as a smaller, hotter index

Typeahead is how you design autocomplete in the same interview. It is not the inverted index with a prefix query tacked on. It is a smaller, hotter structure built for prefixes.

The product returns the top ten suggestions for a typed prefix, ranked by popularity, in under 100 ms including the network. Popularity should follow recent behaviour. Offensive or private strings must never appear.

Do not scan the query log on each keystroke. Precompute a prefix to top-k map. A trie with the top ten completions stored on each node makes lookup proportional to the prefix length. A flat table of `prefix → [top-k]` is the other shape. Both are built offline from aggregated query counts with time decay.

The [typeahead-suggestions card](/cards/typeahead-suggestions) sizes the load from 10 million searches a day and about five keystrokes each. That is about 50 million prefix lookups a day, about 600 a second on average, and a few thousand a second at peak. A vocabulary of about 100 million distinct queries, with top-k stored per prefix, is tens of gigabytes. It fits in memory on a small cluster.

The online path is a CDN or edge cache, then an in-memory suggestion service sharded by prefix. The client debounces 50 to 100 ms and cancels stale requests. Responses depend only on the prefix, so they cache. Hot prefixes such as a single letter are mostly absorbed at the edge.

A streaming layer counts the last few minutes so a suddenly popular term appears before the next hourly build. Merge that small list at serve time. Do not rebuild the trie on every search.

Personalisation is a client re-rank or a prepend of the user's own recent queries. Keep the global list cacheable. A per-user cache key destroys the hit rate that makes this design cheap.

Typo tolerance and mid-word match are follow-ups. They are extra structures or a fuzzy layer, not a reason to compute top-k at request time.

## What the search-indexing card already asks you to say

The [search-indexing-basics card](/cards/search-indexing-basics) asks how full-text search works and why you would not just use SQL `LIKE`.

`LIKE '%term%'` cannot use a B-tree. It scans every row. It knows nothing about word boundaries, stemming, or relevance.

An inverted index maps each term to the list of documents, and often positions, that contain it. A query intersects short posting lists.

Analysis tokenises, lowercases, strips stop words, and stems so "Running" matches "run".

Relevance scoring, TF-IDF or BM25, ranks documents by how rare and how frequent matching terms are, with length normalisation.

The search index is a derived store fed asynchronously from the primary database. It is eventually consistent.

Follow-ups on that card. How you keep the index in sync, and what happens when the indexer falls behind. How you would support typo tolerance or prefix matching. The sync answer is the outbox and the rebuild. The prefix answer is the typeahead design, not a `LIKE 'pre%'`.

The typeahead card then asks you to design autocomplete that returns the top ten suggestions for a prefix within 100 ms, updated from recent query popularity. Serve a precomputed structure. Separate the offline aggregation from the online read. Shard by prefix and replicate. Cache at the edge and in the browser. Debounce. Rebuild on a schedule. Add a small real-time layer for trending terms. Filter offensive content at build time.

Start on the [classic designs study page](/study/designs). Run the indexing card until the inverted index and the lag sentence come out clean. Run the typeahead card until the precomputed top-k and the edge cache come out next. Then [open the study page](/study) and keep both in the same week.
