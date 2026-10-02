import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate } from "@/components/blog/post-list";
import { TableOfContents } from "@/components/blog/toc";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPost, getPosts, getRelatedPosts } from "@/lib/blog/load";
import { BLOG_PATH, postPath, tableOfContents } from "@/lib/blog/schema";
import { GITHUB_URL } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = postPath(post.slug);
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: { card: "summary", title: post.title, description: post.description },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const toc = tableOfContents(post.body);
  const related = getRelatedPosts(post);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.metastack.app";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Person", name: post.author },
    publisher: { "@type": "Organization", name: "MetaStack", url: siteUrl },
    mainEntityOfPage: `${siteUrl}${postPath(post.slug)}`,
    keywords: [post.primaryKeyword, ...post.secondaryKeywords].join(", "),
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link
        href={BLOG_PATH}
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All posts
      </Link>

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10">
        <article
          className="index-card header-only min-w-0 px-6 pt-5 pb-8 sm:px-9"
          style={{ ["--rule-top" as string]: "68px" }}
        >
          <header className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            <span>·</span>
            <span>{post.author}</span>
            {post.draft && <Badge tone="amber">draft</Badge>}
            <span className="ml-auto flex gap-1">
              {post.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </span>
          </header>
          <h1 className="mt-6 font-display text-[1.75rem] leading-[1.2] font-bold tracking-tight text-ink sm:text-[2.25rem]">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">{post.description}</p>

          <div className="mt-8 lg:hidden">
            <TableOfContents headings={toc} />
          </div>

          <div className="mt-8">
            <Markdown source={post.body} headingIds className="blog-prose" />
          </div>

          <aside className="mt-12 rounded-2xl border border-rule bg-paper-2 px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="font-display text-lg font-semibold text-ink">
                Reading is the easy part.
              </p>
              <p className="mt-1 text-sm text-ink-2">
                Drill the cards behind this post. Progress stays in your browser. Sign in if you
                want a copy that follows you.
              </p>
            </div>
            <ButtonLink href="/study" className="mt-4 sm:mt-0">
              Start drilling
            </ButtonLink>
          </aside>

          <footer className="mt-10 flex flex-wrap items-center gap-3 border-t border-rule pt-6 text-sm text-ink-3">
            <span>
              {post.updatedAt && post.updatedAt !== post.publishedAt
                ? `Updated ${formatDate(post.updatedAt)}`
                : `Published ${formatDate(post.publishedAt)}`}
            </span>
            <a
              href={`${GITHUB_URL}/edit/main/${post.sourcePath}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto underline underline-offset-4 hover:text-ink"
            >
              Edit on GitHub
            </a>
          </footer>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <TableOfContents headings={toc} />
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-12 max-w-3xl">
          <h2 className="text-sm font-medium text-ink-2">Keep reading</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={postPath(r.slug)}
                  className="block h-full rounded-xl border border-rule bg-paper px-4 py-3 hover:border-rule-strong"
                >
                  <p className="font-display font-semibold text-ink">{r.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-2">{r.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
