# Blog keyword map

One keyword, one post. The content check (`pnpm check:blog`) reads this table: every `Keyword` row must be the `primaryKeyword` of exactly one post, and every post's primary keyword must appear here.

These keywords were **derived from the project** (what MetaStack does and who the homepage is written for), not from search-volume data. No volume, difficulty or ranking numbers are claimed.

| Keyword                             | Intent  | Post title                                             | Slug                                  | Status    |
| ----------------------------------- | ------- | ------------------------------------------------------ | ------------------------------------- | --------- |
| system design interview flashcards  | do      | System design interview flashcards that actually stick | `system-design-interview-flashcards`  | published |
| spaced repetition for system design | learn   | Spaced repetition for system design: why it works      | `spaced-repetition-for-system-design` | published |
| fsrs vs sm-2                        | compare | FSRS vs SM-2: which scheduler should you study with?   | `fsrs-vs-sm-2`                        | published |
| back-of-the-envelope estimation     | do      | Back-of-the-envelope estimation for system design      | `back-of-the-envelope-estimation`     | published |
| consistent hashing explained        | learn   | Consistent hashing explained for the interview         | `consistent-hashing-explained`        | published |
| cap theorem                         | learn   | CAP theorem explained for interviews                   | `cap-theorem-explained`               | published |
| pacelc                              | learn   | PACELC explained for system design                     | `pacelc-explained`                    | published |
| rate limiting                       | learn   | Rate limiting for system design interviews             | `rate-limiting-for-interviews`        | published |
| load balancing                      | learn   | Load balancing for system design interviews            | `load-balancing-for-interviews`       | published |
| database partitioning               | learn   | Database partitioning explained simply                 | `database-partitioning-explained`     | published |
| message queues                      | learn   | Message queues for system design interviews            | `message-queues-for-interviews`       | published |
| design url shortener                | do      | Design URL shortener for the interview                 | `design-url-shortener`                | published |
| design news feed                    | do      | Design news feed for the interview                     | `design-news-feed`                    | published |
| idempotency                         | learn   | Idempotency keys in system design                      | `idempotency-keys`                    | published |
| sql                                 | compare | SQL vs NoSQL for system design interviews              | `sql-vs-nosql`                        | published |

## Rules the table encodes

- `Keyword` is lowercase and is matched case-insensitively in the post's title, description and first paragraph, and hyphenated in the slug.
- `Intent` is one of `learn`, `compare`, `do`, `buy`.
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
