import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PostList } from "@/components/blog/post-list";
import { getPosts } from "@/lib/blog/load";
import { BLOG_PATH, FEED_PATH, RECENT_PATH } from "@/lib/blog/schema";

export const metadata: Metadata = {
  title: "Recent posts · Blog",
  description:
    "Every MetaStack blog post, newest first: study method, data, traffic, worked designs, caches, architecture, consensus and ops.",
  alternates: { canonical: RECENT_PATH, types: { "application/rss+xml": FEED_PATH } },
  openGraph: {
    title: "Recent posts · MetaStack blog",
    description:
      "Every MetaStack blog post, newest first: study method, data, traffic, worked designs, caches, architecture, consensus and ops.",
    type: "website",
    url: RECENT_PATH,
  },
};

/** All posts in one list, newest first. `getPosts` already sorts that way. */
export default function BlogRecentPage() {
  const posts = getPosts();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href={BLOG_PATH}
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All categories
      </Link>
      <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Recent posts
      </h1>
      <p className="mt-2 max-w-xl text-ink-2">
        Every published post, newest first. Same list as the feed, without picking a subject.
      </p>
      <div className="mt-10">
        {posts.length === 0 ? (
          <p className="text-ink-2">No posts yet.</p>
        ) : (
          <PostList posts={posts} showCategory />
        )}
      </div>
    </div>
  );
}
