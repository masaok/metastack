import "server-only";

import type { CardState, LearningState, Rating, ReviewRecord } from "@metastack/srs";

import type { SessionUser } from "@/lib/auth/session";
import type { ExportFile } from "@/lib/db";
import { isNewLimit, isStudyMode, isTheme, type Settings } from "@/lib/settings";

import { ensureSchema } from "./neon";

interface StateRow {
  card_id: string;
  due: Date | string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: LearningState;
  last_review: Date | string | null;
}

interface ReviewRow {
  card_id: string;
  rating: Rating;
  previous_state: LearningState;
  reviewed_at: Date | string;
  scheduled_days: number;
}

interface SettingsRow {
  new_limit: number;
  mode: string;
  theme: string | null;
}

function toSettings(row: SettingsRow | undefined): Partial<Settings> {
  const settings: Partial<Settings> = {};
  if (!row) return settings;
  if (isNewLimit(row.new_limit)) settings.newLimit = row.new_limit;
  if (isStudyMode(row.mode)) settings.mode = row.mode;
  if (isTheme(row.theme)) settings.theme = row.theme;
  return settings;
}

const toIso = (d: Date | string) =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString();

function toState(row: StateRow): CardState {
  const state: CardState = {
    cardId: row.card_id,
    due: toIso(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsed_days,
    scheduledDays: row.scheduled_days,
    learningSteps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
  };
  if (row.last_review) state.lastReview = toIso(row.last_review);
  return state;
}

function toReview(row: ReviewRow): ReviewRecord {
  return {
    cardId: row.card_id,
    rating: row.rating,
    previousState: row.previous_state,
    reviewedAt: toIso(row.reviewed_at),
    scheduledDays: row.scheduled_days,
  };
}

export async function upsertUser(user: SessionUser): Promise<void> {
  const sql = await ensureSchema();
  await sql`
    INSERT INTO users (id, login, name, avatar_url, email)
    VALUES (${user.id}, ${user.login}, ${user.name}, ${user.avatarUrl}, ${user.email})
    ON CONFLICT (id) DO UPDATE SET
      login = EXCLUDED.login,
      name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url,
      email = EXCLUDED.email,
      updated_at = now()
  `;
}

export async function loadProgress(userId: string): Promise<ExportFile> {
  const sql = await ensureSchema();
  const [states, reviews, settingsRows] = await Promise.all([
    sql`SELECT card_id, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review FROM card_states WHERE user_id = ${userId}` as unknown as Promise<
      StateRow[]
    >,
    sql`SELECT card_id, rating, previous_state, reviewed_at, scheduled_days FROM reviews WHERE user_id = ${userId} ORDER BY reviewed_at` as unknown as Promise<
      ReviewRow[]
    >,
    sql`SELECT new_limit, mode, theme FROM settings WHERE user_id = ${userId}` as unknown as Promise<
      SettingsRow[]
    >,
  ]);
  const settings = toSettings(settingsRows[0]);
  return {
    app: "metastack",
    version: 1,
    exportedAt: new Date().toISOString(),
    cardStates: states.map(toState),
    reviews: reviews.map(toReview),
    settings,
  };
}

export async function replaceProgress(userId: string, data: ExportFile): Promise<void> {
  const sql = await ensureSchema();
  await sql`DELETE FROM reviews WHERE user_id = ${userId}`;
  await sql`DELETE FROM card_states WHERE user_id = ${userId}`;

  for (const s of data.cardStates) {
    await sql`
      INSERT INTO card_states (
        user_id, card_id, due, stability, difficulty, elapsed_days, scheduled_days,
        learning_steps, reps, lapses, state, last_review
      ) VALUES (
        ${userId}, ${s.cardId}, ${s.due}, ${s.stability}, ${s.difficulty}, ${s.elapsedDays},
        ${s.scheduledDays}, ${s.learningSteps}, ${s.reps}, ${s.lapses}, ${s.state},
        ${s.lastReview ?? null}
      )
    `;
  }
  for (const r of data.reviews) {
    await sql`
      INSERT INTO reviews (user_id, card_id, rating, previous_state, reviewed_at, scheduled_days)
      VALUES (${userId}, ${r.cardId}, ${r.rating}, ${r.previousState}, ${r.reviewedAt}, ${r.scheduledDays})
      ON CONFLICT (user_id, card_id, reviewed_at, rating) DO NOTHING
    `;
  }
  await upsertSettings(userId, data.settings);
}

export async function loadSettings(userId: string): Promise<Partial<Settings>> {
  const sql = await ensureSchema();
  const rows = (await sql`
    SELECT new_limit, mode, theme FROM settings WHERE user_id = ${userId}
  `) as unknown as SettingsRow[];
  return toSettings(rows[0]);
}

/** Writes the keys present in the patch; the others keep their stored value. */
export async function upsertSettings(userId: string, patch: Partial<Settings>): Promise<void> {
  if (patch.newLimit === undefined && patch.mode === undefined && patch.theme === undefined) {
    return;
  }
  const sql = await ensureSchema();
  await sql`
    INSERT INTO settings (user_id, new_limit, mode, theme)
    VALUES (${userId}, ${patch.newLimit ?? 10}, ${patch.mode ?? "rubric"}, ${patch.theme ?? null})
    ON CONFLICT (user_id) DO UPDATE SET
      new_limit = COALESCE(${patch.newLimit ?? null}::int, settings.new_limit),
      mode = COALESCE(${patch.mode ?? null}::text, settings.mode),
      theme = COALESCE(${patch.theme ?? null}::text, settings.theme),
      updated_at = now()
  `;
}

export async function appendReview(userId: string, state: CardState, review: ReviewRecord) {
  const sql = await ensureSchema();
  await sql`
    INSERT INTO card_states (
      user_id, card_id, due, stability, difficulty, elapsed_days, scheduled_days,
      learning_steps, reps, lapses, state, last_review
    ) VALUES (
      ${userId}, ${state.cardId}, ${state.due}, ${state.stability}, ${state.difficulty},
      ${state.elapsedDays}, ${state.scheduledDays}, ${state.learningSteps}, ${state.reps},
      ${state.lapses}, ${state.state}, ${state.lastReview ?? null}
    )
    ON CONFLICT (user_id, card_id) DO UPDATE SET
      due = EXCLUDED.due,
      stability = EXCLUDED.stability,
      difficulty = EXCLUDED.difficulty,
      elapsed_days = EXCLUDED.elapsed_days,
      scheduled_days = EXCLUDED.scheduled_days,
      learning_steps = EXCLUDED.learning_steps,
      reps = EXCLUDED.reps,
      lapses = EXCLUDED.lapses,
      state = EXCLUDED.state,
      last_review = EXCLUDED.last_review,
      updated_at = now()
  `;
  await sql`
    INSERT INTO reviews (user_id, card_id, rating, previous_state, reviewed_at, scheduled_days)
    VALUES (${userId}, ${review.cardId}, ${review.rating}, ${review.previousState}, ${review.reviewedAt}, ${review.scheduledDays})
    ON CONFLICT (user_id, card_id, reviewed_at, rating) DO NOTHING
  `;
}

export async function countUsers(): Promise<number> {
  const sql = await ensureSchema();
  const rows = (await sql`SELECT count(*)::int AS n FROM users`) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}
