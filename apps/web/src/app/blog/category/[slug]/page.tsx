import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostList } from "@/components/blog/post-list";
import { getPosts, getPublishedPosts } from "@/lib/blog/load";
import { BLOG_PATH, categoryPath, groupByCategory } from "@/lib/blog/schema";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

/** One page per category that has a published post. An empty category has no page. */
export function generateStaticParams() {
  return groupByCategory(getPublishedPosts()).map((category) => ({ slug: category.slug }));
}

function published(slug: string) {
  return groupByCategory(getPublishedPosts()).find((category) => category.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = published(slug);
  if (!category) return {};
  const url = categoryPath(category.slug);
  return {
    title: `${category.name} · Blog`,
    description: category.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: `${category.name} · MetaStack blog`,
      description: category.description,
    },
  };
}

export default async function BlogCategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = published(slug);
  if (!category) notFound();
  // Drafts preview in development, as they do on the post page. `getPosts` is newest first.
  const posts = getPosts().filter((post) => post.category === category.slug);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href={BLOG_PATH}
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All categories
      </Link>
      <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {category.name}
      </h1>
      <p className="mt-2 max-w-xl text-ink-2">{category.description}</p>
      <div className="mt-10">
        <PostList posts={posts} />
      </div>
    </div>
  );
}
