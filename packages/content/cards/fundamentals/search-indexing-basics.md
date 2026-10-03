---
id: search-indexing-basics
deck: fundamentals
type: concept
difficulty: 2
tags: [search, indexing, data-structures]
prompt: >
  How does full-text search work under the hood, and why not just use SQL LIKE?
  Explain inverted indexes, analysis and relevance scoring.
keyPoints:
  - LIKE '%term%' cannot use a B-tree and scans every row, and it knows nothing about word boundaries, stemming or relevance
  - An inverted index maps each term to the list of documents (and positions) containing it, so a query intersects short posting lists
  - Analysis tokenises, lowercases, strips stop words and stems so "Running" matches "run"
  - Relevance scoring (TF-IDF, BM25) ranks documents by how rare and how frequent matching terms are, with length normalisation
  - The search index is a derived store fed asynchronously from the primary database, so it is eventually consistent
eli5:
  - Hunting for a word in the middle of text makes the database read every row, and it has no idea about word forms or which results are best
  - A search index works like the index at the back of a book, listing for each word the documents that contain it
  - Text is first cut into words, lowercased, stripped of filler words and trimmed to word roots, so different forms of a word match
  - Results are ranked higher when the matching words are rare overall and frequent in that document, adjusted for document length
  - The search index is a copy fed from the main database a moment later, so it can be slightly behind
followUps:
  - How do you keep the search index in sync with the database, and what happens when the indexer falls behind?
  - How would you support typo tolerance or prefix matching?
references:
  - title: Elasticsearch docs, Text analysis overview
    url: https://www.elastic.co/guide/en/elasticsearch/reference/current/analysis-overview.html
  - title: Wikipedia, Okapi BM25
    url: https://en.wikipedia.org/wiki/Okapi_BM25
updated: 2026-10-02
reviewed: true
---

**Why `LIKE` fails.** `WHERE body LIKE '%database%'` has a leading wildcard, so no B-tree can help and the engine reads every row. Even if it were fast, it would not match "databases", would match "databaseness", and would have no idea which of ten thousand hits is most relevant.

**Inverted index.** Think of the index at the back of a book. For every term, store a *posting list* of document ids that contain it, often with term frequency and positions:

```text
"cache"    -> [doc3, doc17, doc42]
"eviction" -> [doc17, doc99]
```

The query `cache eviction` intersects two posting lists and returns `doc17` without touching the other documents. Posting lists are sorted and compressed, so intersections are fast even with millions of documents. Positions enable phrase queries ("cache eviction" adjacent) and proximity scoring.

**Analysis.** Before indexing, text goes through a pipeline: tokenise on word boundaries, lowercase, remove stop words ("the", "of"), stem or lemmatise ("running" → "run"), maybe add synonyms. The same pipeline is applied to the query so both sides agree. Language matters: Chinese and Japanese need dictionary or n-gram tokenisers.

**Relevance.** TF-IDF rewards documents where the term appears often (TF) and penalises terms that appear in every document (IDF, so "the" is worth nothing and "idempotency" is worth a lot). BM25 refines this with saturation (the tenth occurrence counts less than the second) and length normalisation (a match in a short title beats one in a long body). Systems then layer business signals such as recency or popularity on top.

**Architecture.** Search engines (Elasticsearch, OpenSearch, Typesense, Meilisearch) are secondary stores. Writes go to the primary database; a change stream or outbox feeds an indexer that updates the search index seconds later. State that lag explicitly and how you would reindex from scratch.
