import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";

export class DatabaseUnavailable extends Error {
  constructor() {
    super(
      "The job database is not ready. Run npm run db:init or npm run collect, then retry.",
    );
  }
}

export function openReadonlyDatabase(path: string): DatabaseSync {
  if (!existsSync(path)) throw new DatabaseUnavailable();
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    db.exec("PRAGMA busy_timeout=5000; PRAGMA query_only=ON;");
    if (Number(db.prepare("PRAGMA user_version").get()!.user_version) !== 1)
      throw new Error("Incompatible schema");
    db.prepare("SELECT id FROM jobs LIMIT 1").get();
    return db;
  } catch {
    db?.close();
    throw new DatabaseUnavailable();
  }
}
