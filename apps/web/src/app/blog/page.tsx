import { Rss } from "lucide-react";
import type { Metadata } from "next";

import { PostList } from "@/components/blog/post-list";
import { getPosts } from "@/lib/blog/load";
import { BLOG_PATH, FEED_PATH } from "@/lib/blog/schema";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Notes on system design interview prep: spaced repetition, FSRS, estimation, and the concepts the MetaStack cards drill.",
  alternates: { canonical: BLOG_PATH, types: { "application/rss+xml": FEED_PATH } },
  openGraph: {
    title: "MetaStack blog",
    description:
      "Notes on system design interview prep: spaced repetition, FSRS, estimation, and the concepts the cards drill.",
    type: "website",
    url: BLOG_PATH,
  },
};

export default function BlogIndexPage() {
  const posts = getPosts();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Blog
          </h1>
          <p className="mt-2 max-w-xl text-ink-2">
            How to prepare for system design interviews with spaced repetition, and the ideas behind
            the cards.
          </p>
        </div>
        <a
          href={FEED_PATH}
          className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
        >
          <Rss className="h-4 w-4" /> RSS
        </a>
      </div>
      <div className="mt-10">
        {posts.length === 0 ? (
          <p className="text-ink-2">No posts yet.</p>
        ) : (
          <PostList posts={posts} />
        )}
      </div>
    </div>
  );
}
