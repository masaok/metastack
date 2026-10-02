#!/usr/bin/env tsx
// Read-only content check for blog posts. Rules live in RULES; every rule has
// a proof-of-failure fixture in check-blog.test.ts. Run: pnpm check:blog
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  firstParagraph,
  hasTopLevelHeading,
  headingsOf,
  keywordInSlug,
  keywordInText,
  linksOf,
  MIN_SECTIONS,
  MIN_WORDS,
  parsePosts,
  postPath,
  proseWordCount,
  TITLE_MAX,
  type Post,
  type PostFile,
} from "../src/lib/blog/schema";

export interface Problem {
  rule: string;
  path: string;
  message: string;
}

export interface CheckInput {
  files: PostFile[];
  keywordsDoc: string;
  /** Internal routes that exist outside the blog, e.g. "/study", "/cards/url-shortener". */
  routes: Set<string>;
  /** Source of the sitemap and feed modules, for the drafts-stay-home rule. */
  consumers: { path: string; source: string }[];
  today: string;
}

export const RULES: Record<string, string> = {
  shape: "front matter parses and matches the Post schema; slug matches file name; slugs unique",
  "keyword-map": "primary keyword is a row in docs/blog-keywords.md and owned by exactly one post",
  "keyword-placement": "primary keyword appears in title, slug, description and first paragraph",
  "title-length": `title is at most ${TITLE_MAX} characters`,
  "description-length": `description is ${DESCRIPTION_MIN} to ${DESCRIPTION_MAX} characters`,
  "no-h1": "body has no level-one heading; the page renders the title",
  "min-words": `published post has at least ${MIN_WORDS} prose words`,
  sections: `published post has at least ${MIN_SECTIONS} h2 sections`,
  "internal-links":
    "internal links point at routes, published posts or in-page headings that exist",
  "related-links": "published post links to two other published posts and one project page",
  "image-alt": "every image has alt text",
  dates: "createdAt <= publishedAt <= updatedAt, and published posts are not dated in the future",
  "drafts-stay-home": "sitemap and feed read getPublishedPosts(), never getPosts()",
};

export function keywordRows(doc: string): string[] {
  const rows: string[] = [];
  for (const line of doc.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 6 || !cells[1]) continue;
    const keyword = cells[1].toLowerCase();
    if (keyword === "keyword" || /^-+$/.test(keyword)) continue;
    rows.push(keyword);
  }
  return rows;
}

export function checkBlog(input: CheckInput): Problem[] {
  const problems: Problem[] = [];
  const add = (rule: keyof typeof RULES, path: string, message: string) =>
    problems.push({ rule, path, message });

  const { posts, issues } = parsePosts(input.files);
  for (const i of issues) {
    const rule = /title must be at most/.test(i.message)
      ? "title-length"
      : /description must be/.test(i.message)
        ? "description-length"
        : "shape";
    add(rule, i.path, i.message);
  }

  const published = posts.filter((p) => !p.draft);
  const publishedSlugs = new Set(published.map((p) => p.slug));
  const rows = keywordRows(input.keywordsDoc);
  const owners = new Map<string, Post[]>();
  for (const p of posts) {
    const k = p.primaryKeyword.toLowerCase();
    owners.set(k, [...(owners.get(k) ?? []), p]);
  }
  for (const [k, ps] of owners) {
    if (!rows.includes(k)) {
      for (const p of ps)
        add("keyword-map", p.sourcePath, `keyword "${k}" is not in the keyword map`);
    }
    if (ps.length > 1) {
      for (const p of ps) {
        add(
          "keyword-map",
          p.sourcePath,
          `keyword "${k}" is owned by ${ps.length} posts: ${ps.map((x) => x.slug).join(", ")}`,
        );
      }
    }
  }

  for (const post of posts) {
    const path = post.sourcePath;
    const k = post.primaryKeyword;
    const missing: string[] = [];
    if (!keywordInText(k, post.title)) missing.push("title");
    if (!keywordInSlug(k, post.slug)) missing.push("slug");
    if (!keywordInText(k, post.description)) missing.push("description");
    if (!keywordInText(k, firstParagraph(post.body))) missing.push("first paragraph");
    if (missing.length > 0) {
      add("keyword-placement", path, `keyword "${k}" missing from ${missing.join(", ")}`);
    }

    if (hasTopLevelHeading(post.body)) add("no-h1", path, "body contains a level-one heading");

    const headings = headingsOf(post.body);
    const h2 = headings.filter((h) => h.depth === 2);
    const ids = new Set(headings.map((h) => h.id));

    if (!post.draft) {
      const words = proseWordCount(post.body);
      if (words < MIN_WORDS) add("min-words", path, `${words} prose words, need ${MIN_WORDS}`);
      if (h2.length < MIN_SECTIONS) {
        add("sections", path, `${h2.length} h2 sections, need ${MIN_SECTIONS}`);
      }
    }

    let otherPosts = 0;
    let projectPages = 0;
    for (const link of linksOf(post.body)) {
      if (link.image && link.alt.trim() === "") {
        add("image-alt", path, `line ${link.line}: image without alt text`);
      }
      const href = link.href;
      if (href.startsWith("#")) {
        if (!ids.has(href.slice(1))) {
          add("internal-links", path, `line ${link.line}: no heading for ${href}`);
        }
        continue;
      }
      if (!href.startsWith("/")) continue;
      const [route] = href.split(/[#?]/) as [string];
      const blogMatch = /^\/blog\/([^/]+)$/.exec(route);
      if (blogMatch) {
        const slug = blogMatch[1]!;
        const target = posts.find((p) => p.slug === slug);
        const reachable = target && (!target.draft || post.draft);
        if (!reachable) {
          add("internal-links", path, `line ${link.line}: ${route} is not a published post`);
        } else if (slug !== post.slug) {
          otherPosts += 1;
        }
        continue;
      }
      if (route === "/blog") continue;
      if (!input.routes.has(route)) {
        add("internal-links", path, `line ${link.line}: ${route} is not a known route`);
        continue;
      }
      projectPages += 1;
    }
    if (!post.draft) {
      if (otherPosts < 2) {
        add("related-links", path, `links to ${otherPosts} other posts, need 2`);
      }
      if (projectPages < 1) add("related-links", path, "links to no project page, need 1");
    }

    if (post.publishedAt < post.createdAt) {
      add("dates", path, `publishedAt ${post.publishedAt} is before createdAt ${post.createdAt}`);
    }
    if (post.updatedAt && post.updatedAt < post.publishedAt) {
      add("dates", path, `updatedAt ${post.updatedAt} is before publishedAt ${post.publishedAt}`);
    }
    if (!post.draft && post.publishedAt > input.today) {
      add("dates", path, `publishedAt ${post.publishedAt} is in the future (today ${input.today})`);
    }
  }

  for (const row of rows) {
    if (!owners.has(row)) {
      add("keyword-map", "docs/blog-keywords.md", `keyword "${row}" has no post`);
    }
  }

  for (const c of input.consumers) {
    if (!/getPublishedPosts\(\)/.test(c.source)) {
      add("drafts-stay-home", c.path, "must call getPublishedPosts()");
    }
    if (/\bgetPosts\(/.test(c.source)) {
      add("drafts-stay-home", c.path, "must not call getPosts(), which includes drafts in dev");
    }
  }

  void publishedSlugs;
  return problems;
}

/** Routes that exist outside the blog, derived from the app and card bank on disk. */
export function projectRoutes(repoRoot: string): Set<string> {
  const routes = new Set(["/", "/study", "/decks", "/cards", "/settings"]);
  const cardsDir = join(repoRoot, "packages", "content", "cards");
  if (existsSync(cardsDir)) {
    for (const deck of readdirSync(cardsDir, { withFileTypes: true })) {
      if (!deck.isDirectory()) continue;
      routes.add(`/study/${deck.name}`);
      for (const f of readdirSync(join(cardsDir, deck.name))) {
        if (f.endsWith(".md")) routes.add(`/cards/${f.replace(/\.md$/, "")}`);
      }
    }
  }
  return routes;
}

export function readInput(repoRoot: string, today = new Date().toISOString().slice(0, 10)) {
  const webRoot = join(repoRoot, "apps", "web");
  const blogDir = join(webRoot, "content", "blog");
  const files: PostFile[] = readdirSync(blogDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({
      path: `apps/web/content/blog/${f}`,
      raw: readFileSync(join(blogDir, f), "utf8"),
    }));
  const consumers = ["src/app/sitemap.ts", "src/app/feed.xml/route.ts"].map((p) => ({
    path: `apps/web/${p}`,
    source: readFileSync(join(webRoot, p), "utf8"),
  }));
  return {
    files,
    keywordsDoc: readFileSync(join(repoRoot, "docs", "blog-keywords.md"), "utf8"),
    routes: projectRoutes(repoRoot),
    consumers,
    today,
  } satisfies CheckInput;
}

function main() {
  const repoRoot = resolve(
    process.argv[2] ?? join(fileURLToPath(import.meta.url), "..", "..", "..", ".."),
  );
  const input = readInput(repoRoot);
  const problems = checkBlog(input);
  const published = parsePosts(input.files).posts.filter((p) => !p.draft);
  if (problems.length === 0) {
    console.log(
      `check-blog: ${input.files.length} posts (${published.length} published) pass ${Object.keys(RULES).length} rules`,
    );
    for (const p of published) {
      console.log(`  ${postPath(p.slug)}  ${proseWordCount(p.body)} words`);
    }
    return;
  }
  console.error(`check-blog: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  [${p.rule}] ${p.path}: ${p.message}`);
  console.error("\nRules:");
  for (const [id, text] of Object.entries(RULES)) console.error(`  ${id}: ${text}`);
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
