import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { collectIndeedJobs } from "../sources/indeed/collect-indeed-jobs.js";
import { config } from "./test-data.js";

// Synthetic DOM fixture based on the inspected public page structure.
// All requests are intercepted; this test never reaches Indeed or the bot profile.
test("source reads the correct inline descriptions when application links are absent", async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => {
      if (!route.request().isNavigationRequest()) return route.abort();
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><title>Software Developer jobs</title>
        <div class="cardOutline"><a class="jcs-JobTitle" data-jk="alpha" aria-pressed="true" role="button"><span id="jobTitle-alpha">Developer</span></a><span data-testid="company-name">Example A</span><span data-testid="text-location">Toronto, ON</span></div>
        <div class="cardOutline"><a class="jcs-JobTitle" data-jk="beta" role="button"><span id="jobTitle-beta">Developer</span></a><span data-testid="company-name">Example B</span><span data-testid="text-location">Remote in Toronto, ON</span><span data-testid="attribute_snippet_testid salary-snippet-container">$90,000 a year</span></div>
        <h2 data-testid="vj-job-title">Developer</h2><button data-testid="viewjob-apply">Apply now</button>
        <div data-testid="structured-job-summary"><span>Full-time</span></div><div class="simple-job-description-html">Description alpha</div>
        <a data-testid="pagination-page-current" aria-current="page">1</a>
        <script>
          history.replaceState({}, '', location.pathname + location.search + '&vjk=alpha');
          for (const anchor of document.querySelectorAll('a[data-jk]')) anchor.addEventListener('click', () => {
            const id=anchor.getAttribute('data-jk');
            for (const card of document.querySelectorAll('a[data-jk]')) card.removeAttribute('aria-pressed');
            anchor.setAttribute('aria-pressed','true');
            const url=new URL(location.href); url.searchParams.set('vjk',id); history.replaceState({},'',url);
            setTimeout(() => { document.querySelector('.simple-job-description-html').textContent='Description '+id; }, 25);
          });
        </script>`,
      });
    });
    const results = [];
    for await (const result of collectIndeedJobs(
      page,
      { ...config, delayMs: 1 },
      "America/Toronto",
    ))
      results.push(result);
    assert.equal(results.length, 1);
    assert.equal(results[0].explicitEnd, true);
    assert.equal(results[0].incompleteDetails, false);
    assert.deepEqual(
      results[0].jobs.map((j) => j.description),
      ["Description alpha", "Description beta"],
    );
    assert.ok(
      results[0].jobs.every(
        (j) =>
          j.application_url === null &&
          j.details_collected_at &&
          j.posted_date === null,
      ),
    );
    assert.equal(results[0].jobs[1].work_arrangement, "remote");
    assert.equal(results[0].jobs[1].salary_text, "$90,000 a year");
  } finally {
    await browser.close();
  }
});
