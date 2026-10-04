// Pure blog content model. No filesystem, no React, no server-only import, so the
// same code runs in the Next build, in the content check script and in tests.

import GithubSlugger from "github-slugger";
import matter from "gray-matter";
import { z } from "zod";

export const BLOG_PATH = "/blog";
export const RECENT_PATH = "/blog/recent";
export const FEED_PATH = "/feed.xml";

export interface Category {
  /** Unique, lowercase, hyphenated. The path under `/blog/category/`. */
  slug: string;
  /** Shown on the index card and as the category page heading. */
  name: string;
  /** Shown on the card, and the category page's meta description. */
  description: string;
}

/**
 * The blog's categories, in the order the index shows them. A post names
 * exactly one by slug. Add one only when two or more posts will live in it.
 */
export const CATEGORIES: readonly Category[] = [
  {
    slug: "study-method",
    name: "Study method",
    description:
      "How to make system design knowledge stick: flashcards, spaced repetition and the scheduler that decides what you review next.",
  },
  {
    slug: "data-and-consistency",
    name: "Data and consistency",
    description:
      "Where data lives and what a read is allowed to return: CAP, PACELC, partitioning, consistent hashing and choosing a database.",
  },
  {
    slug: "traffic-and-reliability",
    name: "Traffic and reliability",
    description:
      "Moving requests through a system without losing or repeating work: load balancing, rate limiting, queues and idempotency.",
  },
  {
    slug: "worked-designs",
    name: "Worked designs",
    description:
      "Full interview prompts answered step by step, and the back-of-the-envelope estimation that sizes them.",
  },
  {
    slug: "caching-and-storage",
    name: "Caching and storage",
    description:
      "What you store, where you store it, and how you keep a copy close to the read: caches, CDNs, object stores and specialist databases.",
  },
  {
    slug: "architecture",
    name: "Architecture",
    description:
      "How services are cut and how work moves between them: monoliths, microservices, events, CQRS and the API in front.",
  },
  {
    slug: "consensus-and-coordination",
    name: "Consensus and coordination",
    description:
      "How distributed nodes agree, elect a leader, lock a resource and finish a write that touches more than one store.",
  },
  {
    slug: "observability-and-ops",
    name: "Observability and ops",
    description:
      "Knowing the system is healthy and sizing it before the load arrives: metrics, logs, traces, SLOs and capacity planning.",
  },
];

export const CATEGORY_MIN_POSTS = 2;
/** The largest category may hold at most this many times the posts of the smallest. */
export const CATEGORY_MAX_RATIO = 2;
/** Below this many published posts the blog is too small to balance. */
export const BALANCE_FROM_POSTS = 4;

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 120;
export const DESCRIPTION_MAX = 160;
export const MIN_WORDS = 1500;
export const MIN_SECTIONS = 4;

const isoDate = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v))
  .refine((v) => !Number.isNaN(Date.parse(v)), "must be an ISO 8601 date");

export const postFrontMatterSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase, hyphenated, no spaces"),
  title: z.string().min(1).max(TITLE_MAX, `title must be at most ${TITLE_MAX} characters`),
  description: z
    .string()
    .min(DESCRIPTION_MIN, `description must be at least ${DESCRIPTION_MIN} characters`)
    .max(DESCRIPTION_MAX, `description must be at most ${DESCRIPTION_MAX} characters`),
  primaryKeyword: z.string().min(1),
  secondaryKeywords: z.array(z.string().min(1)).default([]),
  category: z
    .string()
    .refine(
      (slug) => getCategory(slug) !== undefined,
      `category must be one of: ${CATEGORIES.map((c) => c.slug).join(", ")}`,
    ),
  tags: z.array(z.string().min(1)).min(1),
  createdAt: isoDate,
  publishedAt: isoDate,
  updatedAt: isoDate.optional(),
  draft: z.boolean().default(false),
});

export type PostFrontMatter = z.infer<typeof postFrontMatterSchema>;

export interface Post extends PostFrontMatter {
  body: string;
  /** Path relative to the repository root, for messages and "edit on GitHub". */
  sourcePath: string;
}

export interface Heading {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface PostFile {
  path: string;
  raw: string;
}

export interface PostIssue {
  path: string;
  message: string;
}

export interface ParsedPosts {
  posts: Post[];
  issues: PostIssue[];
}

/** Lines inside fenced code blocks are not prose, headings or links. */
export function stripFences(markdown: string): string {
  const out: string[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) out.push(line);
  }
  return out.join("\n");
}

/**
 * Headings of a post body with the ids rehype-slug will give them.
 * rehype-slug and this function both use github-slugger, so the table of
 * contents and the rendered anchors cannot disagree.
 */
export function headingsOf(body: string): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  for (const line of stripFences(body).split("\n")) {
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = inlineText(m[2]!);
    headings.push({ id: slugger.slug(text), text, depth: m[1]!.length as 2 | 3 });
  }
  return headings;
}

export function tableOfContents(body: string): Heading[] {
  return headingsOf(body).filter((h) => h.depth === 2);
}

export function hasTopLevelHeading(body: string): boolean {
  return /^#\s+\S/m.test(stripFences(body));
}

/** Strip inline Markdown so counts and slugs see the words a reader sees. */
export function inlineText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

/** Prose word count: no code blocks, no markup, no front matter, no tables' pipes. */
export function proseWordCount(body: string): number {
  const text = stripFences(body)
    .split("\n")
    .filter((line) => !/^\s*\|?\s*:?-{3,}/.test(line)) // table rules
    .map((line) => inlineText(line.replace(/^#{1,6}\s+/, "").replace(/\|/g, " ")))
    .join(" ");
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function firstParagraph(body: string): string {
  const blocks = stripFences(body)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(
      (b) => b && !/^#{1,6}\s/.test(b) && !/^[-*]\s/.test(b) && !/^\|/.test(b) && !/^>/.test(b),
    );
  return inlineText(blocks[0] ?? "");
}

export interface MarkdownLink {
  href: string;
  text: string;
  line: number;
  image: boolean;
  alt: string;
}

export function linksOf(body: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  let inFence = false;
  body.split("\n").forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) return;
    const re = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      links.push({
        image: m[1] === "!",
        alt: m[2]!,
        text: m[2]!,
        href: m[3]!,
        line: i + 1,
      });
    }
  });
  return links;
}

export function keywordInSlug(keyword: string, slug: string): boolean {
  return slug.includes(keyword.toLowerCase().trim().replace(/\s+/g, "-"));
}

export function keywordInText(keyword: string, text: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

/** Parse one file. Returns a post or the issues that make it invalid. */
export function parsePost(file: PostFile): { post?: Post; issues: PostIssue[] } {
  let fm: unknown;
  let body: string;
  try {
    const parsed = matter(file.raw);
    fm = parsed.data;
    body = parsed.content.trim();
  } catch (err) {
    return { issues: [{ path: file.path, message: `front matter: ${(err as Error).message}` }] };
  }
  const result = postFrontMatterSchema.safeParse(fm);
  if (!result.success) {
    return {
      issues: result.error.issues.map((i) => ({
        path: file.path,
        message: `${i.path.join(".") || "(root)"}: ${i.message}`,
      })),
    };
  }
  const expectedSlug = file.path.replace(/\\/g, "/").split("/").pop()!.replace(/\.md$/, "");
  const issues: PostIssue[] = [];
  if (result.data.slug !== expectedSlug) {
    issues.push({
      path: file.path,
      message: `slug "${result.data.slug}" must match the file name "${expectedSlug}"`,
    });
  }
  return { post: { ...result.data, body, sourcePath: file.path }, issues };
}

/** Parse every file, enforce cross-file invariants, sort newest first. */
export function parsePosts(files: PostFile[]): ParsedPosts {
  const posts: Post[] = [];
  const issues: PostIssue[] = [];
  for (const file of files) {
    const r = parsePost(file);
    issues.push(...r.issues);
    if (r.post) posts.push(r.post);
  }
  const bySlug = new Map<string, string>();
  for (const p of posts) {
    const prev = bySlug.get(p.slug);
    if (prev)
      issues.push({ path: p.sourcePath, message: `duplicate slug "${p.slug}" (also ${prev})` });
    bySlug.set(p.slug, p.sourcePath);
  }
  posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
  return { posts, issues };
}

export function publishedOnly(posts: Post[]): Post[] {
  return posts.filter((p) => !p.draft);
}

export function postPath(slug: string): string {
  return `${BLOG_PATH}/${slug}`;
}

/** Category pages have their own segment, so a category can never collide with a post slug. */
export function categoryPath(slug: string): string {
  return `${BLOG_PATH}/category/${slug}`;
}

export interface CategoryWithPosts extends Category {
  posts: Post[];
}

/**
 * Each category that has at least one of `posts`, in list order, with its
 * posts in the order given. An empty category is left out, so it gets no card,
 * no page and no sitemap entry.
 */
export function groupByCategory(
  posts: readonly Post[],
  categories: readonly Category[] = CATEGORIES,
): CategoryWithPosts[] {
  return categories
    .map((category) => ({
      ...category,
      posts: posts.filter((post) => post.category === category.slug),
    }))
    .filter((category) => category.posts.length > 0);
}
