import { createInterface } from "node:readline/promises";
import { openPersistentBrowser } from "../browser/open-persistent-browser.js";
import { capturePageLayout } from "../inspection/capture-page-layout.js";
import { readSettings, projectRoot } from "../../read-settings.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SearchConfig } from "../data/job-record.js";

const args = process.argv.slice(2);
const source = args.find((arg) => !arg.startsWith("--")) || "indeed";
if (
  !["indeed", "linkedin"].includes(source) ||
  args.some((arg) => arg.startsWith("--") && arg !== "--capture")
) {
  throw new Error("Usage: npm run inspect -- indeed|linkedin [--capture]");
}
const search = (
  JSON.parse(
    readFileSync(join(projectRoot, "collector/config/searches.json"), "utf8"),
  ) as SearchConfig[]
)[0];
const url =
  source === "indeed"
    ? new URL("https://ca.indeed.com/jobs")
    : new URL("https://www.linkedin.com/jobs/search/");
url.searchParams.set(source === "indeed" ? "q" : "keywords", search.keywords);
url.searchParams.set(source === "indeed" ? "l" : "location", search.location);
const settings = readSettings();
console.log(`Opening ${settings.browser} for inspection.`);
const context = await openPersistentBrowser(settings);
try {
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (!args.includes("--capture")) {
    const input = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    await input.question(
      "Inspect the source. Press Enter here to capture the current page and close this bot browser. ",
    );
    input.close();
  } else await page.waitForTimeout(3000);
  console.log(await capturePageLayout(page, settings.capturesPath, source));
} finally {
  await context.close();
}
