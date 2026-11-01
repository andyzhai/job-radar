import type { DatabaseSync } from "node:sqlite";
import type { RunStatus, SearchConfig } from "../data/job-record.js";
import { saveSearchProgress } from "./search-progress-store.js";

export interface RunResult {
  status: RunStatus;
  reason: string;
  pages: number;
  read: number;
  saved: number;
  skipped: number;
}

export function startRun(
  db: DatabaseSync,
  config: SearchConfig,
  signature: string,
  started: string,
  cutoff: string,
): number {
  return Number(
    db
      .prepare(
        `INSERT INTO collection_runs(source, search_id, definition_signature, started_at, cutoff_date, status)
    VALUES (?, ?, ?, ?, ?, 'running')`,
      )
      .run(config.source, config.id, signature, started, cutoff)
      .lastInsertRowid,
  );
}

export function updateRunCounts(
  db: DatabaseSync,
  id: number,
  result: RunResult,
): void {
  db.prepare(
    "UPDATE collection_runs SET pages=?, jobs_read=?, jobs_saved=?, jobs_skipped=? WHERE id=?",
  ).run(result.pages, result.read, result.saved, result.skipped, id);
}

export function finishRun(
  db: DatabaseSync,
  id: number,
  result: RunResult,
): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    updateRunCounts(db, id, result);
    db.prepare(
      "UPDATE collection_runs SET status=?, stop_reason=?, finished_at=? WHERE id=?",
    ).run(result.status, result.reason, new Date().toISOString(), id);
    if (result.status === "completed") {
      const row = db
        .prepare("SELECT * FROM collection_runs WHERE id=?")
        .get(id)!;
      saveSearchProgress(
        db,
        String(row.search_id),
        String(row.definition_signature),
        String(row.started_at),
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function recoverInterruptedRuns(db: DatabaseSync): void {
  db.prepare(
    `UPDATE collection_runs SET status='partial', stop_reason='interrupted_before_finish', finished_at=? WHERE status='running'`,
  ).run(new Date().toISOString());
}
