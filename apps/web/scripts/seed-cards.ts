/**
 * Add the cards that ship in this repository to the database. A stored card
 * with the same id is kept, since it may have been edited in the admin area;
 * pass `--overwrite` to replace stored cards with the repository's copy.
 * Cards that exist only in the database are always left alone.
 */
import { neon } from "@neondatabase/serverless";

import { seedCards } from "@metastack/content/seed";

import { CARDS_TABLE, selectCards, upsertCards } from "../src/lib/cards/store";

const url = process.env.NEON_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("NEON_URL or DATABASE_URL is not set");

const sql = neon(url);
const overwrite = process.argv.includes("--overwrite");

async function main() {
  await sql.query(CARDS_TABLE);
  await upsertCards(sql, seedCards, { overwrite });
  const stored = await selectCards(sql);
  const how = overwrite ? "replacing stored copies" : "keeping stored copies";
  console.log(
    `✔ seeded ${seedCards.length} card(s), ${how}; the database now serves ${stored.length}`,
  );
}

void main();
