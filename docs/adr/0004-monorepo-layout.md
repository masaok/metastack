# ADR 0004: pnpm monorepo with three packages

Date: 2026-10-02 · Status: accepted

## Context

The app has three concerns with different change rates and different audiences: the card bank (content contributors), the scheduler (needs rigorous tests, no UI), and the web app. A single Next.js project would let them tangle.

## Decision

pnpm workspace with:

```
apps/web            @metastack/web      Next.js app
packages/content    @metastack/content  cards, schema, compiler
packages/srs        @metastack/srs      FSRS wrapper
```

- Workspace packages are consumed as TypeScript source (`main: src/index.ts`) and compiled by Next via `transpilePackages`. No separate build step for libraries.
- Each package has its own `eslint`, `typecheck`, and `test` scripts; the root fans out with `pnpm -r`.
- `@metastack/content` compiles its JSON bundle before the app starts; the bundle is gitignored.
- Shared TypeScript options live in `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, bundler resolution).

## Consequences

- `packages/srs` can enforce 100% coverage without dragging UI code into the threshold.
- Content contributors can run `pnpm validate` without touching the app.
- Turbopack handles workspace TypeScript directly; there is no `dist/` to keep in sync.
- If a second app (for example a CLI drill) is ever added, it reuses the two packages as-is.
