BEGIN;
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_job_id TEXT,
  source_job_key TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  employment_types TEXT NOT NULL DEFAULT '[]',
  work_arrangement TEXT,
  salary_text TEXT,
  description TEXT,
  job_url TEXT NOT NULL,
  application_url TEXT,
  posted_date TEXT,
  posted_text TEXT,
  collected_at TEXT NOT NULL,
  details_collected_at TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(source, source_job_key)
);
CREATE INDEX jobs_posted_order ON jobs(posted_date DESC, first_seen_at DESC, id DESC);
CREATE INDEX jobs_source_url ON jobs(source, job_url);
CREATE TABLE collection_runs (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  search_id TEXT NOT NULL,
  definition_signature TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  cutoff_date TEXT NOT NULL,
  pages INTEGER NOT NULL DEFAULT 0,
  jobs_read INTEGER NOT NULL DEFAULT 0,
  jobs_saved INTEGER NOT NULL DEFAULT 0,
  jobs_skipped INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('running','completed','partial','blocked','failed')),
  stop_reason TEXT
);
CREATE TABLE search_progress (
  search_id TEXT PRIMARY KEY,
  definition_signature TEXT NOT NULL,
  last_completed_start TEXT NOT NULL
);
PRAGMA user_version = 1;
COMMIT;
