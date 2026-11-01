import type { DatabaseSync, SQLInputValue, SQLOutputValue } from "node:sqlite";

export interface JobQuery {
  keywords: string;
  sources: string[];
  limit: number;
  offset: number;
}
export function serializeJob(
  row: Record<string, SQLOutputValue>,
): Record<string, SQLOutputValue | string[]> {
  return {
    ...row,
    employment_types: JSON.parse(String(row.employment_types)) as string[],
  };
}

export function searchJobs(db: DatabaseSync, query: JobQuery) {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  for (const term of query.keywords.split(/\s+/).filter(Boolean)) {
    clauses.push(
      "(COALESCE(title,'') || ' ' || COALESCE(company,'') || ' ' || COALESCE(description,'')) LIKE ? ESCAPE '\\'",
    );
    params.push(`%${term.replace(/[\\%_]/g, "\\$&")}%`);
  }
  if (query.sources.length) {
    clauses.push(`source IN (${query.sources.map(() => "?").join(",")})`);
    params.push(...query.sources);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  // A read transaction keeps count and page consistent during collector writes.
  db.exec("BEGIN");
  try {
    const total = Number(
      db.prepare(`SELECT COUNT(*) AS total FROM jobs ${where}`).get(...params)!
        .total,
    );
    const items = db
      .prepare(
        `SELECT * FROM jobs ${where} ORDER BY posted_date DESC, first_seen_at DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, query.limit, query.offset)
      .map(serializeJob);
    db.exec("COMMIT");
    return { items, total, limit: query.limit, offset: query.offset };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
