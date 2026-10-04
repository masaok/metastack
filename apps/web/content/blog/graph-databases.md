---
slug: graph-databases
title: Graph databases for system design interviews
description: Graph databases for system design interviews. Neighbour walks that explode in SQL, the write cost you take on, and when a recursive query is enough.
primaryKeyword: graph databases
category: caching-and-storage
tags:
  - databases
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the graph databases answer an interviewer wants. Use a graph when the question is a walk: who is next to this node, and who is next to those nodes, for a few hops. Relational joins do that walk by repeating a neighbour table. The plan explodes as the hop count grows. Social, fraud, and access-control paths are the three prompts that usually justify the store. You pay at write time to keep both directions of every edge cheap to read. A property graph and a triple store are two models for the same idea. A recursive SQL query is enough when the walk is shallow and rare. That is the whole case.

## Neighbour queries that explode in SQL

A graph is nodes and edges. A node is a thing you name: a user, an account, a device, a document. An edge is a relationship you will walk: follows, paid-with, member-of, can-read. The query that matters is "start here, walk these edge types, stop at depth N."

A relational model stores the same facts as a pair table. `follows(follower_id, followee_id)` is an edge table. One hop is a join. Two hops is a join of that table to itself. Three hops is another join. Each hop multiplies the intermediate rows.

Friends of friends is the usual sketch. User 42 follows 200 people. Those people follow 200 each. The two-hop join produces tens of thousands of rows before you distinct them. A third hop is millions. Indexes on both columns help. You are still multiplying.

```sql
select f2.followee_id
from follows f1
join follows f2 on f2.follower_id = f1.followee_id
where f1.follower_id = 42;
```

That query is the two-hop walk. It is clear. It is also the shape that gets worse with every extra join. Variable-length paths, "any path of length three to five," and "does a path exist at all" are worse. You write recursion or you write more joins.

A graph store treats the edge as a first-class pointer. From node 42 it follows outgoing edges without rebuilding the neighbour set from a heap of rows at each hop. The engine is built for that expansion. Indexes exist to find a start node and to filter edge types. The walk is the plan.

[SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) already keeps graph stores secondary. The primary still owns the transaction if the write is "create a user and their first follow." The graph earns a place when the product question is the walk, not the row.

Say the hop count. One hop is a neighbour table. Two hops is a join you can still defend. Three and up, or a path that must be searched, is where you start to justify a graph.

## Social, fraud, and access paths

Three interview prompts keep coming back. They all look like walks.

Social is the follow graph. Who does this user follow. Who follows them. Who are the people those people follow. [Design news feed for the interview](/blog/design-news-feed) stores follow pairs and then fans posts out along those pairs. The feed itself is a list of post ids. You do not need a graph database to build a timeline. You need the pair table and a decision about fanout. A graph earns its place on the social product when the feature is the walk: people you may know, a mutual-friend count, a path that explains why this account is suggested. Those queries start at one node and expand. They are not a page of a precomputed list.

Fraud is a shared-entity graph. An account connects to a card, a device, an address, an IP. Another account connects to the same device. The question is how close this new account is to one you already marked bad. A warehouse join can answer a batch. The online check before a payout wants a short walk with a deadline.

Access is a permission path. A user is in groups. Groups grant roles on resources. Resources sit in folders. The question is "can this user read this document." The path may be user to group to role to folder to document. The path may be several groups deep. You can flatten some of this into an ACL cache. You still have to maintain the cache when a group changes. A graph of identities and resources makes the live question a walk. A flattened table makes it a lookup and a rebuild job.

| Prompt | Nodes | Edges | The walk |
| --- | --- | --- | --- |
| Social | Users | Follows, mutes | People you may know, mutuals |
| Fraud | Accounts, devices, cards | Used-by, paid-with | Distance to a known-bad node |
| Access | Users, groups, resources | Member-of, can-read | Does a permission path exist |

Draw one of those. Pick the start node. Draw two hops. Name the filter that stops the walk: edge type, depth, or a visited set. Interviewers want the walk, not a product logo.

Do not force a graph onto a feed or a shortener. A follow list that you iterate once per post is a neighbour read, not a path search. A short-link lookup is a key. Those stay in the stores you already chose.

## What you give up at write time

A graph that is cheap to walk is a graph you maintain. Every edge has to be written so that the walk can find it.

You write the edge in the direction you will read it. If you walk both ways, you maintain both directions, or you pay for a reverse index. `42 follows 7` is not enough if you also ask who follows 7. The pair table already has this problem. The graph store does too. The difference is that the graph store treats that reverse adjacency as part of the model.

You give up cheap multi-row transactions if the graph is a second store. The primary writes the follow. An outbox or a worker then writes the edge. The walk can lag. If the graph is the primary, you give up ad hoc SQL and you give up a planner that is good at aggregates that are not walks. Counts, payments, and listings still want a table.

Uniqueness and constraints become your job unless the store provides them. Two identical follows should be one edge. A delete of a user should delete or detach the edges. Orphan edges are the leftover that a relational foreign key would have stopped.

Write amplification is the cost you say out loud. One follow can update the out-list of the follower, the in-list of the followee, a cached mutual count, and a search index. The relational pair insert is one row and two indexes. The graph write is that plus the adjacency structures the walks need.

Hot nodes hurt more than hot rows. A celebrity user is a super-node. You bound the walk, you sample, or you keep that node's edges in a list structure. A start from "all users in this city" needs a property index. That is a table again. Admit it.

A short write story:

"The client writes the follow to Postgres. A worker updates the graph. Suggestions read the graph and may be a few seconds late. The feed does not wait for the graph. If the worker is down, follows still exist and the walk is stale."

That story keeps the source of truth honest.

## A property graph versus a triple store, briefly

Two models show up by name. You only need a minute on them.

A property graph has nodes with a label and a map of properties, and edges with a type and their own properties. `(:User {id: 42})-[:FOLLOWS {since: 2026-01-01}]->(:User {id: 7})` is the picture. Properties live on the things you walk. Queries start at a node or at an index on a property and then traverse. This is the model most system-design answers mean.

A triple store holds statements of subject, predicate, object. `user:42 follows user:7` is one triple. There is no special node record apart from the triples that mention that subject. The model fits shared vocabularies. It is the right sentence when the interviewer says RDF, not the default drawing for a feed or a fraud check.

| | Property graph | Triple store |
| --- | --- | --- |
| Unit | Node and edge, each with properties | A statement of three parts |
| Walk | Traverse edges from a start node | Query matching triples, then the next |
| Fits | Product graphs you own | Shared facts and inference |
| Say when | Social, fraud, ACL | The prompt names triples or RDF |

Both can answer "is there a path." Both need an index to start. Pick the property graph unless the prompt is about statements that many systems share.

Do not spend the hour on query-language trivia. Name a start node, an edge type, a depth, and a filter. If they ask how you write it, say a traversal. Then go back to the write path and the stale walk.

## When a relational recursive query is enough

Stay in the relational database when the walk is shallow, rare, or already bounded by a small set.

An organisation chart that is five levels deep and read on an admin page is a recursive common table expression. A bill of materials that explodes a part into its children is the same query. A thread of comments with a `parent_id` is a tree, and a tree is a graph with one parent per node. SQL handles those.

```sql
with recursive reports as (
  select id, manager_id, 1 as depth
  from staff
  where id = 42
  union all
  select s.id, s.manager_id, r.depth + 1
  from staff s
  join reports r on s.manager_id = r.id
  where r.depth < 6
)
select id from reports;
```

That query is a bounded walk. The table is small enough, or indexed on `manager_id`, and the depth cap is honest. You do not introduce a second store for it.

Enough also means the walk is not the product. A news feed iterates follows once. A permission check that you already flattened into a cached ACL is a lookup. Rebuilding that ACL when a group changes is a job. If that job is rare, keep it.

Move to a graph when several of these are true at once: the hop count is more than two, the walk runs on the request path, the edge types vary, and you will add another walk next quarter. One of those signals is not enough. Two or three are.

[SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) starts relational and adds a specialist store for a measured pain. Graph databases are that store for path queries. Feed them from the primary. Do not let the graph be the only copy of a follow you cannot rebuild.

A sentence you can reuse:

"I store the edges in Postgres. I walk one or two hops there. If the product question is a three-hop path on the request path, I add a property graph and I accept lag on the walk. I do not put the feed in the graph. I do not put the charge in the graph."

Keep the order straight.

1. Name the walk and the hop count.
2. Show why the self-join multiplies.
3. Pick social, fraud, or access as the example.
4. Say the write cost and the stale walk.
5. Stay on recursive SQL when the walk is shallow and rare.

Start on the [fundamentals study page](/study/fundamentals).
