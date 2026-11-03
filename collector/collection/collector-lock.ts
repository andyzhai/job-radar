import lockfile from "proper-lockfile";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { physicalPath } from "../../read-settings.js";

// Shared by both browser choices, including before the database first exists.
export async function withCollectorLock<T>(
  databasePath: string,
  run: () => Promise<T>,
): Promise<T> {
  mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  const path = physicalPath(resolve(databasePath));
  let release: () => Promise<void>;
  try {
    release = await lockfile.lock(path, {
      realpath: false,
      retries: 0,
      stale: 60_000,
      update: 10_000,
      onCompromised: () => {
        // Fail closed: never continue writing after losing ownership.
        throw new Error(
          "Collector lock was lost. Collection stopped; retry after closing other collectors.",
        );
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOCKED")
      throw new Error(
        "Another collector is using this database. Wait for it to finish. After a crash, retry in one minute.",
      );
    throw new Error(
      "Cannot acquire the collector lock. Check database directory permissions.",
    );
  }
  try {
    return await run();
  } finally {
    await release();
  }
}
