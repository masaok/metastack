---
id: sql-vs-nosql
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [databases, scalability, consistency]
prompt: >
  When would you choose a relational database over a NoSQL store, and vice
  versa? Give concrete signals, not slogans.
keyPoints:
  - Relational wins when data is highly connected, queries are ad hoc, and you need multi-row transactions and constraints
  - Document stores fit aggregates that are read and written as a unit with a flexible or evolving shape
  - Wide-column and key-value stores fit huge write volume with known access patterns and simple lookups by key
  - Horizontal scaling is possible for both now, so the real differences are query flexibility versus access-pattern-driven modeling
  - Start relational by default and introduce a specialised store for a specific, measured pain
eli5:
  - Relational tables win when data is richly linked, questions are unpredictable, and several rows must change together or not at all
  - Document stores suit a bundle of data that is always read and saved as one piece and whose shape keeps changing
  - Key-value and wide-column stores suit a flood of writes where you already know exactly how you will look things up
  - Both kinds can now spread over many machines, so the real difference is free-form questions versus designing around known lookups
  - Begin with a relational database, and add a specialised store only for a problem you have measured
followUps:
  - How does designing a DynamoDB table differ from designing a Postgres schema?
  - When does a graph database earn its place?
references:
  - title: AWS docs, NoSQL design for DynamoDB
    url: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html
  - title: Martin Fowler, Aggregate oriented database
    url: https://martinfowler.com/bliki/AggregateOrientedDatabase.html
updated: 2026-10-02
reviewed: true
---

"SQL vs NoSQL" is really "query-flexible normalised data vs access-pattern-shaped denormalised data". Both scale now; pick by how you will read and write.

**Choose relational when**

- Entities are connected many ways and you will query them in ways you have not thought of yet (reporting, admin tools, analytics).
- You need transactions that touch several rows or tables (move money, reserve inventory and create an order).
- Constraints matter: uniqueness, foreign keys, check constraints enforced by the database rather than every code path.
- Data volume fits one primary with read replicas, which covers most products far longer than people expect.

**Choose a document store when**

- A natural aggregate (an order with its line items, a user profile with settings) is always read and written together.
- The shape varies by record or evolves quickly and migrations are painful.
- You still want secondary indexes and reasonably rich queries within a document.

**Choose wide-column or key-value when**

- Write throughput or data size is beyond a single node and you know the handful of access patterns up front.
- Lookups are by a key you can always provide (user id, device id, time bucket).
- You can accept eventual consistency or tunable consistency per operation.

**Choose a graph or search engine** for traversals (friends-of-friends, dependency chains) or full-text relevance respectively, as a secondary store fed from the primary.

**Signals that you chose wrong.** Joining collections in application code; tables with JSON blobs you query with `LIKE`; a NoSQL table whose partition key changes every quarter.

Recommend: start with Postgres, add caches and replicas, and introduce a purpose-built store when a measured access pattern demands it.
