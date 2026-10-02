# ADR 0003: Markdown with front matter for card content

Date: 2026-10-02 · Status: accepted

## Context

Cards need structured fields (id, deck, tags, key points, references) and a free-form model answer with code and diagrams. Options considered: a single JSON/YAML file, a database, MDX, or Markdown with YAML front matter.

## Decision

One Markdown file per card under `packages/content/cards/<deck>/<id>.md`. YAML front matter holds the structured fields; the body is the model answer. A compile step validates with zod and emits a single JSON bundle that the app imports.

Why not MDX: cards should be data, not code. Keeping them plain Markdown means they can be reviewed by non-engineers, rendered anywhere, and never execute anything.

Why compile to JSON: the web bundle must not touch the filesystem, and validation should fail the build rather than a page at runtime.

## Validation rules

Enforced in `packages/content/src/schema.ts` and `compile.ts`:

- kebab-case `id`, unique, equal to the filename
- `deck` equal to the folder and one of the known slugs
- `type` in `concept | tradeoff | estimation | design | failure`
- 3–6 `keyPoints`; at most 5 `followUps`; at least one `reference` with a URL
- tags from a closed vocabulary
- `design` cards have 3–8 `stages`, each with its own key points; other types must not
- `estimation` cards carry the `estimation` tag
- body of at least 40 characters
- `reviewed` flag; only reviewed cards are compiled

## Consequences

- Adding a card is a pull request with one new file; CI validates it.
- Mermaid fences in the body are rendered client-side with a lazily loaded Mermaid bundle. Build-time rendering to SVG was considered and deferred: it needs a headless browser in CI and the client bundle is only loaded on pages that contain a diagram.
- Tag changes are code changes (the vocabulary is a TypeScript array), which keeps the tag filter in the card browser tidy.
