/**
 * Build-time compiler: reads `cards/<deck>/<id>.md`, validates each file with
 * the Zod schema, enforces cross-file invariants, and returns the compiled
 * card list. Used by `scripts/compile.ts` (writes JSON) and `scripts/validate.ts`
 * (CI gate). Node-only; the web app never imports this module.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import matter from "gray-matter";

import { DECK_SLUGS, frontMatterSchema, type Card } from "./schema";

export interface CompileIssue {
  file: string;
  message: string;
}

export interface CompileResult {
  cards: Card[];
  issues: CompileIssue[];
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out.sort();
}

export function compileSource(
  files: ReadonlyArray<{ path: string; source: string }>,
  rootDir = "",
): CompileResult {
  const issues: CompileIssue[] = [];
  const cards: Card[] = [];
  const seen = new Map<string, string>();

  for (const { path, source } of files) {
    const file = rootDir ? relative(rootDir, path) : path;
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(source);
    } catch (err) {
      issues.push({ file, message: `invalid front matter: ${(err as Error).message}` });
      continue;
    }

    const result = frontMatterSchema.safeParse(parsed.data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({ file, message: `${issue.path.join(".") || "(root)"}: ${issue.message}` });
      }
      continue;
    }

    const fm = result.data;
    const expectedId = basename(path, ".md");
    const expectedDeck = basename(dirname(path));

    if (fm.id !== expectedId) {
      issues.push({ file, message: `id "${fm.id}" must match the file name "${expectedId}"` });
    }
    if (fm.deck !== expectedDeck) {
      issues.push({
        file,
        message: `deck "${fm.deck}" must match the folder "${expectedDeck}"`,
      });
    }
    const dupe = seen.get(fm.id);
    if (dupe) {
      issues.push({ file, message: `duplicate id "${fm.id}" (also in ${dupe})` });
    } else {
      seen.set(fm.id, file);
    }

    const body = parsed.content.trim();
    if (body.length < 40) {
      issues.push({ file, message: "model answer body is too short (min 40 characters)" });
    }

    cards.push({
      ...fm,
      updated: fm.updated.toISOString().slice(0, 10),
      body,
    });
  }

  for (const slug of DECK_SLUGS) {
    if (!cards.some((c) => c.deck === slug) && files.length > 0) {
      issues.push({ file: `cards/${slug}`, message: `deck "${slug}" has no cards` });
    }
  }

  return { cards, issues };
}

export function compileDirectory(cardsDir: string): CompileResult {
  const files = walk(cardsDir).map((path) => ({
    path,
    source: readFileSync(path, "utf8"),
  }));
  return compileSource(files, dirname(cardsDir));
}
