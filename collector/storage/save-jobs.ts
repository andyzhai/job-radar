import type { DatabaseSync } from "node:sqlite";
import type { JobRecord } from "../data/job-record.js";
import { cleanJobRecord } from "../data/clean-job-record.js";

const columns = [
  "source",
  "source_job_id",
  "source_job_key",
  "title",
  "company",
  "location",
  "employment_types",
  "work_arrangement",
  "salary_text",
  "description",
  "job_url",
  "application_url",
  "posted_date",
  "posted_text",
  "collected_at",
  "details_collected_at",
  "first_seen_at",
  "last_seen_at",
];

export function saveJobs(
  db: DatabaseSync,
  records: JobRecord[],
): { saved: number; skipped: number } {
  let saved = 0,
    skipped = 0;
  const updates = columns
    .filter((c) => !["source", "source_job_key", "first_seen_at"].includes(c))
    .map((c) => {
      if (c === "employment_types")
        return `${c}=CASE WHEN excluded.${c}='[]' THEN jobs.${c} ELSE excluded.${c} END`;
      if (c === "last_seen_at" || c === "collected_at")
        return `${c}=MAX(jobs.${c}, excluded.${c})`;
      return `${c}=COALESCE(excluded.${c}, jobs.${c})`;
    })
    .join(",");
  const statement =
    db.prepare(`INSERT INTO jobs (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON CONFLICT(source, source_job_key) DO UPDATE SET ${updates}`);
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const raw of records) {
      const job = cleanJobRecord(raw);
      if (!job) {
        skipped++;
        continue;
      }
      if (job.source_job_id) {
        const exact = db
          .prepare("SELECT id FROM jobs WHERE source=? AND source_job_key=?")
          .get(job.source, job.source_job_key);
        const fallback = db
          .prepare(
            "SELECT id, source_job_id FROM jobs WHERE source=? AND job_url=?",
          )
          .all(job.source, job.job_url);
        if (
          !exact &&
          fallback.length === 1 &&
          fallback[0].source_job_id === null
        ) {
          db.prepare(
            "UPDATE jobs SET source_job_key=?, source_job_id=? WHERE id=?",
          ).run(job.source_job_key, job.source_job_id, fallback[0].id!);
        }
      }
      statement.run(
        job.source,
        job.source_job_id,
        job.source_job_key,
        job.title,
        job.company,
        job.location,
        JSON.stringify(job.employment_types),
        job.work_arrangement,
        job.salary_text,
        job.description,
        job.job_url,
        job.application_url,
        job.posted_date,
        job.posted_text,
        job.collected_at,
        job.details_collected_at,
        job.collected_at,
        job.collected_at,
      );
      saved++;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { saved, skipped };
}
