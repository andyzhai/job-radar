import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import type {
  JobRecord,
  SearchConfig,
  SourcePage,
} from "../data/job-record.js";
import { openJobDatabase } from "../storage/open-job-database.js";

export const config: SearchConfig = {
  id: "test-search",
  enabled: true,
  source: "indeed",
  keywords: "Developer",
  location: "Toronto, ON",
  initialLookbackDays: 30,
  overlapDays: 2,
  maxPages: 3,
  delayMs: 1000,
};
export function sampleJob(changes: Partial<JobRecord> = {}): JobRecord {
  return {
    source: "indeed",
    source_job_id: "sample-1",
    source_job_key: "id:sample-1",
    title: "Software Developer",
    company: "Example Studio",
    location: "Toronto, ON",
    employment_types: ["Full-time"],
    work_arrangement: null,
    salary_text: "$100,000 a year",
    description:
      "Build C++ software with 100% test coverage. <script>window.bad=true</script>",
    job_url: "https://ca.indeed.com/viewjob?jk=sample-1",
    application_url: null,
    posted_date: "2026-10-31",
    posted_text: "1 day ago",
    collected_at: "2026-11-01T15:00:00Z",
    details_collected_at: "2026-11-01T15:00:00Z",
    ...changes,
  };
}
export function samplePage(changes: Partial<SourcePage> = {}): SourcePage {
  return {
    jobs: [sampleJob()],
    ordinaryDates: ["2026-10-31"],
    chronologicalOrderConfirmed: true,
    explicitEnd: false,
    incompleteDetails: false,
    skipped: 0,
    ...changes,
  };
}
export function testDatabase(t: TestContext) {
  const folder = mkdtempSync(join(tmpdir(), "job-radar-test-"));
  const path = join(folder, "jobs.sqlite");
  const db = openJobDatabase(path);
  t.after(() => {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { db, path, folder };
}
