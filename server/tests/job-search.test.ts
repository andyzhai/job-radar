import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { sampleJob, testDatabase } from "../../collector/tests/test-data.js";
import { saveJobs } from "../../collector/storage/save-jobs.js";
import { searchJobs } from "../database/search-jobs.js";
import { parseJobQuery } from "../routes/job-routes.js";
import { createJobServer } from "../start-server.js";

test("literal AND keyword search, source filters, stable order and pagination", (t) => {
  const { db } = testDatabase(t);
  saveJobs(db, [
    sampleJob(),
    sampleJob({
      source: "linkedin",
      source_job_key: "id:2",
      title: "Designer",
      description: null,
    }),
    sampleJob({
      source_job_key: "id:3",
      title: "C++ Engineer",
      description: "100 percent",
      posted_date: null,
    }),
  ]);
  const run = (query: string) =>
    searchJobs(db, parseJobQuery(new URLSearchParams(query)));
  assert.equal(run("keywords=C%2B%2B+100%25").total, 1);
  assert.equal(run("keywords=_").total, 0);
  assert.equal(run("keywords=%27+OR+1%3D1").total, 0);
  assert.equal(run("source=indeed").total, 2);
  assert.equal(run("source=indeed&source=linkedin").total, 3);
  assert.equal(run("limit=1&offset=2").items[0].posted_date, null);
});
test("invalid and unknown filters are rejected", () => {
  for (const input of [
    "foo=1",
    "limit=0",
    "limit=101",
    "limit=1.5",
    "offset=-1",
    "offset=1000001",
    "source=unknown",
    "keywords=a&keywords=b",
    `keywords=${"x".repeat(201)}`,
  ]) {
    assert.throws(() => parseJobQuery(new URLSearchParams(input)));
  }
});
test("API returns saved details, 400/404/405, and never serves runtime files", async (t) => {
  const { db, path } = testDatabase(t);
  saveJobs(db, [sampleJob()]);
  const server = createJobServer(path);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const list = await (
    await fetch(`${base}/api/jobs?keywords=Developer`)
  ).json();
  assert.equal(list.total, 1);
  const details = await (
    await fetch(`${base}/api/jobs/${list.items[0].id}`)
  ).json();
  assert.equal(details.description, sampleJob().description);
  for (const [path, status] of [
    ["/api/jobs?limit=101", 400],
    ["/api/jobs/999", 404],
    ["/runtime/database/job-radar.sqlite", 404],
    ["/job-radar-settings.json", 404],
  ]) {
    assert.equal((await fetch(`${base}${path}`)).status, status);
  }
  assert.equal(
    (await fetch(`${base}/api/jobs`, { method: "POST" })).status,
    405,
  );
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
});
test("uninitialized database returns 503 without creating a replacement", async (t) => {
  const { folder } = testDatabase(t);
  const missing = join(folder, "missing.sqlite");
  const server = createJobServer(missing);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const response = await fetch(
    `http://127.0.0.1:${(server.address() as { port: number }).port}/api/jobs`,
  );
  assert.equal(response.status, 503);
  assert.equal(existsSync(missing), false);
});
