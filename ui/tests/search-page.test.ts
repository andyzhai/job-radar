import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { chromium } from "playwright";
import { mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createJobServer } from "../../server/start-server.js";
import { openJobDatabase } from "../../collector/storage/open-job-database.js";
import { saveJobs } from "../../collector/storage/save-jobs.js";
import { sampleJob } from "../../collector/tests/test-data.js";
import { projectRoot } from "../../read-settings.js";

test("built UI searches, filters, paginates and opens details after the writer exits, on desktop and mobile", async () => {
  assert.equal(
    existsSync(resolve(projectRoot, "dist/ui/index.html")),
    true,
    "Run npm run build before UI tests.",
  );
  const folder = mkdtempSync(join(tmpdir(), "job-radar-ui-"));
  const path = join(folder, "jobs.sqlite");
  const writer = openJobDatabase(path);
  saveJobs(
    writer,
    Array.from({ length: 27 }, (_, index) =>
      sampleJob({
        source_job_id: `sample-${index}`,
        source_job_key: `id:sample-${index}`,
        title: index === 0 ? "C++ Developer" : `Software Developer ${index}`,
        source: index === 0 ? "linkedin" : "indeed",
      }),
    ),
  );
  writer.close();
  const server = createJobServer(path);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const captures = resolve(projectRoot, "runtime/captures");
  mkdirSync(captures, { recursive: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1080 },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    );
    await page
      .getByRole("heading", { name: "27 saved jobs", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText("26–27 of 27", { exact: true }).waitFor();
    await page.getByLabel("Keywords", { exact: true }).fill("C++");
    await page.getByLabel("Source", { exact: true }).selectOption("linkedin");
    await page.getByRole("button", { name: /Search saved jobs/ }).click();
    await page
      .getByRole("heading", { name: "1 saved job", exact: true })
      .waitFor();
    await page.getByRole("button", { name: /C\+\+ Developer/ }).click();
    await page
      .getByRole("heading", { name: "About the role", exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".description").innerText(),
      sampleJob().description,
    );
    assert.equal(await page.locator(".description script").count(), 0);
    assert.equal(
      await page
        .getByRole("link", { name: /Open original posting/ })
        .getAttribute("target"),
      "_blank",
    );
    await page.screenshot({
      path: join(captures, "ui-fixture-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.getByRole("region", { name: "Saved job results" }).isVisible(),
      false,
    );
    await page.screenshot({
      path: join(captures, "ui-fixture-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Back to results" }).click();
    assert.equal(
      await page.getByRole("region", { name: "Saved job results" }).isVisible(),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.getByLabel("Keywords", { exact: true }).fill("no-such-role-xyz");
    await page.getByRole("button", { name: /Search saved jobs/ }).click();
    await page.getByRole("heading", { name: "No matching jobs yet" }).waitFor();
    await page.route("**/api/jobs?**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Database unavailable for test." }),
      }),
    );
    await page.getByRole("button", { name: /Search saved jobs/ }).click();
    await page
      .getByRole("heading", { name: "Saved jobs are unavailable" })
      .waitFor();
    await page.unroute("**/api/jobs?**");
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByRole("heading", { name: "No matching jobs yet" }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(folder, { recursive: true, force: true });
  }
});
