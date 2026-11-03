import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { openPersistentBrowser } from "../browser/open-persistent-browser.js";
import type { Settings } from "../../read-settings.js";

export function temporarySettings(folder: string): Settings {
  return {
    databasePath: join(folder, "jobs.sqlite"),
    browser: "chrome",
    chromeProfilePath: join(folder, "chrome"),
    cloakBrowserProfilePath: join(folder, "cloak"),
    capturesPath: join(folder, "captures"),
    port: 3210,
    sourceTimezone: "America/Toronto",
  };
}

export async function openTestBrowser(
  t: TestContext,
  viewport?: { width: number; height: number },
) {
  const browser = process.env.JOB_RADAR_TEST_BROWSER || "chrome";
  if (browser !== "chrome" && browser !== "cloakbrowser")
    throw new Error("JOB_RADAR_TEST_BROWSER must be chrome or cloakbrowser.");
  const folder = mkdtempSync(join(tmpdir(), "job-radar-browser-test-"));
  let context: Awaited<ReturnType<typeof openPersistentBrowser>> | undefined;
  t.after(async () => {
    try {
      await context?.close();
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
  context = await openPersistentBrowser(
    { ...temporarySettings(folder), browser },
    { headless: true, viewport },
  );
  return context;
}
