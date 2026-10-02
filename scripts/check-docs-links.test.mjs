#!/usr/bin/env node
// Proof-of-failure test for scripts/check-docs-links.mjs.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkDocs, slugify } from "./check-docs-links.mjs";

let failures = 0;
function assert(cond, label) {
  if (cond) console.log(`ok   - ${label}`);
  else {
    console.log(`FAIL - ${label}`);
    failures++;
  }
}

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "check-docs-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

// slug rules
assert(
  slugify("Why FSRS and not a fixed schedule") === "why-fsrs-and-not-a-fixed-schedule",
  "slug: words",
);
assert(
  slugify("ADR 0002: FSRS over SM-2") === "adr-0002-fsrs-over-sm-2",
  "slug: punctuation dropped, hyphens kept",
);
assert(slugify("`packages/content`") === "packagescontent", "slug: code ticks and slashes dropped");

// clean tree passes
{
  const dir = fixture({
    "README.md":
      "# Title\n\nSee [arch](docs/ARCH.md#packages) and [self](#title).\n\n![logo](logo.svg)\n",
    "docs/ARCH.md": "# Architecture\n\n## Packages\n\nBack to [readme](../README.md).\n",
    "logo.svg": "<svg/>",
  });
  const r = checkDocs(dir);
  assert(r.files === 2 && r.problems.length === 0, "clean fixture passes");
  rmSync(dir, { recursive: true });
}

// broken relative link fails
{
  const dir = fixture({ "README.md": "[missing](docs/NOPE.md)\n" });
  const r = checkDocs(dir);
  assert(
    r.problems.length === 1 && /broken link/.test(r.problems[0]),
    "broken relative link is reported",
  );
  rmSync(dir, { recursive: true });
}

// missing anchor in another document fails
{
  const dir = fixture({
    "README.md": "[a](docs/A.md#not-here)\n",
    "docs/A.md": "# A\n\n## Here\n",
  });
  const r = checkDocs(dir);
  assert(
    r.problems.length === 1 && /missing anchor/.test(r.problems[0]),
    "missing cross-document anchor is reported",
  );
  rmSync(dir, { recursive: true });
}

// missing same-document anchor fails
{
  const dir = fixture({ "README.md": "# Top\n\n[x](#nope)\n" });
  const r = checkDocs(dir);
  assert(
    r.problems.length === 1 && /missing anchor/.test(r.problems[0]),
    "missing same-document anchor is reported",
  );
  rmSync(dir, { recursive: true });
}

// duplicate headings get -1 suffixes
{
  const dir = fixture({
    "README.md": "# Setup\n\n# Setup\n\n[a](#setup) [b](#setup-1) [c](#setup-2)\n",
  });
  const r = checkDocs(dir);
  assert(
    r.problems.length === 1 && /#setup-2/.test(r.problems[0]),
    "duplicate heading suffixes handled",
  );
  rmSync(dir, { recursive: true });
}

// links inside code fences are ignored; external URLs are not fetched
{
  const dir = fixture({
    "README.md": "```md\n[x](nope.md)\n```\n\n[ext](https://example.invalid/never-fetched)\n",
  });
  const r = checkDocs(dir);
  assert(r.problems.length === 0, "fenced links ignored, external links not fetched");
  rmSync(dir, { recursive: true });
}

// broken image fails
{
  const dir = fixture({ "README.md": "![logo](missing.svg)\n" });
  const r = checkDocs(dir);
  assert(
    r.problems.length === 1 && /broken link/.test(r.problems[0]),
    "broken image path is reported",
  );
  rmSync(dir, { recursive: true });
}

// new untracked files are included (the checker walks the filesystem, not git)
{
  const dir = fixture({ "docs/new-untracked.md": "[x](nowhere.md)\n" });
  const r = checkDocs(dir);
  assert(r.problems.length === 1, "untracked markdown files are enumerated");
  rmSync(dir, { recursive: true });
}

if (failures > 0) {
  console.error(`check-docs-links.test: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("check-docs-links.test: all assertions passed");
