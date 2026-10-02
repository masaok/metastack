import type { MetadataRoute } from "next";

import { cards, DECKS } from "@metastack/content";

import { getPublishedPosts } from "@/lib/blog/load";
import { BLOG_PATH, postPath } from "@/lib/blog/schema";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.metastack.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPublishedPosts();
  const newest = posts[0]?.updatedAt ?? posts[0]?.publishedAt;
  const statics: MetadataRoute.Sitemap = ["/", "/study", "/decks", "/cards", "/settings"].map(
    (path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "monthly" }),
  );
  const decks: MetadataRoute.Sitemap = DECKS.map((d) => ({
    url: `${SITE_URL}/study/${d.slug}`,
    changeFrequency: "monthly",
  }));
  const cardPages: MetadataRoute.Sitemap = cards.map((c) => ({
    url: `${SITE_URL}/cards/${c.id}`,
    lastModified: c.updated,
    changeFrequency: "monthly",
  }));
  const blog: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}${BLOG_PATH}`,
      lastModified: newest,
      changeFrequency: "weekly",
    },
    ...posts.map((p) => ({
      url: `${SITE_URL}${postPath(p.slug)}`,
      lastModified: p.updatedAt ?? p.publishedAt,
      changeFrequency: "monthly" as const,
    })),
  ];
  return [...statics, ...decks, ...blog, ...cardPages];
}
