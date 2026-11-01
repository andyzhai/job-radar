import type { DatabaseSync } from "node:sqlite";
import { serializeJob } from "./search-jobs.js";

export function getJobDetails(db: DatabaseSync, id: number) {
  const row = db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
  return row ? serializeJob(row) : null;
}
