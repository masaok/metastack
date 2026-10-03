# Blog keyword map

One keyword, one post. The content check (`pnpm check:blog`) reads this table: every `Keyword` row must be the `primaryKeyword` of exactly one post, and every post's primary keyword must appear here. The row's `Category` must match the post's.

These keywords were **derived from the project** (what MetaStack does and who the homepage is written for), not from search-volume data. No volume, difficulty or ranking numbers are claimed.

| Keyword                             | Intent  | Category                | Post title                                             | Slug                                  | Status    |
| ----------------------------------- | ------- | ----------------------- | ------------------------------------------------------ | ------------------------------------- | --------- |
| system design interview flashcards  | do      | study-method            | System design interview flashcards that actually stick | `system-design-interview-flashcards`  | published |
| spaced repetition for system design | learn   | study-method            | Spaced repetition for system design: why it works      | `spaced-repetition-for-system-design` | published |
| fsrs vs sm-2                        | compare | study-method            | FSRS vs SM-2: which scheduler should you study with?   | `fsrs-vs-sm-2`                        | published |
| back-of-the-envelope estimation     | do      | worked-designs          | Back-of-the-envelope estimation for system design      | `back-of-the-envelope-estimation`     | published |
| consistent hashing explained        | learn   | data-and-consistency    | Consistent hashing explained for the interview         | `consistent-hashing-explained`        | published |
| cap theorem                         | learn   | data-and-consistency    | CAP theorem explained for interviews                   | `cap-theorem-explained`               | published |
| pacelc                              | learn   | data-and-consistency    | PACELC explained for system design                     | `pacelc-explained`                    | published |
| rate limiting                       | learn   | traffic-and-reliability | Rate limiting for system design interviews             | `rate-limiting-for-interviews`        | published |
| load balancing                      | learn   | traffic-and-reliability | Load balancing for system design interviews            | `load-balancing-for-interviews`       | published |
| database partitioning               | learn   | data-and-consistency    | Database partitioning explained simply                 | `database-partitioning-explained`     | published |
| message queues                      | learn   | traffic-and-reliability | Message queues for system design interviews            | `message-queues-for-interviews`       | published |
| design url shortener                | do      | worked-designs          | Design URL shortener for the interview                 | `design-url-shortener`                | published |
| design news feed                    | do      | worked-designs          | Design news feed for the interview                     | `design-news-feed`                    | published |
| idempotency                         | learn   | traffic-and-reliability | Idempotency keys in system design                      | `idempotency-keys`                    | published |
| sql                                 | compare | data-and-consistency    | SQL vs NoSQL for system design interviews              | `sql-vs-nosql`                        | published |

## Rules the table encodes

- `Keyword` is lowercase and is matched case-insensitively in the post's title, description and first paragraph, and hyphenated in the slug.
- `Intent` is one of `learn`, `compare`, `do`, `buy`.
- `Category` is a slug from `CATEGORIES` in `apps/web/src/lib/blog/schema.ts` and equals the post's `category`. Choose it here, with the keyword, before the post is written.
- `Slug` is the file name under `apps/web/content/blog/` and the path under `/blog/`.
- `Status` is `planned` until the post file exists with `draft: false`, then `published`.

## Grouped or deferred

The first five rows were derived from the project. The ten rows added on 2026-10-02 come from the supplied keyword list. `claude_fable51_keywords.md` was empty, so it contributed nothing.

Grouped onto one post, because they ask the same question:

- `cap theorem` also carries `consistency`, `eventual consistency`, and `strong consistency`.
- `rate limiting` also carries `design rate limiter`.
- `database partitioning` also carries `sharding` and `partitioning`.
- `message queues` also carries `pub sub`.
- `idempotency` also carries `idempotency keys`.
- `sql` also carries `nosql`, `relational databases`, `document databases`, and `key value stores`.

`pacelc` stays its own post. It is the question you answer when the network is healthy, which CAP does not cover.

Left for a later run: the rest of the supplied list, including `caching`, `replication`, `microservices`, `design chat system`, and `design distributed cache`.
