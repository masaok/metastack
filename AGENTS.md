<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MetaStack: notes for coding agents

This is a **public, MIT-licensed** repository. Everything you write here will be published.

## Project shape

- pnpm workspace. `apps/web` is a Next.js 16 App Router app (Turbopack, Tailwind v4, Dexie). `packages/content` holds the cards and their compiler. `packages/srs` wraps ts-fsrs in pure functions.
- The content package must be compiled before the app runs: `pnpm compile` writes `packages/content/generated/cards.json` (gitignored). `pnpm dev` and `pnpm build` do this automatically.
- The app reads cards from the Neon `cards` table through `loadCards()` in `apps/web/src/lib/server/cards.ts`. The Markdown cards are the seed: `pnpm db:seed` upserts them, an empty table fills itself from them, and with no database configured they are served directly. Client components get cards as props and never import card content.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` must all pass before a PR. `packages/srs` enforces 100% coverage.
- Next 16 specifics: `params` is a Promise; `next lint` no longer exists (use `eslint`); the favicon is `apps/web/src/app/icon.svg`.

## Engineering practices (see `docs/ENGINEERING_PRACTICES.md`)

- Verification is structural. Hooks format staged files at commit and run typecheck + build at push; CI runs named required jobs. Never bypass a hook with `--no-verify` or weaken a check to get green.
- Automated paths run read-only tools only: `lint`, `format:check`. `lint:fix` and `format` are for humans.
- One home per fact. Node version lives in `.nvmrc` (CI, `engines`, `@types/node` follow it). pnpm version lives in `packageManager`. Tags, decks and card types live in `packages/content/src/schema.ts`; derive, never restate.
- A check that reads generated files generates them in the same command.
- Every hand-written check (`scripts/check-*.{sh,mjs}` and `apps/web/scripts/check-blog.ts`) has a proof-of-failure test beside it that CI runs first. If you add a check, add its test.
- Required CI jobs must be hermetic: no live services, no network fetches. Anything that needs infrastructure goes on a schedule with its report as an artifact, never on the gate.
- Durable state is versioned. Never edit `db.version(1)`; add a new version with an `upgrade()`. Bump the export envelope `version` when its shape changes.
- When you replace a mechanism, delete the old one in the same change.
- If something in a guide here disagrees with the code, fix the guide to describe the code, and note the decision.

## Content rules (enforced by `pnpm validate`, then by humans)

- Cards are Markdown with YAML front matter in `packages/content/cards/<deck>/<id>.md`. The schema is `packages/content/src/schema.ts`; read it before writing a card.
- **Original wording only.** Never reproduce text or list structure from courses, books, or other decks. Write from understanding, then cite a public source.
- 3 to 6 `keyPoints`, each something a strong answer _says_. At least one public `reference`. Tags from the closed vocabulary. `type: design` cards need `stages`.
- New cards ship with `reviewed: false`. Only a maintainer sets `reviewed: true`.
- In YAML list items avoid `: ` (colon-space); it turns the item into a mapping.

- Blog posts: `docs/blog.md`. Keyword map: `docs/blog-keywords.md`.

## Things not to do

- Do not add analytics or third-party scripts. GitHub sign-in and Neon-backed progress sync are optional; studying without an account still works and still writes IndexedDB first.
- Do not commit `.env` files, credentials, or absolute paths from your machine. CI runs `scripts/check-public.sh` and gitleaks and will fail. Document new env vars by name only in `.env.example`.
- Do not mention or copy from any private companion repository. If you are working across repositories, nothing crosses into this one unless a human asks for that specific change.
- Do not reduce test coverage or weaken the content validator to make something pass.
