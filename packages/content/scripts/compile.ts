import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compileDirectory } from "../src/compile";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const cardsDir = join(root, "cards");
const outDir = join(root, "generated");

const { cards, issues } = compileDirectory(cardsDir);

if (issues.length > 0) {
  console.error(`\n✖ ${issues.length} content issue(s):\n`);
  for (const issue of issues) console.error(`  ${issue.file}\n    ${issue.message}`);
  console.error("");
  process.exit(1);
}

const shipped = cards.filter((c) => c.reviewed);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "cards.json"), JSON.stringify(shipped, null, 2) + "\n");

const perDeck = shipped.reduce<Record<string, number>>((acc, c) => {
  acc[c.deck] = (acc[c.deck] ?? 0) + 1;
  return acc;
}, {});

console.log(
  `✔ compiled ${shipped.length} card(s) ` +
    `(${cards.length - shipped.length} unreviewed held back) → generated/cards.json ` +
    Object.entries(perDeck)
      .map(([k, v]) => `${k}=${v}`)
      .join(" "),
);
