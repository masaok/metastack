import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { parsePosts, publishedOnly, type Post, type PostFile } from "./schema";

/** Posts live beside the app, one Markdown file per post. */
export const BLOG_DIR = join(process.cwd(), "content", "blog");

export function readPostFiles(dir = BLOG_DIR): PostFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({
      path: relative(process.cwd(), join(dir, f)).split("\\").join("/"),
      raw: readFileSync(join(dir, f), "utf8"),
    }));
}

let cache: Post[] | undefined;

/**
 * The one loader. Index, post page, sitemap and feed all call this.
 * Drafts are included only in development so they can be previewed; the
 * production build never sees them.
 */
export function getPosts(): Post[] {
  if (!cache) {
    const { posts, issues } = parsePosts(readPostFiles());
    if (issues.length > 0) {
      throw new Error(
        `Invalid blog content:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join("\n")}`,
      );
    }
    cache = posts;
  }
  return process.env.NODE_ENV === "development" ? cache : publishedOnly(cache);
}

/** Published posts only, regardless of environment. Sitemap and feed use this. */
export function getPublishedPosts(): Post[] {
  return publishedOnly(getPosts());
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((p) => p.slug === slug);
}

export function getRelatedPosts(post: Post, limit = 2): Post[] {
  const others = getPosts().filter((p) => p.slug !== post.slug);
  const score = (p: Post) =>
    p.tags.filter((t) => post.tags.includes(t)).length +
    (p.secondaryKeywords.includes(post.primaryKeyword) ? 2 : 0);
  return others.sort((a, b) => score(b) - score(a)).slice(0, limit);
}
