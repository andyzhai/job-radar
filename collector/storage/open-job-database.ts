import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openJobDatabase(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    const version = Number(
      db.prepare("PRAGMA user_version").get()!.user_version,
    );
    if (version === 0)
      db.exec(
        readFileSync(
          new URL("./schema/001-create-job-tables.sql", import.meta.url),
          "utf8",
        ),
      );
    else if (version !== 1)
      throw new Error("Unsupported database schema version");
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
