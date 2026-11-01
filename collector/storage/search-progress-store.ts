import type { DatabaseSync } from "node:sqlite";

export function readSearchProgress(
  db: DatabaseSync,
  id: string,
  signature: string,
): string | null {
  const row = db
    .prepare(
      "SELECT last_completed_start FROM search_progress WHERE search_id=? AND definition_signature=?",
    )
    .get(id, signature);
  return row ? String(row.last_completed_start) : null;
}

export function saveSearchProgress(
  db: DatabaseSync,
  id: string,
  signature: string,
  started: string,
): void {
  db.prepare(
    `INSERT INTO search_progress VALUES (?, ?, ?) ON CONFLICT(search_id)
    DO UPDATE SET definition_signature=excluded.definition_signature, last_completed_start=excluded.last_completed_start`,
  ).run(id, signature, started);
}
