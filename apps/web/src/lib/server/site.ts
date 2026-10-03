import "server-only";

import type { Rating } from "@metastack/srs";

import type { SiteOverview } from "@/lib/site";

import { ensureSchema } from "./neon";

export type { SiteAccount, SiteOverview } from "@/lib/site";

interface AccountRow {
  id: string;
  login: string;
  name: string | null;
  email: string | null;
  created_at: Date | string;
  cards: number;
  reviews: number;
  last_review: Date | string | null;
}

interface CountRow {
  n: number;
}

interface RatingRow {
  rating: Rating;
  n: number;
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export async function loadSiteOverview(): Promise<SiteOverview> {
  const sql = await ensureSchema();
  const [accounts, studied, ratingRows] = await Promise.all([
    sql`
      SELECT
        u.id,
        u.login,
        u.name,
        u.email,
        u.created_at,
        (SELECT count(*)::int FROM card_states c WHERE c.user_id = u.id) AS cards,
        (SELECT count(*)::int FROM reviews r WHERE r.user_id = u.id) AS reviews,
        (SELECT max(reviewed_at) FROM reviews r WHERE r.user_id = u.id) AS last_review
      FROM users u
      ORDER BY u.created_at DESC
    ` as unknown as Promise<AccountRow[]>,
    sql`SELECT count(*)::int AS n FROM card_states` as unknown as Promise<CountRow[]>,
    sql`SELECT rating, count(*)::int AS n FROM reviews GROUP BY rating` as unknown as Promise<
      RatingRow[]
    >,
  ]);

  const ratings: Record<Rating, number> = { again: 0, hard: 0, good: 0, easy: 0 };
  let reviews = 0;
  for (const row of ratingRows) {
    if (row.rating in ratings) {
      const n = asNumber(row.n);
      ratings[row.rating] = n;
      reviews += n;
    }
  }

  return {
    accounts: accounts.map((row) => ({
      id: row.id,
      login: row.login,
      name: row.name,
      email: row.email,
      createdAt: toIso(row.created_at) ?? "",
      cards: asNumber(row.cards),
      reviews: asNumber(row.reviews),
      lastReview: toIso(row.last_review),
    })),
    users: accounts.length,
    reviews,
    cardsStudied: asNumber(studied[0]?.n ?? 0),
    ratings,
  };
}
