import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { BrowserContext } from "playwright";
import { projectRoot, type Settings } from "../../read-settings.js";
import type { SearchConfig, SourcePage } from "../data/job-record.js";
import {
  chooseSearchWindow,
  definitionSignature,
  pageBeforeCutoff,
} from "./choose-search-window.js";
import { readSearchProgress } from "../storage/search-progress-store.js";
import {
  finishRun,
  startRun,
  updateRunCounts,
  type RunResult,
} from "../storage/save-run-result.js";
import { saveJobs } from "../storage/save-jobs.js";
import {
  collectIndeedJobs,
  SourceBlocked,
  SourceLayoutChanged,
} from "../sources/indeed/collect-indeed-jobs.js";

export function readSearches(): SearchConfig[] {
  const value: unknown = JSON.parse(
    readFileSync(join(projectRoot, "collector/config/searches.json"), "utf8"),
  );
  if (!Array.isArray(value))
    throw new Error("Search configuration must be a list.");
  const ids = new Set();
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !/^[a-z0-9-]+$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.enabled !== "boolean" ||
      item.source !== "indeed" ||
      typeof item.keywords !== "string" ||
      !item.keywords.trim() ||
      item.keywords.length > 200 ||
      typeof item.location !== "string" ||
      item.location.length > 200
    )
      throw new Error("Invalid search configuration or duplicate ID.");
    for (const [key, min, max] of [
      ["initialLookbackDays", 1, 3650],
      ["overlapDays", 0, 365],
      ["maxPages", 1, 100],
      ["delayMs", 1000, 60_000],
    ] as const) {
      if (!Number.isInteger(item[key]) || item[key] < min || item[key] > max)
        throw new Error(`Invalid search setting: ${key}`);
    }
    ids.add(item.id);
  }
  return value as SearchConfig[];
}

export async function consumeSearchPages(
  db: DatabaseSync,
  runId: number,
  config: SearchConfig,
  cutoff: string,
  pages: AsyncIterable<SourcePage>,
): Promise<RunResult> {
  const result: RunResult = {
    status: "partial",
    reason: "source_ended_without_confirmation",
    pages: 0,
    read: 0,
    saved: 0,
    skipped: 0,
  };
  const fingerprints = new Set<string>();
  let incomplete = false;
  let ordered = true;
  let previousDate: string | null = null;
  try {
    for await (const page of pages) {
      const fingerprint = page.jobs
        .map((job) => `${job.source}:${job.source_job_key}`)
        .sort()
        .join("|");
      if (fingerprint && fingerprints.has(fingerprint)) {
        result.reason = "repeated_page";
        break;
      }
      if (fingerprint) fingerprints.add(fingerprint);
      for (const date of page.ordinaryDates) {
        if (date && previousDate && date > previousDate) ordered = false;
        if (date) previousDate = date;
      }
      result.pages++;
      result.read += page.jobs.length + page.skipped;
      const saved = saveJobs(
        db,
        page.jobs.filter(
          (job) => !job.posted_date || job.posted_date >= cutoff,
        ),
      );
      result.saved += saved.saved;
      result.skipped += saved.skipped + page.skipped;
      incomplete ||=
        page.incompleteDetails || saved.skipped > 0 || page.skipped > 0;
      updateRunCounts(db, runId, result);
      if (page.blockedReason) {
        result.status = "blocked";
        result.reason = page.blockedReason;
        break;
      }
      if (page.explicitEnd || (ordered && pageBeforeCutoff(page, cutoff))) {
        result.status = incomplete ? "partial" : "completed";
        result.reason = incomplete
          ? "detail_or_mapping_incomplete"
          : page.explicitEnd
            ? "end_of_results"
            : "date_cutoff";
        break;
      }
      if (result.pages >= config.maxPages) {
        result.reason = "page_limit";
        break;
      }
    }
  } catch (error) {
    result.status =
      error instanceof SourceBlocked
        ? "blocked"
        : result.saved
          ? "partial"
          : "failed";
    result.reason =
      error instanceof SourceBlocked || error instanceof SourceLayoutChanged
        ? error.message
        : "collection_step_failed";
  }
  finishRun(db, runId, result);
  return result;
}

export async function runConfiguredSearches(
  db: DatabaseSync,
  browser: BrowserContext,
  settings: Settings,
  searches: SearchConfig[],
) {
  const results = [];
  for (const config of searches.filter((s) => s.enabled)) {
    const signature = definitionSignature(config);
    const started = new Date().toISOString();
    const cutoff = chooseSearchWindow(
      config,
      readSearchProgress(db, config.id, signature),
      started,
      settings.sourceTimezone,
    );
    const runId = startRun(db, config, signature, started, cutoff);
    const page = await browser.newPage();
    try {
      console.log(
        `Collecting ${config.id}: cutoff ${cutoff}, at most ${config.maxPages} pages.`,
      );
      const result = await consumeSearchPages(
        db,
        runId,
        config,
        cutoff,
        collectIndeedJobs(page, config, settings.sourceTimezone),
      );
      console.log(
        JSON.stringify({ search: config.id, runId, cutoff, ...result }),
      );
      results.push({ runId, ...result });
    } finally {
      await page.close();
    }
  }
  return results;
}
