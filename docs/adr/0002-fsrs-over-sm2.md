# ADR 0002: FSRS over SM-2

Date: 2026-10-02 · Status: accepted

## Context

SM-2 is simple to implement and widely known. It uses a per-card ease factor adjusted by fixed amounts and multiplies the interval by it. It has no notion of target retention and reacts badly to lapses (ease hell).

FSRS models memory with three numbers per card (difficulty, stability, retrievability) and schedules the next review for the moment retrievability is predicted to drop to a target, 90% by default. It is the default scheduler in recent Anki versions and has public benchmarks showing fewer reviews for equal retention.

## Decision

Use FSRS through the `ts-fsrs` library, wrapped in `@metastack/srs` so the rest of the app only sees pure functions and JSON-friendly state.

Parameters:

- `request_retention: 0.9`
- `maximum_interval: 180` days. Interview prep has a horizon of weeks, not years; a hard cap keeps every card in rotation.
- `enable_fuzz: false`. Deterministic output makes the scheduler testable and the "next review in" labels exact.
- Default FSRS weights. Per-user parameter optimisation is a possible later phase; it needs more review history than a new user has.

## Rubric to rating

System design answers are not right or wrong; they cover more or fewer of the points an interviewer is listening for. We therefore ask the user to tick key points and map coverage to the four FSRS grades:

| Coverage   | Rating |
| ---------- | ------ |
| under 40%  | Again  |
| 40–69%     | Hard   |
| 70–94%     | Good   |
| 95% and up | Easy   |

The user can always override. Quick mode skips the rubric entirely.

## Consequences

- `CardState` carries FSRS fields (`stability`, `difficulty`, `elapsedDays`, `scheduledDays`, `reps`, `lapses`, `state`, `lastReview`). The export format is therefore tied to FSRS; a future scheduler change needs a migration.
- Learning steps are handled by FSRS itself; a card rated Again comes back within the same session window (minutes), not tomorrow.
