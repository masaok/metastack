import { neon } from "@neondatabase/serverless";

import { CARDS_TABLE } from "../src/lib/cards/store";

const url = process.env.NEON_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("NEON_URL or DATABASE_URL is not set");

const sql = neon(url);
const statements = [
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
  CARDS_TABLE,
];

async function main() {
  for (const statement of statements) {
    await sql.query(statement);
  }
  const rows = (await sql`SELECT count(*)::int AS n FROM users`) as { n: number }[];
  console.log(`neon schema ready, users=${rows[0]?.n ?? 0}`);
}

void main();
