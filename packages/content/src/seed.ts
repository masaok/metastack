/**
 * @metastack/content/seed — the cards that ship in this repository.
 *
 * Imports the JSON emitted by `pnpm compile`. The web app loads it into an
 * empty database and serves it directly when no database is configured. It is
 * server-side data; client components receive cards as props.
 */
import compiled from "../generated/cards.json" with { type: "json" };
import type { Card } from "./schema";

export const seedCards: readonly Card[] = compiled as Card[];
