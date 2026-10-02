#!/usr/bin/env tsx
// Proof of failure for every rule in check-blog.ts. A rule with no failing
// fixture here is not enforced. Run: pnpm check:blog:test
import assert from "node:assert/strict";

import { checkBlog, RULES, type CheckInput } from "./check-blog";

const TODAY = "2026-10-02";

const sentence =
  "Caches answer reads before the database does, so the write strategy decides what a stale read can cost.";
const paragraph = (n: number) => Array.from({ length: n }, () => sentence).join(" ");

function body(opts: { keyword?: string; sections?: number; words?: number; extra?: string } = {}) {
  const keyword = opts.keyword ?? "cache write strategies";
  const sections = opts.sections ?? 4;
  const perSection = Math.ceil((opts.words ?? 1600) / sections / 17);
  const parts = [
    `This post is about ${keyword} and why interviewers ask about them. ${paragraph(2)}`,
    `Related: [write-behind](/blog/write-behind-caches) and [TTL](/blog/cache-ttl), plus the [study page](/study).`,
  ];
  for (let i = 1; i <= sections; i++) {
    parts.push(`## Section ${i}\n\n${paragraph(perSection)}`);
  }
  if (opts.extra) parts.push(opts.extra);
  return parts.join("\n\n");
}

function post(
  overrides: Partial<Record<string, unknown>> = {},
  bodyText = body(),
  file = "cache-write-strategies.md",
) {
  const fm: Record<string, unknown> = {
    slug: "cache-write-strategies",
    title: "Cache write strategies explained for interviews",
    description:
      "Write-through, write-back and write-around, what each costs on a miss, and how to pick one when the interviewer asks about cache write strategies.",
    primaryKeyword: "cache write strategies",
    secondaryKeywords: ["write-through vs write-back"],
    tags: ["caching"],
    createdAt: "2026-09-30",
    publishedAt: "2026-10-01",
    draft: false,
    ...overrides,
  };
  const yaml = Object.entries(fm)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return { path: `apps/web/content/blog/${file}`, raw: `---\n${yaml}\n---\n\n${bodyText}\n` };
}

/** A second published post whose slug is the hyphenated keyword. It links to the main post instead of itself. */
function other(keyword: string, overrides: Partial<Record<string, unknown>> = {}) {
  const slug = keyword.replace(/\s+/g, "-");
  return post(
    {
      slug,
      title: `${keyword} for interviews`,
      description:
        `${keyword}: ${"a long enough description about this topic that fits the window ".repeat(2)}`.slice(
          0,
          140,
        ),
      primaryKeyword: keyword,
      publishedAt: "2026-09-20",
      createdAt: "2026-09-19",
      ...overrides,
    },
    body({ keyword }).replace(`/blog/${slug}`, "/blog/cache-write-strategies"),
    `${slug}.md`,
  );
}

const others = () => [other("write-behind caches"), other("cache ttl")];

const keywordsDoc = (keywords: string[]) =>
  [
    "| Keyword | Intent | Post title | Slug | Status |",
    "| --- | --- | --- | --- | --- |",
    ...keywords.map((k) => `| ${k} | learn | t | s | published |`),
  ].join("\n");

const goodConsumers = [
  { path: "apps/web/src/app/sitemap.ts", source: "const posts = getPublishedPosts();" },
  { path: "apps/web/src/app/feed.xml/route.ts", source: "const posts = getPublishedPosts();" },
];

function input(overrides: Partial<CheckInput> = {}): CheckInput {
  return {
    files: [post(), ...others()],
    keywordsDoc: keywordsDoc(["cache write strategies", "write-behind caches", "cache ttl"]),
    routes: new Set(["/", "/study", "/decks", "/cards", "/settings", "/cards/url-shortener"]),
    consumers: goodConsumers,
    today: TODAY,
    ...overrides,
  };
}

const rulesOf = (problems: ReturnType<typeof checkBlog>) => new Set(problems.map((p) => p.rule));

function expectPass(label: string, i: CheckInput) {
  const problems = checkBlog(i);
  assert.deepEqual(problems, [], `${label}: expected no problems, got ${JSON.stringify(problems)}`);
}

function expectFail(rule: keyof typeof RULES, label: string, i: CheckInput) {
  const rules = rulesOf(checkBlog(i));
  assert.ok(
    rules.has(rule),
    `${label}: expected rule "${rule}" to fail, got ${[...rules].join(", ") || "nothing"}`,
  );
  seen.add(rule);
}

const seen = new Set<string>();

expectPass("valid fixture", input());

const withMain = (main: ReturnType<typeof post>) => input({ files: [main, ...others()] });

expectFail("shape", "missing tags", withMain(post({ tags: undefined })));
expectFail("shape", "slug does not match file name", withMain(post({ slug: "other" })));
expectFail("shape", "bad date", withMain(post({ publishedAt: "yesterday" })));
expectFail(
  "shape",
  "duplicate slug",
  input({ files: [post(), post({}, body(), "dup/cache-write-strategies.md"), ...others()] }),
);

expectFail(
  "keyword-map",
  "keyword not in map",
  input({ keywordsDoc: keywordsDoc(["write-behind caches", "cache ttl"]) }),
);
expectFail(
  "keyword-map",
  "row with no post",
  input({
    keywordsDoc: keywordsDoc([
      "cache write strategies",
      "write-behind caches",
      "cache ttl",
      "orphan keyword",
    ]),
  }),
);
expectFail(
  "keyword-map",
  "two posts own one keyword",
  input({
    files: [
      post(),
      other("write-behind caches", { primaryKeyword: "cache write strategies" }),
      other("cache ttl"),
    ],
  }),
);

expectFail(
  "keyword-placement",
  "keyword missing from title",
  withMain(post({ title: "Write policies for caches" })),
);
expectFail(
  "keyword-placement",
  "keyword missing from first paragraph",
  withMain(post({}, body({ keyword: "write policy" }))),
);

expectFail(
  "title-length",
  "61-character title",
  withMain(post({ title: "Cache write strategies explained for interviews, at some length" })),
);
expectFail(
  "description-length",
  "short description",
  withMain(post({ description: "Too short." })),
);
expectFail(
  "description-length",
  "long description",
  withMain(post({ description: "x".repeat(161) })),
);

expectFail("no-h1", "h1 in body", withMain(post({}, `# Title\n\n${body()}`)));
expectFail("min-words", "1,000 words", withMain(post({}, body({ words: 1000 }))));
expectFail("sections", "three h2s", withMain(post({}, body({ sections: 3 }))));
expectFail("internal-links", "unknown route", withMain(post({}, body({ extra: "[x](/nowhere)" }))));
expectFail(
  "internal-links",
  "unknown post",
  withMain(post({}, body({ extra: "[x](/blog/missing)" }))),
);
expectFail("internal-links", "unknown anchor", withMain(post({}, body({ extra: "[x](#nope)" }))));
expectFail(
  "internal-links",
  "published post links to a draft",
  input({
    files: [post(), other("write-behind caches"), other("cache ttl", { draft: true })],
  }),
);

expectFail(
  "related-links",
  "only one other post",
  withMain(post({}, body().replace("[TTL](/blog/cache-ttl)", "TTL"))),
);
expectFail(
  "related-links",
  "no project page",
  withMain(post({}, body().replace("(/study)", "(https://example.com)"))),
);

expectFail(
  "image-alt",
  "image without alt",
  withMain(post({}, body({ extra: "![](/diagram.png)" }))),
);

expectFail(
  "dates",
  "published before created",
  withMain(post({ createdAt: "2026-10-02", publishedAt: "2026-10-01" })),
);
expectFail("dates", "updated before published", withMain(post({ updatedAt: "2026-09-01" })));
expectFail("dates", "published in the future", withMain(post({ publishedAt: "2026-12-01" })));

expectFail(
  "drafts-stay-home",
  "sitemap uses getPosts",
  input({
    consumers: [{ path: "apps/web/src/app/sitemap.ts", source: "const posts = getPosts();" }],
  }),
);

expectPass(
  "draft is exempt from prose rules",
  input({
    files: [
      post(),
      ...others(),
      post(
        {
          slug: "wip-topic",
          title: "Wip topic",
          primaryKeyword: "wip topic",
          description:
            `A wip topic draft: ${"not finished yet, but the description already fits the length window ".repeat(2)}`.slice(
              0,
              140,
            ),
          draft: true,
        },
        "Short draft about a wip topic.",
        "wip-topic.md",
      ),
    ],
    keywordsDoc: keywordsDoc([
      "cache write strategies",
      "write-behind caches",
      "cache ttl",
      "wip topic",
    ]),
  }),
);

const untested = Object.keys(RULES).filter((r) => !seen.has(r));
assert.deepEqual(untested, [], `rules without a failing fixture: ${untested.join(", ")}`);

console.log(
  `check-blog.test: ${Object.keys(RULES).length} rules each proven to fail, valid fixture passes`,
);
