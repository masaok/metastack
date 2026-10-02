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

## Rules the table encodes

- `Keyword` is lowercase and is matched case-insensitively in the post's title, description and first paragraph, and hyphenated in the slug.
- `Intent` is one of `learn`, `compare`, `do`, `buy`.
- `Slug` is the file name under `apps/web/content/blog/` and the path under `/blog/`.
- `Status` is `planned` until the post file exists with `draft: false`, then `published`.

## Grouped or deferred

Nothing grouped in this run. Candidate keywords for a later run, each able to carry its own post: `cache write-through vs write-back`, `cap theorem explained simply`, `how to design a url shortener`, `idempotency keys explained`, `system design interview rubric`.
