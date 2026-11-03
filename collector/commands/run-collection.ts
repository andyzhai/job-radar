import { readSettings } from "../../read-settings.js";
import { openPersistentBrowser } from "../browser/open-persistent-browser.js";
import { withCollectorLock } from "../collection/collector-lock.js";
import { openJobDatabase } from "../storage/open-job-database.js";
import { recoverInterruptedRuns } from "../storage/save-run-result.js";
import {
  readSearches,
  runConfiguredSearches,
} from "../collection/run-configured-searches.js";

async function main() {
  const args = process.argv.slice(2);
  const searches = readSearches();
  for (let i = 0; i < args.length; i += 2) {
    if (
      args[i] !== "--max-pages" ||
      !/^\d+$/.test(args[i + 1] || "") ||
      Number(args[i + 1]) < 1 ||
      Number(args[i + 1]) > 100
    ) {
      throw new Error("Usage: npm run collect [-- --max-pages 1..100]");
    }
    for (const search of searches) search.maxPages = Number(args[i + 1]);
  }
  if (!searches.some((s) => s.enabled)) {
    console.log("No enabled searches.");
    return;
  }
  const settings = readSettings();
  await withCollectorLock(settings.databasePath, async () => {
    console.log(`Opening ${settings.browser} for collection.`);
    const browser = await openPersistentBrowser(settings);
    // Both the database lock and selected profile are acquired before recovery.
    try {
      const db = openJobDatabase(settings.databasePath);
      try {
        recoverInterruptedRuns(db);
        const results = await runConfiguredSearches(
          db,
          browser,
          settings,
          searches,
        );
        // Nonzero distinguishes limited coverage from a completed scan for future scheduling.
        process.exitCode = results.some(
          (r) => r.status === "failed" || r.status === "blocked",
        )
          ? 1
          : results.some((r) => r.status === "partial")
            ? 2
            : 0;
      } finally {
        db.close();
      }
    } finally {
      await browser.close();
    }
  });
}

main().catch((error) => {
  console.error(error.message || "Collection failed.");
  process.exitCode = 1;
});
