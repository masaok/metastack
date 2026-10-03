import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

// Next only auto-loads `.env*` from this package. Local secrets live next to
// `.env.example` at the repo root; fill names that are still unset.
loadRepoEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));

const nextConfig: NextConfig = {
  transpilePackages: ["@metastack/content", "@metastack/srs"],
  reactStrictMode: true,
  // Hide the floating Next.js dev-tools bubble. Compile and runtime errors still surface.
  devIndicators: false,
};

export default nextConfig;

function loadRepoEnv(root: string) {
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";
  const files = [`.env.${mode}.local`, ".env.local", `.env.${mode}`, ".env"];
  for (const name of files) {
    const file = path.join(root, name);
    let text: string;
    try {
      if (!statSync(file).isFile()) continue;
      text = readFileSync(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw err;
    }
    for (const [key, value] of parseEnv(text)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function parseEnv(text: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  }
  return entries;
}
