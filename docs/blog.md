# Blog

Posts live in `apps/web/content/blog/<slug>.md`. The page is `/blog/<slug>`. The index is `/blog`. The feed is `/feed.xml`. The sitemap includes every published post.

## Shape

Front matter is the `Post` schema in `apps/web/src/lib/blog/schema.ts`. The one loader is `getPosts()` in `apps/web/src/lib/blog/load.ts`. Drafts preview in development and never appear in the production sitemap or feed.

## Keywords

One keyword, one post. The map is `docs/blog-keywords.md`. The content check fails if a mapped keyword has no post, or if two posts share a primary keyword.

## Adding a post

Use the `add-blog-post` skill. In short: add the keyword-map row, write the Markdown file, run `pnpm check:blog:test && pnpm check:blog`, then open the post in the running app.

## Checks

`pnpm check:blog:test` proves every rule can fail. `pnpm check:blog` runs the rules on the real posts. CI job name: `blog`.
