import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { temporarySettings } from "./browser-test-helper.js";
import { openPersistentBrowser } from "../browser/open-persistent-browser.js";
import type { Settings } from "../../read-settings.js";

test("selected browser persists cookies and local storage and rejects an already-open profile", async (t) => {
  const browser = process.env.JOB_RADAR_TEST_BROWSER || "chrome";
  if (browser !== "chrome" && browser !== "cloakbrowser")
    throw new Error("JOB_RADAR_TEST_BROWSER must be chrome or cloakbrowser.");
  const folder = mkdtempSync(join(tmpdir(), "job-radar-session-test-"));
  const settings: Settings = { ...temporarySettings(folder), browser };
  let context: Awaited<ReturnType<typeof openPersistentBrowser>> | undefined;
  t.after(async () => {
    try {
      await context?.close();
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
  context = await openPersistentBrowser(settings, { headless: true });
  const first = context;
  await context.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Session fixture</title>",
    }),
  );
  const page = await context.newPage();
  await page.goto("https://session.test/");
  await page.evaluate(() => {
    localStorage.setItem("session-fixture", "saved");
    document.cookie = "fixture=saved; Max-Age=3600; Secure; SameSite=Lax";
  });
  // If a regression starts a second context, close it before failing the assertion.
  await assert.rejects(async () => {
    const unexpected = await openPersistentBrowser(settings, {
      headless: true,
    });
    await unexpected.close();
  }, /busy|Cannot start/);
  assert.equal(await page.title(), "Session fixture");
  await first.close();
  context = await openPersistentBrowser(settings, { headless: true });
  await context.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Session fixture</title>",
    }),
  );
  const reopened = await context.newPage();
  await reopened.goto("https://session.test/");
  assert.equal(
    await reopened.evaluate(() => localStorage.getItem("session-fixture")),
    "saved",
  );
  assert.match(await reopened.evaluate(() => document.cookie), /fixture=saved/);
});
