import { writeFileSync } from "node:fs";
import path from "node:path";
import { processDocMarkdown } from "../src/processDoc";

/** Writes studio/PROCESSES.md from the feature library. Run: npm run processes */
const target = path.join(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), "..", "PROCESSES.md");
writeFileSync(target, processDocMarkdown(), "utf8");
console.log(`wrote ${path.relative(process.cwd(), target)}`);
