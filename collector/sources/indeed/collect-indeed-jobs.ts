import type { Page } from "playwright";
import type { SearchConfig, SourcePage } from "../../data/job-record.js";
import { indeedSelectors as selectors } from "./indeed-page-selectors.js";
import { mapIndeedJob } from "./map-indeed-job.js";

export class SourceBlocked extends Error {}
export class SourceLayoutChanged extends Error {}

async function checkBlocked(page: Page): Promise<void> {
  const title = await page.title();
  const path = new URL(page.url()).pathname;
  const headings = (await page.locator("h1").allTextContents()).join(" ");
  if (
    /just a moment|access denied|verification required|verify you are human/i.test(
      `${title} ${headings}`,
    ) ||
    /\/(auth|login|signin|checkpoint|challenge)(\/|$)/i.test(path)
  ) {
    throw new SourceBlocked("source_requires_login_or_verification");
  }
}

async function navigate(page: Page, url: string, delay: number) {
  if (new URL(url).origin !== "https://ca.indeed.com")
    throw new SourceLayoutChanged("unexpected_pagination_host");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      if (response && [401, 403, 429].includes(response.status()))
        throw new SourceBlocked("source_access_restricted");
      if (response && response.status() >= 500)
        throw new Error("source_navigation_failed");
      // The observed page hydrates after rendering cards; clicks before hydration are lost.
      await page.waitForTimeout(Math.max(3000, delay));
      await checkBlocked(page);
      return;
    } catch (error) {
      if (error instanceof SourceBlocked || attempt === 1) throw error;
      await page.waitForTimeout(delay);
    }
  }
}

export async function* collectIndeedJobs(
  page: Page,
  config: SearchConfig,
  timezone: string,
): AsyncGenerator<SourcePage> {
  const url = new URL("https://ca.indeed.com/jobs");
  url.searchParams.set("q", config.keywords);
  url.searchParams.set("l", config.location);
  // This parameter was verified by clicking Indeed's visible date-sort link.
  url.searchParams.set("sort", "date");
  let nextUrl: string | null = url.href;
  while (nextUrl) {
    await navigate(page, nextUrl, config.delayMs);
    const cards = await page.locator(selectors.title).evaluateAll(
      (nodes, s) =>
        nodes.map((el) => {
          const card = el.closest(s.card)!;
          return {
            id: el.getAttribute("data-jk"),
            title: el.textContent?.trim() || "",
            company: card?.querySelector(s.company)?.textContent || null,
            location: card?.querySelector(s.location)?.textContent || null,
            salary: card?.querySelector(s.salary)?.textContent || null,
            attributes: [...(card?.querySelectorAll(s.attributes) || [])].map(
              (n) => n.textContent || "",
            ),
            promoted: card?.classList.contains("sponTapItem") ?? true,
          };
        }),
      selectors,
    );
    if (cards.length === 0) {
      // Unknown empty layouts are failures, never successful zero-job collections.
      const noResults = await page
        .getByText(/did not match any jobs|no jobs found/i)
        .count();
      if (!noResults) throw new SourceLayoutChanged("job_cards_not_found");
      yield {
        jobs: [],
        ordinaryDates: [],
        chronologicalOrderConfirmed: false,
        explicitEnd: true,
        incompleteDetails: false,
        skipped: 0,
      };
      return;
    }
    const result: SourcePage = {
      jobs: [],
      ordinaryDates: [],
      chronologicalOrderConfirmed: false,
      explicitEnd: false,
      incompleteDetails: false,
      skipped: 0,
    };
    let blocked: SourceBlocked | null = null;
    for (const card of cards) {
      const observed = new Date().toISOString();
      const raw = {
        ...card,
        url: `https://ca.indeed.com/viewjob?jk=${encodeURIComponent(card.id || "")}`,
        employmentTypes: card.attributes.map((value) =>
          value.replace(/\s*\+\d+$/, "").trim(),
        ),
        workArrangement: /^remote(?:\s|$)/i.test(card.location || "")
          ? "remote"
          : /^hybrid(?:\s|$)/i.test(card.location || "")
            ? "hybrid"
            : null,
        description: null as string | null,
        detailsCollectedAt: null as string | null,
        applicationUrl: null as string | null,
      };
      if (!card.id) {
        result.skipped++;
        continue;
      }
      if (!blocked) {
        try {
          const previousId = new URL(page.url()).searchParams.get("vjk");
          const previousDescription = (await page
            .locator(selectors.description)
            .count())
            ? await page.locator(selectors.description).first().textContent()
            : null;
          const anchor = page
            .locator(selectors.title)
            .filter({ has: page.locator(`[id="jobTitle-${card.id}"]`) });
          await anchor.click({ timeout: 10_000 });
          // The application link is optional. Without its identity, also require
          // changed description content when moving from another job.
          await page.waitForFunction(
            ({ id, title, s, previousId, previousDescription }) => {
              const apply = document
                .querySelector(s.apply)
                ?.getAttribute("href");
              const heading = document
                .querySelector(s.detailTitle)
                ?.textContent?.trim();
              const description = document.querySelector(
                s.description,
              )?.textContent;
              const applyId = apply
                ? new URL(apply, location.href).searchParams.get("jk")
                : null;
              const selected = [...document.querySelectorAll(s.title)].some(
                (el) =>
                  el.getAttribute("data-jk") === id &&
                  el.getAttribute("aria-pressed") === "true",
              );
              return (
                new URL(location.href).searchParams.get("vjk") === id &&
                selected &&
                heading?.replace(/\s+/g, " ") === title.replace(/\s+/g, " ") &&
                !!description?.trim() &&
                (applyId
                  ? applyId === id
                  : previousId === id || description !== previousDescription)
              );
            },
            {
              id: card.id,
              title: card.title,
              s: selectors,
              previousId,
              previousDescription,
            },
            { timeout: 12_000 },
          );
          await checkBlocked(page);
          raw.description = await page
            .locator(selectors.description)
            .first()
            .innerText();
          raw.detailsCollectedAt = new Date().toISOString();
          // Do not retain tracking/session parameters from the apply link.
          const applyHref = (await page.locator(selectors.apply).count())
            ? await page.locator(selectors.apply).first().getAttribute("href")
            : null;
          if (applyHref) {
            const apply = new URL(applyHref, page.url());
            if (
              apply.origin === "https://ca.indeed.com" &&
              apply.pathname === "/applystart"
            ) {
              raw.applicationUrl = `https://ca.indeed.com/applystart?jk=${encodeURIComponent(card.id)}`;
            }
          }
          const summary = page.locator(selectors.detailSummary);
          for (const label of [
            "Full-time",
            "Part-time",
            "Permanent",
            "Contract",
            "Fixed term contract",
            "Temporary",
            "Internship",
            "Casual",
            "Seasonal",
          ]) {
            if (await summary.getByText(label, { exact: true }).count())
              raw.employmentTypes.push(label);
          }
        } catch (error) {
          result.incompleteDetails = true;
          console.warn(
            `Indeed ${card.id}: detail unavailable; retaining the summary.`,
          );
          try {
            await checkBlocked(page);
          } catch (e) {
            if (e instanceof SourceBlocked) blocked = e;
          }
          if (error instanceof SourceBlocked) blocked = error;
        }
        await page.waitForTimeout(config.delayMs);
      }
      const job = mapIndeedJob(raw, observed, timezone);
      if (job) {
        result.jobs.push(job);
        if (!card.promoted) result.ordinaryDates.push(job.posted_date);
      } else result.skipped++;
    }
    const next = page.locator(selectors.next);
    const href =
      !blocked && (await next.count()) ? await next.getAttribute("href") : null;
    nextUrl = href ? new URL(href, page.url()).href : null;
    // A displayed paginator's final page is evidence of an accessible end. Its absence is not.
    result.explicitEnd =
      !blocked &&
      !nextUrl &&
      (await page.locator(selectors.currentPage).count()) > 0;
    if (blocked) result.blockedReason = blocked.message;
    console.log(
      `Indeed page: ${result.jobs.length} listings, ${result.jobs.filter((job) => job.description).length} descriptions.`,
    );
    yield result;
    if (blocked) throw blocked;
    if (!nextUrl && !result.explicitEnd)
      throw new SourceLayoutChanged("pagination_end_unconfirmed");
  }
}
