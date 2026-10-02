import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileDirectory } from "../src/compile";

const here = dirname(fileURLToPath(import.meta.url));
const cardsDir = join(here, "..", "cards");

const { cards, issues } = compileDirectory(cardsDir);

if (issues.length > 0) {
  console.error(`\n✖ ${issues.length} content issue(s):\n`);
  for (const issue of issues) console.error(`  ${issue.file}\n    ${issue.message}`);
  console.error("");
  process.exit(1);
}

const unreviewed = cards.filter((c) => !c.reviewed).length;
console.log(`✔ ${cards.length} card(s) valid (${unreviewed} awaiting review)`);
