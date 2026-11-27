/**
 * The opt-in half of the Anything → GitHub publisher.
 *
 * A build should not create repositories as a side effect of deploying, so this
 * does nothing unless `PUBLISH_ANYTHING=1` is set in the environment. With it
 * set — and a `GITHUB_TOKEN` that can create repositories — the build publishes
 * the inventory it has just scanned, where the Anything key already lives.
 *
 * It never fails the build. A token without the right scope, an existing repo
 * with no permission, a network hiccup: each is reported in the build log and
 * the deploy continues, because a site that will not deploy because GitHub said
 * no is worse than a site whose inventory is a day old.
 */
import path from "node:path";
import { publish } from "./publish-anything";

const asked = process.env.PUBLISH_ANYTHING === "1";
if (!asked) {
  console.log("publish:anything skipped — set PUBLISH_ANYTHING=1 to publish the inventory to GitHub");
  process.exit(0);
}

try {
  const code = await publish({
    scanPath: path.resolve(import.meta.dirname, "..", "src", "generated", "anythingScan.json"),
    localDir: path.resolve(import.meta.dirname, "..", "..", "docs", "anything-projects"),
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "",
    yes: true,
    private: process.env.PUBLISH_ANYTHING_PRIVATE === "1",
  });
  if (code !== 0) console.error("publish:anything finished with failures — the build continues");
} catch (problem) {
  console.error(`publish:anything failed: ${problem instanceof Error ? problem.message : String(problem)} — the build continues`);
}
process.exit(0);
