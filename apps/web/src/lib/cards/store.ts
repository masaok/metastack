import { frontMatterSchema, toCard, type Card } from "@metastack/content";

/** The part of the Neon client the card queries use. */
export interface CardsSql {
  query(text: string, params?: unknown[]): Promise<unknown>;
}

export const CARDS_TABLE = `CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    deck TEXT NOT NULL,
    type TEXT NOT NULL,
    difficulty SMALLINT NOT NULL,
    tags JSONB NOT NULL,
    prompt TEXT NOT NULL,
    key_points JSONB NOT NULL,
    eli5 JSONB,
    follow_ups JSONB NOT NULL,
    reference_links JSONB NOT NULL,
    stages JSONB,
    body TEXT NOT NULL,
    updated DATE NOT NULL,
    reviewed BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

export interface CardRow {
  id: string;
  deck: string;
  type: string;
  difficulty: number;
  tags: unknown;
  prompt: string;
  key_points: unknown;
  eli5: unknown;
  follow_ups: unknown;
  reference_links: unknown;
  stages: unknown;
  body: string;
  updated: string;
  reviewed: boolean;
}

const SELECT_COLUMNS = `SELECT id, deck, type, difficulty, tags, prompt, key_points, eli5, follow_ups,
    reference_links, stages, body, to_char(updated, 'YYYY-MM-DD') AS updated, reviewed
  FROM cards`;

// Byte order, so the database returns cards in the order the compiler emits them.
const CONTENT_ORDER = `ORDER BY deck COLLATE "C", id COLLATE "C"`;

const INSERT_CARDS = `INSERT INTO cards (id, deck, type, difficulty, tags, prompt, key_points, eli5,
    follow_ups, reference_links, stages, body, updated, reviewed)
  SELECT id, deck, type, difficulty, tags, prompt, "keyPoints", eli5,
    "followUps", "references", stages, body, updated, reviewed
  FROM jsonb_to_recordset($1::jsonb) AS card(
    id TEXT, deck TEXT, type TEXT, difficulty SMALLINT, tags JSONB, prompt TEXT,
    "keyPoints" JSONB, eli5 JSONB, "followUps" JSONB, "references" JSONB, stages JSONB,
    body TEXT, updated DATE, reviewed BOOLEAN
  )`;

const REPLACE_STORED = `ON CONFLICT (id) DO UPDATE SET
    deck = EXCLUDED.deck,
    type = EXCLUDED.type,
    difficulty = EXCLUDED.difficulty,
    tags = EXCLUDED.tags,
    prompt = EXCLUDED.prompt,
    key_points = EXCLUDED.key_points,
    eli5 = EXCLUDED.eli5,
    follow_ups = EXCLUDED.follow_ups,
    reference_links = EXCLUDED.reference_links,
    stages = EXCLUDED.stages,
    body = EXCLUDED.body,
    updated = EXCLUDED.updated,
    reviewed = EXCLUDED.reviewed,
    updated_at = now()`;

/** A stored row as a card, or null when the row no longer satisfies the schema. */
export function rowToCard(row: CardRow): Card | null {
  const parsed = frontMatterSchema.safeParse({
    id: row.id,
    deck: row.deck,
    type: row.type,
    difficulty: row.difficulty,
    tags: row.tags,
    prompt: row.prompt,
    keyPoints: row.key_points,
    followUps: row.follow_ups,
    references: row.reference_links,
    updated: row.updated,
    reviewed: row.reviewed,
    ...(row.eli5 === null ? {} : { eli5: row.eli5 }),
    ...(row.stages === null ? {} : { stages: row.stages }),
  });
  if (!parsed.success) {
    const reasons = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    console.error(
      `card "${row.id}" in the database is invalid and was skipped: ${reasons.join("; ")}`,
    );
    return null;
  }
  return toCard(parsed.data, row.body);
}

/**
 * Cards in content order. Rows that fail the schema are left out. Only reviewed
 * cards are returned unless `drafts` is set, which the admin editor uses.
 */
export async function selectCards(
  sql: CardsSql,
  options: { drafts?: boolean } = {},
): Promise<Card[]> {
  const filter = options.drafts ? "" : "WHERE reviewed";
  const rows = (await sql.query(`${SELECT_COLUMNS} ${filter} ${CONTENT_ORDER}`)) as CardRow[];
  return rows.map(rowToCard).filter((card): card is Card => card !== null);
}

export async function cardExists(sql: CardsSql, id: string): Promise<boolean> {
  const rows = (await sql.query(`SELECT 1 FROM cards WHERE id = $1`, [id])) as unknown[];
  return rows.length > 0;
}

/** Remove one card. Returns false when no card had that id. */
export async function deleteCard(sql: CardsSql, id: string): Promise<boolean> {
  const rows = (await sql.query(`DELETE FROM cards WHERE id = $1 RETURNING id`, [id])) as unknown[];
  return rows.length > 0;
}

/**
 * Insert the cards. A stored card with the same id is kept, or replaced when
 * `overwrite` is set. Rows for other ids are left alone.
 */
export async function upsertCards(
  sql: CardsSql,
  cards: readonly Card[],
  options: { overwrite?: boolean } = {},
): Promise<void> {
  if (cards.length === 0) return;
  const onConflict = options.overwrite ? REPLACE_STORED : "ON CONFLICT (id) DO NOTHING";
  await sql.query(`${INSERT_CARDS} ${onConflict}`, [JSON.stringify(cards)]);
}
