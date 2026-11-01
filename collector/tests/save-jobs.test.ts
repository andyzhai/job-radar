import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleJob, testDatabase } from "./test-data.js";
import { saveJobs } from "../storage/save-jobs.js";
import { openReadonlyDatabase } from "../../server/database/open-readonly-database.js";

test("repeated source jobs preserve first seen and old detail when only a new summary is available", (t) => {
  const { db } = testDatabase(t);
  saveJobs(db, [sampleJob()]);
  saveJobs(db, [
    sampleJob({
      title: "Senior Software Developer",
      company: null,
      description: null,
      employment_types: [],
      details_collected_at: null,
      collected_at: "2026-11-02T15:00:00Z",
    }),
  ]);
  const rows = db.prepare("SELECT * FROM jobs").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Senior Software Developer");
  assert.equal(rows[0].first_seen_at, "2026-11-01T15:00:00Z");
  assert.equal(rows[0].last_seen_at, "2026-11-02T15:00:00Z");
  assert.equal(rows[0].details_collected_at, "2026-11-01T15:00:00Z");
  assert.equal(rows[0].description, sampleJob().description);
  assert.equal(rows[0].company, "Example Studio");
  assert.equal(rows[0].employment_types, '["Full-time"]');
});
test("identity remains source-specific and URL fallback can be promoted to an ID", (t) => {
  const { db } = testDatabase(t);
  const job = sampleJob();
  saveJobs(db, [
    { ...job, source_job_id: null, source_job_key: `url:${job.job_url}` },
  ]);
  saveJobs(db, [job]);
  saveJobs(db, [{ ...job, source: "linkedin" }]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM jobs").get()!.n, 2);
  assert.equal(
    db.prepare("SELECT source_job_key FROM jobs WHERE source='indeed'").get()!
      .source_job_key,
    "id:sample-1",
  );
});
test("invalid record is skipped without erasing stored jobs", (t) => {
  const { db } = testDatabase(t);
  saveJobs(db, [sampleJob()]);
  assert.deepEqual(saveJobs(db, [sampleJob({ title: "" })]), {
    saved: 0,
    skipped: 1,
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM jobs").get()!.n, 1);
});
test("read-only server sees committed WAL writes and cannot write", (t) => {
  const { db, path } = testDatabase(t);
  const reader = openReadonlyDatabase(path);
  try {
    saveJobs(db, [sampleJob()]);
    assert.equal(reader.prepare("SELECT COUNT(*) AS n FROM jobs").get()!.n, 1);
    assert.throws(() => reader.exec("DELETE FROM jobs"), /readonly|read-only/i);
  } finally {
    reader.close();
  }
});
