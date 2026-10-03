---
id: choosing-a-shard-key
deck: fundamentals
type: tradeoff
difficulty: 3
tags: [sharding, databases, scalability]
prompt: >
  You are sharding a multi-tenant SaaS database. How do you choose the shard
  key, and what goes wrong with the obvious choices?
keyPoints:
  - Start from the dominant access pattern, most queries should be answerable from a single shard
  - Tenant id keeps a customer's data together but a huge tenant becomes a hot shard that cannot be split
  - User id or hashed id spreads load but scatters per-tenant reports across every shard
  - Cardinality, write distribution and growth over time all matter, not just today's data size
  - Plan for rebalancing from day one, virtual shards or consistent hashing make moves cheap
eli5:
  - Look at the question asked most often, and split the data so one machine can answer it alone
  - Grouping by customer keeps each customer together, but one giant customer overloads its machine and cannot be divided
  - Splitting by user spreads the work evenly, but a report for one customer then has to ask every machine
  - Think about how many distinct values there are, where the writes land and how it grows, not only how big it is today
  - Assume you will have to move data later, and pick a scheme that makes moving cheap
distractors:
  - Choose the column with the fewest distinct values so that each shard stays large and easy to manage
  - A hashed user id keeps all of a tenant's rows on one shard, so tenant reports stay cheap
  - The shard key can be changed later at little cost, so optimise only for today's data size
followUps:
  - How would you handle one tenant that is 30% of all traffic?
  - What changes if the product adds cross-tenant analytics?
references:
  - title: Notion engineering, Sharding Postgres at Notion
    url: https://www.notion.so/blog/sharding-postgres-at-notion
  - title: Slack engineering, Scaling datastores at Slack with Vitess
    url: https://slack.engineering/scaling-datastores-at-slack-with-vitess/
updated: 2026-10-02
reviewed: true
---

The shard key is the one schema decision that is painful to reverse, so interviewers care about the reasoning more than the answer.

**Start from queries.** List the top five queries by volume and by latency sensitivity. A good shard key makes each of them a single-shard operation. For a SaaS app that is usually "everything for workspace X", which argues for sharding by **tenant (workspace) id**. Notion sharded by workspace id for exactly this reason.

**The hot-tenant problem.** Tenants are wildly unequal. One enterprise customer can be bigger than a thousand startups and will eventually outgrow a shard. Mitigations: hash tenants onto many *logical* shards and map logical to physical shards so a hot logical shard can be moved to its own machine; or use a compound key (`tenant_id, entity_id`) so a single tenant can span a contiguous key range across several shards while small tenants stay co-located.

**The obvious wrong answers**

- *Auto-increment id or timestamp:* all writes land on the newest shard.
- *Hashed user id:* perfectly even, but "list this workspace's documents" fans out to every shard and sorts in the application.
- *Geography:* easy to reason about, but regions have very different sizes and users move.

**Checklist**

1. High cardinality so load can spread.
2. Write distribution: no monotonic hot spot.
3. Query isolation: dominant reads hit one shard.
4. Growth: the biggest key must still fit a shard in three years, or you need a split plan.
5. Rebalancing: use consistent hashing or a directory with many virtual shards so moving data does not mean rehashing everything.

End with the operational story: double-write during migration, backfill, verify, cut reads over, then stop the old writes.
