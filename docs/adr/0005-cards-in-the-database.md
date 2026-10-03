# ADR 0005: Cards are served from the database

Date: 2026-10-02 · Status: accepted · Amends [0001](0001-static-first.md) and [0003](0003-markdown-content.md)

## Context

ADR 0003 made the Markdown files the cards, compiled into a JSON bundle that the web app imported, in the browser too. The site already has a Neon database for accounts and synced progress. The maintainer wants all card data in that database, so the app reads one store for cards, users and progress.

A required CI job must not reach a live service, and a fork must run with `pnpm dev` alone. So a build with no database still needs cards from somewhere.

## Decision

The `cards` table in Neon is what the app reads. `lib/server/cards.ts` loads every reviewed card on the server and passes cards to client components as props. Nothing in the browser bundle imports card content any more.

The Markdown files stay in the repository as the **seed**. `pnpm compile` still validates them and writes `generated/cards.json`, which is used in three places:

- `pnpm db:seed` upserts the seed into the database by card id. Rows that exist only in the database are left alone.
- An empty `cards` table is filled from the seed on first read, so a new database or a first deploy never serves an empty site.
- With neither `NEON_URL` nor `DATABASE_URL` set, the app serves the seed directly. This is the path CI and forks take.

Reads are cached for five minutes and pages are regenerated in the background, so a change in the database reaches the site without a deploy. A row that no longer satisfies the schema is skipped and logged, never served.

Columns that hold lists (`tags`, `key_points`, `eli5`, `follow_ups`, `reference_links`, `stages`) are JSONB. The table is created with `CREATE TABLE IF NOT EXISTS` beside the other tables; a later change to its shape is a new `ALTER TABLE` statement, never an edit to the original.

## Consequences

- The production site depends on Neon for card content. Pages already generated keep serving if a refresh fails.
- A card merged as Markdown does not reach an existing database until someone runs `pnpm db:seed` against it. Seeding overwrites a stored card that has the same id.
- There is no editor for cards in the app yet. Until there is, a card change still starts as a Markdown pull request and reaches the database through the seed.
- Card pages are no longer limited to the ids known at build time. A card added to the database gets its page on first request.
- The study pages receive the card list in the page payload instead of the JavaScript bundle.
