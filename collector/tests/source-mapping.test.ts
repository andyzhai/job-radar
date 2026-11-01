import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapIndeedJob,
  parsePostedDate,
} from "../sources/indeed/map-indeed-job.js";
import { assertDedicatedProfile } from "../../read-settings.js";
import { join } from "node:path";

const observed = "2026-11-01T02:00:00Z"; // Still October 31 in Toronto.
test("Indeed mapping cleans explicit fields, canonicalizes identity and keeps unknowns unknown", () => {
  const job = mapIndeedJob(
    {
      id: "abc",
      title: "  Software   Developer ",
      url: "https://ca.indeed.com/rc/clk?jk=abc&tk=private",
      salary: "$70–$85 an hour",
      employmentTypes: ["Full-time", "Fixed term contract"],
      postedText: "30+ days ago",
    },
    observed,
    "America/Toronto",
  )!;
  assert.equal(job.title, "Software Developer");
  assert.equal(job.source_job_key, "id:abc");
  assert.equal(job.job_url, "https://ca.indeed.com/viewjob?jk=abc");
  assert.deepEqual(job.employment_types, ["Full-time", "Contract"]);
  assert.equal(job.salary_text, "$70–$85 an hour");
  assert.equal(job.posted_date, null);
  assert.equal(job.posted_text, "30+ days ago");
  assert.equal(job.company, null);
  assert.equal(job.work_arrangement, null);
  assert.equal(job.details_collected_at, null);
});
test("posting dates use source calendar days and do not invent ambiguous dates", () => {
  assert.equal(
    parsePostedDate("Today", observed, "America/Toronto"),
    "2026-10-31",
  );
  assert.equal(
    parsePostedDate("Posted 2 days ago", observed, "America/Toronto"),
    "2026-10-29",
  );
  for (const value of ["30+ days ago", "New", "11/01/26", "2026-02-30"])
    assert.equal(parsePostedDate(value, observed, "America/Toronto"), null);
});
test("unusable titles, foreign URLs and executable URLs are rejected", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://example.com/viewjob?jk=abc",
  ])
    assert.equal(
      mapIndeedJob(
        { id: "abc", title: "Developer", url },
        observed,
        "America/Toronto",
      ),
      null,
    );
  assert.equal(
    mapIndeedJob(
      { id: "abc", title: " ", url: "https://ca.indeed.com/viewjob?jk=abc" },
      observed,
      "America/Toronto",
    ),
    null,
  );
});
test("normal Chrome user-data path, child profiles, and parent paths cannot be used for collection", () => {
  const root = process.env.LOCALAPPDATA!;
  for (const path of [
    join(root, "Google/Chrome/User Data"),
    join(root, "Google/Chrome/User Data/Default"),
    root,
  ]) {
    assert.throws(() => assertDedicatedProfile(path), /Refusing/);
  }
  assert.doesNotThrow(() =>
    assertDedicatedProfile(join(root, "WebBot/Chrome/User Data")),
  );
});
