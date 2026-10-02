# Contributing

Thanks for helping. Cards are the heart of this project, so most of this document is about writing them well.

## Ground rules

- Be kind and specific in reviews. A card is a claim about what a good answer contains; argue with sources.
- Everything here is MIT licensed, including card text. Only contribute wording you wrote yourself.
- Do not paste material from paid courses, books, or other flashcard decks. Paraphrasing a single sentence is fine; reproducing structure or lists is not.

## Writing a card

Cards live in `packages/content/cards/<deck>/<id>.md`. Copy an existing card from the same deck and edit it.

```markdown
---
id: cache-aside-pattern
deck: fundamentals
type: concept # concept | tradeoff | estimation | design | failure
difficulty: 1 # 1 easy · 2 medium · 3 hard
tags: [caching, latency]
prompt: >
  What is the cache-aside pattern and what is its main consistency pitfall?
keyPoints:
  - Application reads the cache first and falls back to the store on a miss
  - On a miss the application writes the result back to the cache
  - Writes go to the store and invalidate (not update) the cache entry
  - A read racing a write can repopulate the cache with a stale value
followUps:
  - How would you shorten the stale window?
references:
  - title: AWS ElastiCache docs, Caching strategies
    url: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html
updated: 2026-10-02
reviewed: false
---

Model answer in Markdown. Explain the idea, the tradeoffs, and what an
interviewer is listening for. Mermaid code fences render as diagrams.
```

Rules the validator enforces (`pnpm validate`):

- `id` is kebab-case, unique, and matches the filename.
- `deck` matches the folder: `fundamentals`, `estimation`, or `designs`.
- `keyPoints` has 3 to 6 entries. `followUps` has at most 5.
- At least one reference with a public URL.
- Tags come from the closed vocabulary in `packages/content/src/schema.ts`. Add a tag there in the same PR if you really need one.
- `type: design` cards must include `stages` (3 to 8), each with a name and its own key points. Non-design cards must not.
- `type: estimation` cards must carry the `estimation` tag.
- Body is at least 40 characters.
- Only cards with `reviewed: true` are compiled into the app. Open your PR with `reviewed: false`; a maintainer flips it after review.

Rules a human enforces:

- The prompt is phrased the way an interviewer would ask it. One or two sentences.
- Key points are things a strong answer _says_, not topics. "Mentions idempotency keys for safe retries" is a key point; "idempotency" is not.
- Key points are independent, so that ticking them is a meaningful score.
- Avoid colons followed by a space inside YAML list items; wrap the item in quotes if you need one.
- Prefer primary sources (vendor docs, papers, engineering blogs) over aggregators.

## Fixing a card

Open an issue with the [card error template](https://github.com/masaok/metastack/issues/new?template=card-error.yml), or send a PR that edits the file and bumps `updated`.

## Code changes

```bash
pnpm install
pnpm dev
pnpm typecheck && pnpm lint && pnpm test
```

- `packages/srs` must stay at 100% coverage. If you add a branch, add a test.
- Keep `packages/srs` and `packages/content` free of browser or Node-only APIs so they stay portable.
- UI must work with keyboard only and in both themes.
- Run `pnpm format` before committing.

## Public repository guardrail

This repository is public and CI runs `scripts/check-public.sh` plus gitleaks. Do not commit `.env` files, credentials, or local absolute paths.
