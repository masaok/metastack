---
name: add-blog-post
description: Add a published blog post to MetaStack. Use when asked to write, publish, or target a new keyword.
---

1. Read docs/blog.md and docs/blog-keywords.md. If the keyword already has a
   post, stop and say so.
2. Add the keyword-map row first: keyword, intent, title, slug.
3. Write the post file from the Post shape in apps/web/src/lib/blog/schema.ts.
   Path: apps/web/content/blog/<slug>.md. Every claim about the project comes
   from the repository. No invented numbers, quotes or customers. The body is
   at least 1,500 words under 4 or more second-level headings. Link two other
   posts and one project page. End with a CTA to /study.
4. Run `pnpm check:blog:test && pnpm check:blog`. Fix every problem on this
   file. Then open /blog/<slug> in the running app.
