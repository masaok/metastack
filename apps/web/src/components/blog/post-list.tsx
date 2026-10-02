import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { postPath, type Post } from "@/lib/blog/schema";

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function PostList({ posts }: { posts: Post[] }) {
  return (
    <ol className="divide-y divide-rule/70">
      {posts.map((post) => (
        <li key={post.slug} className="py-7 first:pt-0">
          <article>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              {post.draft && <Badge tone="amber">draft</Badge>}
              {post.tags.slice(0, 3).map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
            <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              <Link href={postPath(post.slug)} className="hover:text-blue">
                {post.title}
              </Link>
            </h2>
            <p className="mt-2 max-w-2xl text-ink-2">{post.description}</p>
          </article>
        </li>
      ))}
    </ol>
  );
}
