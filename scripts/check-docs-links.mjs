#!/usr/bin/env node
// Offline link-and-anchor checker for Markdown files.
//
// Checks every relative link and every same-document or cross-document
// heading anchor in *.md files. External URLs are deliberately not fetched:
// a network-dependent check would flake, and a flaky required check is worse
// than none. Proof-of-failure test: scripts/check-docs-links.test.mjs
//
// Usage: node scripts/check-docs-links.mjs [rootDir]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "coverage",
  "generated",
  "test-results",
  "playwright-report",
]);

export function listMarkdownFiles(root, extraIgnored = []) {
  const ignored = new Set([...IGNORED_DIRS, ...extraIgnored]);
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (ignored.has(entry)) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith(".md")) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

/** GitHub-style heading slugs. */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function headingAnchors(markdown) {
  const anchors = new Set();
  const counts = new Map();
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = slugify(m[1]);
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  return anchors;
}

export function extractLinks(markdown) {
  const links = [];
  let inFence = false;
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const re = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let m;
    while ((m = re.exec(line))) {
      if (m[0].startsWith("!")) continue; // images are checked by existence below too, but skip anchors
      links.push({ target: m[1], line: i + 1 });
    }
    const img = /!\[[^\]]*\]\(([^)\s]+)\)/g;
    while ((m = img.exec(line))) links.push({ target: m[1], line: i + 1, image: true });
  }
  return links;
}

function isExternal(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//");
}

export function checkDocs(root, { ignore = [] } = {}) {
  const files = listMarkdownFiles(root, ignore);
  const anchorCache = new Map();
  const anchorsOf = (file) => {
    if (!anchorCache.has(file)) anchorCache.set(file, headingAnchors(readFileSync(file, "utf8")));
    return anchorCache.get(file);
  };
  const problems = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const { target, line, image } of extractLinks(text)) {
      if (isExternal(target)) continue;
      const [pathPart, hash] = target.split("#");
      const decodedPath = decodeURIComponent(pathPart);
      const resolved = decodedPath === "" ? file : resolve(dirname(file), decodedPath);
      const rel = relative(root, file).split(sep).join("/");

      if (!existsSync(resolved)) {
        problems.push(`${rel}:${line} broken link: ${target}`);
        continue;
      }
      if (hash !== undefined && !image) {
        if (statSync(resolved).isDirectory()) {
          problems.push(`${rel}:${line} anchor on a directory: ${target}`);
          continue;
        }
        if (!resolved.endsWith(".md")) continue;
        if (!anchorsOf(resolved).has(hash.toLowerCase())) {
          problems.push(`${rel}:${line} missing anchor: ${target}`);
        }
      }
    }
  }
  return { files: files.length, problems };
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2);
  const ignore = args
    .filter((a) => a.startsWith("--ignore="))
    .flatMap((a) => a.slice("--ignore=".length).split(","))
    .filter(Boolean);
  const positional = args.filter((a) => !a.startsWith("--"));
  const root = resolve(positional[0] ?? ".");
  const { files, problems } = checkDocs(root, { ignore });
  for (const p of problems) console.error(`::error::${p}`);
  if (problems.length > 0) {
    console.error(`check-docs: ${problems.length} problem(s) in ${files} file(s)`);
    process.exit(1);
  }
  console.log(`check-docs: ok (${files} markdown files, relative links and anchors verified)`);
}
