import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseSearchWindow,
  pageBeforeCutoff,
  definitionSignature,
} from "../collection/choose-search-window.js";
import { consumeSearchPages } from "../collection/run-configured-searches.js";
import {
  startRun,
  recoverInterruptedRuns,
} from "../storage/save-run-result.js";
import { readSearchProgress } from "../storage/search-progress-store.js";
import { SourceBlocked } from "../sources/indeed/collect-indeed-jobs.js";
import { sampleJob, samplePage, config, testDatabase } from "./test-data.js";
import type { SourcePage } from "../data/job-record.js";

const started = "2026-11-01T15:00:00Z",
  cutoff = "2026-10-02";

test("a challenge on the capped page remains blocked after saving its summaries", async (t) => {
  const { db } = testDatabase(t);
  const signature = definitionSignature(config);
  const run = startRun(db, config, signature, started, cutoff);
  const result = await consumeSearchPages(
    db,
    run,
    { ...config, maxPages: 1 },
    cutoff,
    pages(
      samplePage({ blockedReason: "source_requires_login_or_verification" }),
    ),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.saved, 1);
  assert.equal(readSearchProgress(db, config.id, signature), null);
});
async function* pages(...values: SourcePage[]) {
  yield* values;
}
test("initial window and checkpoint overlap preserve older coverage after downtime", () => {
  assert.equal(
    chooseSearchWindow(config, null, started, "America/Toronto"),
    cutoff,
  );
  assert.equal(
    chooseSearchWindow(
      config,
      "2026-08-01T15:00:00Z",
      started,
      "America/Toronto",
    ),
    "2026-07-30",
  );
  assert.notEqual(
    definitionSignature(config),
    definitionSignature({ ...config, keywords: "Designer" }),
  );
});
test("cutoff requires all ordinary dates strictly older, with confirmed ordering", () => {
  assert.equal(
    pageBeforeCutoff(samplePage({ ordinaryDates: ["2026-10-01"] }), cutoff),
    true,
  );
  for (const dates of [
    [],
    [null],
    ["2026-10-01", null],
    ["2026-10-01", cutoff],
    ["2026-10-01", "2026-10-10"],
  ]) {
    assert.equal(
      pageBeforeCutoff(samplePage({ ordinaryDates: dates }), cutoff),
      false,
    );
  }
  assert.equal(
    pageBeforeCutoff(
      samplePage({
        ordinaryDates: ["2026-10-01"],
        chronologicalOrderConfirmed: false,
      }),
      cutoff,
    ),
    false,
  );
});
test("completed explicit end advances checkpoint; cap, repeated page and detail failure do not", async (t) => {
  const { db } = testDatabase(t);
  const signature = definitionSignature(config);
  const run = startRun(db, config, signature, started, cutoff);
  const complete = await consumeSearchPages(
    db,
    run,
    config,
    cutoff,
    pages(samplePage({ explicitEnd: true })),
  );
  assert.equal(complete.status, "completed");
  assert.equal(readSearchProgress(db, config.id, signature), started);
  for (const mode of ["cap", "repeat", "details"]) {
    const nextRun = startRun(
      db,
      config,
      signature,
      "2026-11-02T15:00:00Z",
      cutoff,
    );
    const result = await consumeSearchPages(
      db,
      nextRun,
      mode === "cap" ? { ...config, maxPages: 1 } : config,
      cutoff,
      mode === "repeat"
        ? pages(samplePage(), samplePage())
        : pages(
            samplePage({
              explicitEnd: mode === "details",
              incompleteDetails: mode === "details",
            }),
          ),
    );
    assert.equal(result.status, "partial");
    assert.equal(readSearchProgress(db, config.id, signature), started);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM jobs").get()!.n, 1);
});
test("blocked and interrupted attempts retain saved rows without advancing progress", async (t) => {
  const { db } = testDatabase(t);
  const signature = definitionSignature(config);
  const run = startRun(db, config, signature, started, cutoff);
  async function* blocked() {
    yield samplePage();
    throw new SourceBlocked("source_requires_login_or_verification");
  }
  const result = await consumeSearchPages(db, run, config, cutoff, blocked());
  assert.equal(result.status, "blocked");
  assert.equal(result.saved, 1);
  assert.equal(readSearchProgress(db, config.id, signature), null);
  const interrupted = startRun(db, config, signature, started, cutoff);
  recoverInterruptedRuns(db);
  assert.equal(
    db
      .prepare("SELECT status FROM collection_runs WHERE id=?")
      .get(interrupted)!.status,
    "partial",
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM jobs").get()!.n, 1);
});
test("out-of-order ordinary dates disable early cutoff; unknown jobs are retained", async (t) => {
  const { db } = testDatabase(t);
  const run = startRun(
    db,
    config,
    definitionSignature(config),
    started,
    cutoff,
  );
  const result = await consumeSearchPages(
    db,
    run,
    config,
    cutoff,
    pages(
      samplePage({
        jobs: [sampleJob({ posted_date: null })],
        ordinaryDates: ["2026-10-20", "2026-10-30"],
      }),
      samplePage({
        jobs: [
          sampleJob({ source_job_key: "id:old", posted_date: "2026-10-01" }),
        ],
        ordinaryDates: ["2026-10-01"],
      }),
    ),
  );
  assert.equal(result.status, "partial");
  assert.equal(result.saved, 1);
});
