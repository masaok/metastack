/**
 * Write the cards that ship in this repository into the database, replacing
 * any stored card with the same id. Cards that exist only in the database are
 * left alone.
 */
import { neon } from "@neondatabase/serverless";

import { seedCards } from "@metastack/content/seed";

import { CARDS_TABLE, selectCards, upsertCards } from "../src/lib/cards/store";

const url = process.env.NEON_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("NEON_URL or DATABASE_URL is not set");

const sql = neon(url);

async function main() {
  await sql.query(CARDS_TABLE);
  await upsertCards(sql, seedCards);
  const stored = await selectCards(sql);
  console.log(`✔ seeded ${seedCards.length} card(s); the database now serves ${stored.length}`);
}

void main();
