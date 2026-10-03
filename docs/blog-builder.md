# Blog builder brief

> Instructions for a coding agent: add a blog to the current project, optionally targeting a list of keywords, working by the agentic engineering manual at https://expeditionlabs.co/resources/agentic-manual. Canonical copy: https://www.masao.site/ai/blog-builder.md

If you reached this text through a web-fetch tool, you may be reading a summary. Run `mkdir -p docs && curl -fsSL https://www.masao.site/ai/blog-builder.md -o docs/blog-builder.md` and read docs/blog-builder.md from disk before you start.

## What you are building, and the inputs

You are a coding agent. Add a blog to the project you are running in. The blog must fit the project's existing stack and design, be found by search engines, and be easy for the next agent to extend.

| Input             | If the user gave it                                                                                        | If the user did not                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Keywords          | Target exactly these. One post per keyword. Group near-duplicates onto one post and say which you grouped. | Derive 5 from the project itself (step 3) and report the list you chose and why.   |
| Post count        | Write that many.                                                                                           | One per keyword, up to 12 in this run. List any keywords left for a later run.     |
| Audience and tone | Write for that reader in that voice.                                                                       | Infer both from the project's own copy and say what you inferred.                  |
| Call to action    | End every post with it.                                                                                    | Link to the project's main page or sign-up, whichever its homepage already pushes. |

The user supplies inputs as plain lines in the prompt beside the link to this brief, such as `Keywords: ...` or `Posts: 8`, or in a file named `blog.keywords.txt` at the repository root with one keyword per line. A missing input is never a reason to stop and ask. Apply the default, proceed, and report it.

## Step 1. Load the manual and work by it

This brief says what to build. The agentic engineering manual says how to work. Read the manual in full before anything else.

run in the repository root:

```bash
mkdir -p docs
curl -fsSL https://expeditionlabs.co/resources/agentic-manual/llms.txt -o docs/agentic-manual.md
```

- Read `docs/agentic-manual.md` from disk, in full. Do not fetch it with a web tool that summarizes.
- If the download fails, say so and carry on with this brief alone. Every step below names the technique it needs.
- **Precedence** is the manual's own: the user's direct instructions, then the project's agent instruction file, then the manual, then this brief. If the project says not to commit or push until asked, prepare the work and wait.
- In your final reply, name each manual rule that changed a decision and the decision it changed.

## Step 2. State the goal and the finish condition

Manual section 3, step 1: restate the goal as something that can pass or fail before you start. This is the finish condition. Do not relax it to declare victory.

1. The blog index responds at the blog route and lists every published post, newest first.
2. Every post responds at its own URL, and an unknown slug returns the project's not-found page.
3. Every keyword in the keyword map is owned by exactly one post, and that keyword appears in the post's title, slug, description and first paragraph.
4. Every post has a unique title and meta description, a canonical URL, social-preview tags and structured data of type `BlogPosting`.
5. If the project has a database, every post is a row in its `posts` table, written through one validated write function. If not, every post is a file in the repository.
6. Every published post body is at least 1,500 words, none of them padding.
7. Every post page shows a sidebar table of contents built from that post's headings, and each entry jumps to its section.
8. The sitemap lists the index and every post. A feed (RSS or Atom) lists every post and parses.
9. The project's navigation or footer links to the blog.
10. The content check (step 6) runs inside the project's verify command, and the verify command passes.
11. You opened the index and one post in a real browser at desktop and phone width, with the table of contents usable at both, no console errors and no horizontal overflow.

Copy the Feature playbook's steps from manual section 4 into your todo list verbatim, then add the steps of this brief beneath them. A step you skip stays in the list as `skip: <reason>`.

## Step 3. Understand the project before you edit

Manual section 3, step 3. Trace the project first. Answer these from the repository, and ask the user only what you cannot observe.

- **Stack.** Which framework and router render pages, how styles are written, and how existing pages set titles and metadata.
- **Conventions.** Where content and configuration already live, how components are named, and what the agent instruction file requires.
- **An existing blog.** If one exists, extend it. Do not build a second one beside it.
- **A database.** Whether one is available to the project: an ORM or query-builder config, a schema or migrations directory, a database driver among the dependencies, or a connection string in the environment files. Note the engine, the ORM and how migrations are created and run. This decides where posts are stored (step 4).
- **The verify command.** The one command that runs what CI runs. If there is none, building it is the first unit of work (manual section 6).
- **The product.** Read the README, the homepage copy and the feature list. This is the only source for what posts may claim about the project.
- **The reader.** Who the homepage is written for, and what they would search for before they knew this project existed.

### Choosing keywords when none were given

- Derive 5 keywords from what the project does and who it is for. Prefer specific phrases of three or more words that a person would type, over single broad terms.
- Cover different intents: at least one that teaches a concept, one that compares options, and one that solves a task the project helps with.
- You cannot measure search volume from inside a repository. Do not invent volume, difficulty or ranking numbers. Label the list as derived from the project, not from search data.

### If the project has no web surface

A library, a command-line tool or a service with no pages still gets a blog. Add the smallest static site the project's language supports, in its own directory such as `blog/` or `site/`, with its own build command wired into the verify command. Say plainly that you added a site, and why you chose that generator.

## Step 4. Name the data shape before the pages

Manual section 3, step 4, and the principles Foundational thinking and Model the domain. Two structures come first. Every page, check and feed is derived from them.

### The post

the post shape, in the project's own language:

```ts
type Post = {
  slug: string; // unique, lowercase, hyphenated, contains the primary keyword
  title: string; // at most 60 characters, contains the primary keyword
  description: string; // 120 to 160 characters, used as the meta description
  primaryKeyword: string; // exactly one, owned by this post alone
  secondaryKeywords: string[];
  tags: string[];
  author: string;
  createdAt: string; // ISO 8601, when the file was first written
  publishedAt: string; // ISO 8601, the date shown to readers
  updatedAt?: string; // ISO 8601, set only when the post changes
  draft: boolean; // drafts build locally and never ship
  body: string; // Markdown or the project's own content format,
  // at least 1,500 words under second-level headings
};
```

- Validate posts against a schema at the boundary where they are loaded, and trust the typed value everywhere after. In a TypeScript project use the schema library the project already has.
- One loader returns posts. The index, the post page, the sitemap and the feed all call it. None of them reads files on its own.
- Dates are real. `publishedAt` is the day the post is published. Do not backdate posts to make the blog look older than it is.

### Where posts are stored

| The project has     | Store posts in                   | How                                                                                                                                                                                                               |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A database (step 3) | A `posts` table in that database | Define the table with the project's ORM, next to its other tables. Create it with the project's migration tooling and run that migration. Do not hand-write SQL beside an ORM, and do not change existing tables. |
| No database         | Files in the repository          | One file per post, in the directory where the project keeps content, named by slug.                                                                                                                               |

Never add a database just for the blog. A project with no database gets files. Say in the reply which you chose and what you found that decided it.

the posts table, in the project's own ORM:

```text
posts
  slug               text        primary key
  title              text        not null
  description        text        not null
  primary_keyword    text        not null unique
  secondary_keywords text[]      not null default '{}'
  tags               text[]      not null default '{}'
  author             text        not null
  body               text        not null
  draft              boolean     not null default true
  created_at         timestamptz not null default now()
  published_at       timestamptz
  updated_at         timestamptz

index on (draft, published_at desc)  -- the index page and the feed
```

- **Constraints do the enforcing.** The slug is the primary key and the primary keyword is unique, so a second post cannot take a slug or keyword already in use, whatever code wrote it.
- **One write path.** A single function validates a post against the schema and the content rules (step 6), then upserts it by slug. The seed script, the add-a-post skill and any future editor all call it. Nothing else writes the table.
- **One read path.** The loader queries the table and validates each row before returning it, just as it would validate a file.
- **Seed what this run writes.** An idempotent seed script upserts this run's posts by slug, so a fresh or preview database can be filled with one command. Once seeded, the database is the source of truth. The seed fills a new database and never overwrites rows that were edited later.
- **Static pages stay fresh.** Pages built ahead of time are rebuilt or revalidated when the write function saves a post, so a saved post shows up without a deploy.
- **Credentials stay on the server.** Only server code reads the posts table. No connection string or key reaches the browser.

### The keyword map

docs/blog-keywords.md:

```markdown
| Keyword   | Intent                     | Post title | Slug   | Status  |
| --------- | -------------------------- | ---------- | ------ | ------- |
| <keyword> | learn / compare / do / buy | <title>    | <slug> | planned |
```

- One keyword, one post. Two posts chasing the same keyword compete with each other. If two keywords mean the same thing, give both to one post as primary and secondary.
- Each keyword must be able to carry a post of at least 1,500 words. Fold one that is too narrow into a broader post as a secondary keyword.
- Write the map before any post. It is the plan the user reviews, and the content check reads it.
- This is the feature map from manual section 6, applied to content: a table that turns "what covers X?" into a lookup.

## Step 5. Build in verifiable units

Manual principle Sequence verifiable units. Each unit ends in a check you run before starting the next. Write the throughput checkpoint first.

| Checkpoint item             | For this task                                                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blocking first steps        | Units 1 to 4 below. No post is written until the loader, the pages and the content check exist.                                                                                   |
| Independent workstreams     | The posts. Each is its own record and can be written in parallel (step 7).                                                                                                        |
| Shared mutable state        | The keyword map, the `posts` table and any shared index file. Only the lead agent writes them. Post writers return their post and their keyword-map row, and the lead saves both. |
| Smallest safe decomposition | One owner for the scaffold. One worker per post.                                                                                                                                  |

1. **Content model and loader.** The post schema, the storage (the `posts` table and its migration, run, or the content directory), the write function, the loader, and one fixture post. Check: the loader returns the fixture, a post with a missing field fails with a message that names the field, and with a database, writing a second post with a taken slug or primary keyword is refused.
2. **Index page.** Lists published posts, newest first, with title, description, date and tags. Check: open it in the running app.
3. **Post page.** Renders one post with its title as the only top-level heading, the date, a sidebar table of contents, the call to action, and links to related posts. Check: open the fixture post, click a table-of-contents entry, and confirm an unknown slug returns not-found.
4. **Search surface.** Per-post title, description and canonical URL, social-preview tags, `BlogPosting` structured data, sitemap entries, and a feed. Check: read each one from the built output, not from the source.
5. **Navigation.** A link to the blog from the project's main navigation or footer. Check: click it.
6. **Posts.** Step 7.

- Match the project's design. Reuse its layout, type scale, colors and components. A blog that looks like a different site is a defect.
- Use the project's rendering defaults. Prefer pages that are built ahead of time, since blog content rarely changes per request. With a database, revalidate them when a post is saved.
- Work in a branch or worktree per the manual's isolation rules, unless the project's own rules say otherwise.

### The table of contents sidebar

- **On every post.** Not only the long ones. Every post has enough sections to need it (step 6).
- **Derived, never typed.** Build the entries from the post's second-level headings with the same code that gives those headings their anchors. A hand-written list drifts from the body.
- **One level.** List second-level headings only. Deeper headings stay in the body.
- **Beside the body.** At desktop width it sits in a column next to the post and stays in view while the reader scrolls. Keep it vertically compact.
- **Still there on a phone.** At narrow widths it moves above the body, collapsed or as a short list. It never causes horizontal overflow and it is never simply hidden.
- **Shows the reader's place.** The entry for the section in view is marked, and following an entry lands with the heading visible, not under a fixed header.
- **Accessible.** It is a navigation landmark labeled as the table of contents, and its entries are real links that work without scripts.

## Step 6. Encode the rules as a check

Manual section 6, Hard guardrails, and the principle Encode lessons in structure. The rules below are not advice for whoever writes the next post. They are a content check that fails the build.

| Rule                         | The check fails when                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Valid shape                  | A post does not match the schema.                                                                               |
| Unique slugs                 | Two posts share a slug.                                                                                         |
| One owner per keyword        | A primary keyword is claimed by two posts, or a mapped keyword has no post.                                     |
| Keyword placement            | The primary keyword is missing from the title, slug, description or first paragraph.                            |
| Title and description length | A title is over 60 characters, or a description is outside 120 to 160.                                          |
| One top-level heading        | A post body contains its own top-level heading.                                                                 |
| Minimum length               | A non-draft post body has fewer than 1,500 words. Count prose only: no code blocks, no markup, no front matter. |
| Sections for the sidebar     | A non-draft post has fewer than 4 second-level headings, or two of its headings produce the same anchor.        |
| Links resolve                | An internal link points at a route or post that does not exist.                                                 |
| Images described             | An image has no alt text.                                                                                       |
| Honest dates                 | `publishedAt` is in the future on a non-draft, or is before `createdAt`.                                        |
| Drafts stay home             | A draft appears in the sitemap or the feed.                                                                     |

- Write the check as a script the verify command runs, in the project's language. With a database, the write function runs the same rules before every save, and the check runs them over the rows the loader returns. If the verify command cannot reach a database, it runs the check over the seed posts and says so.
- **Prove it can fail.** For each rule, keep a fixture that breaks it and a test that asserts the check rejects that fixture. A check you have never watched fail is not trustworthy.
- Keep the check read-only. It reports. It never rewrites a post.
- The length rule sets a floor. It cannot tell substance from filler, so the review in step 7 still reads every post for padding.
- Do not add a keyword-density rule. Repeating a phrase to satisfy a counter makes posts worse and is the kind of stuffing search engines penalize.

## Step 7. Write the posts

Manual section 8. The posts are independent slices, so fan them out: one worker per post, one aggregated report. The scaffold and the check must already be merged into the working branch.

### The brief each worker gets

- The keyword-map row it owns, and the rows it does not, so it can link to them without competing with them.
- The post shape, where to write its draft (a file the lead will save, or the post file itself), and one finished post as the pattern. Workers never write to the database.
- The project facts it may use, as file paths to read. Not pasted text.
- How to verify: run the content check and open the post in the running app.
- What to report: `PASS`, `ISSUES` or `BLOCKED`, with the post path and its keyword-map row.

### What every post must be

- **Useful on its own.** It answers the question behind the keyword completely enough that the reader does not need another page. Lead with the answer.
- **True.** Every claim about the project comes from the repository. No invented statistics, studies, quotes, customers, testimonials or benchmarks. If a number would help and you do not have it, leave it out.
- **Concrete.** Include at least one thing a reader can use directly: a worked example, a comparison table, a checklist, or code that runs.
- **Connected.** Link to two other posts and to one page of the project, with link text that says what is on the other side.
- **Honest about the project.** Mention it where it helps the reader. A post that is an advert with a keyword on top fails review.
- **Written to the manual's prose rules** (section 12): plain words, active voice, one idea per sentence, no stock machine phrasing, no keyword stuffing.
- **At least 1,500 words, all of them earned.** Reach the length by covering more of the question: the sub-questions a reader asks next, a worked example, the edge cases, the common mistakes, how to choose between options. Never by restating, long introductions or filler. If a keyword cannot carry 1,500 useful words, it is too narrow for its own post: make it a secondary keyword of a broader post and say so.
- **Sectioned for the sidebar.** At least 4 second-level headings, each one naming what its section answers. They become the table of contents, so a reader should be able to follow the post from the headings alone.

### Review before they ship

- The judge is never the author. A reviewer that did not write the post reads each one against this list.
- It flags every claim it cannot trace to the repository or to common knowledge. An untraceable claim is removed, not softened.
- It checks the set as a whole for two posts answering the same question.
- It flags padding: a section that repeats another, or that could be deleted without the reader losing anything. Padding is replaced with substance, and the post still clears the length floor afterwards.
- Sort findings into `Act on`, `Consider`, `Noted` and `Dismissed`, with a reason for each dismissal.

## Step 8. Prove it on the real surface

Manual section 5. "It builds" is not evidence. Run the real thing and paste what happened. A check that could not run is reported as inconclusive, not skipped.

| Claim                                 | Proof                                                                                                                                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The pages work                        | Open the index, one post and an unknown slug in a real browser. Paste the status and what rendered.                                                                                                                                                                |
| It fits the site                      | Screenshots of the index and a post at desktop and phone width, with no horizontal overflow and no console errors.                                                                                                                                                 |
| The table of contents works           | On one post at desktop width, click an entry and paste where the page landed. At phone width, show where the table of contents sits. Confirm its entries match the post's headings.                                                                                |
| Posts are long enough                 | The word count of every post, from the content check's own output.                                                                                                                                                                                                 |
| Posts are stored where the brief says | With a database: the migration output, then a query of the `posts` table showing every slug and its draft flag, matching the index. Then edit one post through the write function and show the page change without a rebuild. Without one: the list of post files. |
| Metadata is right                     | Read the title, description, canonical URL, social tags and structured data from the served HTML of one post.                                                                                                                                                      |
| Search engines can find it            | Fetch the sitemap and the feed from the running app. Every post is in both, and the feed parses.                                                                                                                                                                   |
| The check works                       | The verify command output, plus the test run showing each rule rejects its failing fixture.                                                                                                                                                                        |
| Navigation works                      | Click from the homepage to the blog and from the index to a post.                                                                                                                                                                                                  |

If the project has a verification skill that drives the app, use it. If it has none and the project has a web surface, say that it is missing. Building one is manual section 5 and is worth proposing as follow-up work.

## Step 9. Leave it extendable, then ship

Manual sections 6, 10 and 11. The next post should be a lookup and a skill run, not a rediscovery.

- **`docs/blog.md`.** A living document: where posts live (the table or the directory, and why), the post shape, the write function and the seed command, how to add one, what the content check enforces, and how to run it.
- **A skill for adding a post.** Save it in the project's skills directory, adapted to the real paths. Run it once by hand to add the last post of this run, so you know it works.
- **The feature map.** If the project keeps one, add rows for the blog index, the post page, the sitemap and the feed. If it does not, list those surfaces in `docs/blog.md`.
- **The agent instruction file.** Add one line pointing at `docs/blog.md`. Do not paste the rules into it. The check enforces them.
- **A decision log** if the run was long or unattended (manual section 10): keywords chosen, generator chosen, anything grouped, skipped or reverted.

the add-a-post skill, to adapt:

```markdown
---
name: add-blog-post
description: Add one post to the blog. Use when asked to write, add or
  publish a blog post, or to target a new keyword.
---

1. Read docs/blog.md and the keyword map. If the keyword already has a
   post, improve that post instead of writing a second one.
2. Add the keyword-map row first: keyword, intent, title, slug.
3. Write the post from the Post shape. With a database, save it through
   the one write function (it validates, then upserts by slug). Without
   one, write the post file. Every claim about the project
   comes from the repository. No invented numbers, quotes or customers.
   The body is at least 1,500 words under 4 or more second-level
   headings. The sidebar table of contents is built from those headings.
4. Link to two other posts and to one page of the project.
5. Run the verify command. The content check must pass.
6. Open the post in the running app, click an entry in its sidebar table
   of contents, and paste what you saw.
```

- Commit in the order the units were built, so the history proves itself: model, storage and loader, pages, search surface, check with its fixtures, then posts. The migration goes in the same commit as the table it creates.
- Follow the project's rules on committing, pushing and pull requests. Where they are silent, open one pull request whose description has Why, Scope, Blast radius and Verification (manual section 11).
- Do not deploy, and do not submit the sitemap to any search console. Those are the user's to do.

## The reply

End with one reply in this order. Short declarative sentences, and every claim labeled measured, inferred or guess.

1. What exists now and for whom: the blog URL, the number of posts, where a reader finds it.
2. The keyword map as a table, saying which keywords were given and which you derived.
3. The defaults you applied for inputs the user did not give, each with the one word that reverses it.
4. Where posts are stored, database or files, and what you found that decided it.
5. The finish condition, item by item, each with its proof or marked inconclusive.
6. The manual rules that changed a decision, and the decision.
7. What needs the user: deploying, search-console submission, any claim a post could not make without facts you did not have.
8. **Attention.** What deserves the user's scrutiny first. "No flags" is a valid value.
