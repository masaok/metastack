import { getPublishedPosts } from "@/lib/blog/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

/**
 * Post count for the domains dashboard. Same set as the blog index, sitemap
 * and feed: `getPublishedPosts()`, newest first, drafts excluded.
 */
export async function GET() {
  try {
    const posts = getPublishedPosts();
    return Response.json(
      {
        posts: posts.length,
        latest: posts[0]?.publishedAt ?? null,
        categories: new Set(posts.map((p) => p.category)).size,
      },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("[blog/meta]", error);
    return Response.json({ error: "blog content unavailable" }, { status: 503 });
  }
}
