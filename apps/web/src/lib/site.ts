import type { Rating } from "@metastack/srs";

export interface SiteAccount {
  id: string;
  login: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  cards: number;
  reviews: number;
  lastReview: string | null;
}

export interface SiteOverview {
  accounts: SiteAccount[];
  users: number;
  reviews: number;
  cardsStudied: number;
  ratings: Record<Rating, number>;
}
