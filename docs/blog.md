# Blog

Posts live in `apps/web/content/blog/<slug>.md`. The page is `/blog/<slug>`. The index is `/blog` and shows one card per category. A category page is `/blog/category/<slug>`. The feed is `/feed.xml`. The sitemap includes the index, every category page and every published post.

## Shape

Front matter is the `Post` schema in `apps/web/src/lib/blog/schema.ts`. The one loader is `getPosts()` in `apps/web/src/lib/blog/load.ts`. Drafts preview in development and never appear in the production sitemap or feed.

## Categories

The list is `CATEGORIES` in `apps/web/src/lib/blog/schema.ts`: a slug, a name and a description each. It is the only place a category is defined, and its order is the order of the cards on the index.

- A post names exactly one category by slug in its `category` front matter. The schema rejects a slug that is not in the list. Tags stay free-form.
- The index lists categories, not posts. Each card shows the name, the description and the count of published posts, and the whole card links to the category page.
- A category page lists that category's posts, newest first. A category with no published post has no card, no page and no sitemap entry. An unknown category is a 404.
- Post URLs do not contain the category, so a post that moves category keeps its URL.
- The content check enforces balance once there are four published posts: at least two categories, at least two published posts in each, and the largest at most twice the smallest. Fix a failure with a post in the smaller category or a better split, never by filing a post where it does not belong.

To add a category, add it to `CATEGORIES` only when two or more posts will live in it, and file those posts in the same change.

## Keywords

One keyword, one post. The map is `docs/blog-keywords.md`. Each row also names the post's category, and the check fails if the post disagrees. The content check fails if a mapped keyword has no post, or if two posts share a primary keyword.

## Adding a post

Use the `add-blog-post` skill. In short: count the posts per category and pick the one the topic fits (the smaller one when it fits two), add the keyword-map row with that category, write the Markdown file, run `pnpm check:blog:test && pnpm check:blog`, then open the post in the running app.

## Checks

`pnpm check:blog:test` proves every rule can fail. `pnpm check:blog` runs the rules on the real posts. CI job name: `blog`.
