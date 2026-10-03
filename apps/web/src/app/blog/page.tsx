import { ArrowRight, Rss } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getPublishedPosts } from "@/lib/blog/load";
import { BLOG_PATH, categoryPath, FEED_PATH, groupByCategory } from "@/lib/blog/schema";

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

/** The index is the categories, not the posts. Counts are published posts only. */
export default function BlogIndexPage() {
  const categories = groupByCategory(getPublishedPosts());
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Blog
          </h1>
          <p className="mt-2 max-w-xl text-ink-2">
            How to prepare for system design interviews with spaced repetition, and the ideas behind
            the cards. Pick a subject.
          </p>
        </div>
        <a
          href={FEED_PATH}
          className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
        >
          <Rss className="h-4 w-4" /> RSS
        </a>
      </div>
      {categories.length === 0 ? (
        <p className="mt-10 text-ink-2">No posts yet.</p>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={categoryPath(category.slug)}
                aria-label={`${category.name}, ${category.posts.length} ${category.posts.length === 1 ? "post" : "posts"}`}
                className="index-card group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <div className="flex-1 px-6 pt-6 pb-6">
                  <p className="font-mono text-xs text-ink-3">
                    {category.posts.length} {category.posts.length === 1 ? "post" : "posts"}
                  </p>
                  <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
                    {category.name}
                  </h2>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
                    {category.description}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 border-t border-rule/60 bg-paper-2/70 px-6 py-3.5 text-sm font-medium text-red-ink">
                  Read the posts
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
