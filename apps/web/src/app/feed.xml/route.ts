import { getPublishedPosts } from "@/lib/blog/load";
import { BLOG_PATH, postPath } from "@/lib/blog/schema";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.metastack.app";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const rfc822 = (iso: string) => new Date(`${iso}T00:00:00Z`).toUTCString();

export function GET() {
  const posts = getPublishedPosts();
  const items = posts
    .map(
      (p) => `    <item>
      <title>${escape(p.title)}</title>
      <link>${SITE_URL}${postPath(p.slug)}</link>
      <guid isPermaLink="true">${SITE_URL}${postPath(p.slug)}</guid>
      <pubDate>${rfc822(p.publishedAt)}</pubDate>
      <description>${escape(p.description)}</description>
${p.tags.map((t) => `      <category>${escape(t)}</category>`).join("\n")}
    </item>`,
    )
    .join("\n");
  const lastBuild = posts[0] ? rfc822(posts[0].updatedAt ?? posts[0].publishedAt) : undefined;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MetaStack blog</title>
    <link>${SITE_URL}${BLOG_PATH}</link>
    <description>Notes on system design interview prep: spaced repetition, FSRS, estimation, and the concepts the cards drill.</description>
    <language>en-us</language>
${lastBuild ? `    <lastBuildDate>${lastBuild}</lastBuildDate>\n` : ""}    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
