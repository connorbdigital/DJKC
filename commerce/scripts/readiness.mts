/**
 * The same readiness report the endpoint serves, from the terminal.
 *
 *   npm run readiness
 *
 * Reads the environment it is run in, so for a deployed project it is
 * `GET /api/readiness` that tells the truth, not this.
 */
import { readiness } from "../src/readiness.js";

const report = readiness(process.env as Record<string, string | undefined>);

const width = Math.max(...report.checks.map((check) => check.name.length));
for (const check of report.checks) {
  const mark = check.state === "set" ? "set    " : check.state === "invalid" ? "BROKEN " : "missing";
  console.log(`${mark} ${check.name.padEnd(width)}  ${check.note ?? check.unlocks}`);
}

console.log("");
console.log(`take money     ${report.canTakeMoney ? "yes" : "no"}`);
console.log(`record orders  ${report.canRecordOrders ? "yes" : "no"}`);
console.log(`fulfil itself  ${report.canFulfilAutomatically ? `yes (${report.supplier})` : "no"}`);
console.log("");
console.log(`next: ${report.next}`);
