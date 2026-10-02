# ADR 0001: Static first, no backend

Date: 2026-10-02 · Status: accepted

## Context

A flashcard app needs per-user state (what you have seen, when it is due). The obvious design is accounts plus a database. That adds auth, privacy policy, hosting cost, and a dependency that can go away, and it means the project cannot be forked and run with `pnpm dev` alone.

## Decision

The MVP ships as a fully static site. All user state lives in the browser's IndexedDB (via Dexie). Users move or back up state with a JSON export/import in Settings.

No analytics, no third-party scripts, no runtime server.

## Consequences

- Progress is per browser. Clearing site data loses it unless exported. The UI says so on the settings page and at the end of each session.
- Any static host works. Forks need no infrastructure.
- Cross-device sync, if ever added, becomes a separate optional layer on top of the same export format, not a rewrite.
- Build output is cacheable at the edge; the page weight is dominated by Mermaid, which is lazy-loaded only on pages that contain a diagram.
