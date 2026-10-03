import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

import { databaseUrl } from "@/lib/auth/env";

type Sql = NeonQueryFunction<false, false>;

let sql: Sql | undefined;
let ready: Promise<void> | undefined;

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`,
  `CREATE TABLE IF NOT EXISTS card_states (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    due TIMESTAMPTZ NOT NULL,
    stability DOUBLE PRECISION NOT NULL,
    difficulty DOUBLE PRECISION NOT NULL,
    elapsed_days DOUBLE PRECISION NOT NULL,
    scheduled_days DOUBLE PRECISION NOT NULL,
    learning_steps INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    lapses INTEGER NOT NULL,
    state TEXT NOT NULL,
    last_review TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, card_id)
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    rating TEXT NOT NULL,
    previous_state TEXT NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL,
    scheduled_days DOUBLE PRECISION NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reviews_dedupe
    ON reviews (user_id, card_id, reviewed_at, rating)`,
  `CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    new_limit INTEGER NOT NULL DEFAULT 10,
    mode TEXT NOT NULL DEFAULT 'rubric',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS theme TEXT`,
];

export function getSql(): Sql {
  if (!sql) sql = neon(databaseUrl());
  return sql;
}

export async function ensureSchema(): Promise<Sql> {
  const client = getSql();
  if (!ready) {
    ready = (async () => {
      for (const statement of STATEMENTS) {
        await client.query(statement);
      }
    })();
  }
  await ready;
  return client;
}
