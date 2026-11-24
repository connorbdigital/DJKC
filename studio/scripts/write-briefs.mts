/**
 * Renders the blog plan to BRIEFS.md.
 *
 *   npm run briefs
 *
 * The Atlas shows the same boards in 3D; this is the copy you can paste into a
 * CMS, a spreadsheet or a client call. Same source, so they cannot disagree.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { BRIEFS, briefsMarkdown } from "../src/atlasBriefs";

const target = path.resolve("BRIEFS.md");
await writeFile(target, briefsMarkdown(), "utf8");
const words = BRIEFS.reduce((total, brief) => total + brief.words, 0);
console.log(`wrote ${path.relative(process.cwd(), target)} — ${BRIEFS.length} posts, about ${words.toLocaleString("en-GB")} words`);
