import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  utimesSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TestContext } from "node:test";
import { withCollectorLock } from "../collection/collector-lock.js";

function fixture(t: TestContext) {
  const folder = mkdtempSync(join(tmpdir(), "job-radar-lock-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return join(folder, "jobs.sqlite");
}

test("a second process cannot enter collection while the database is locked", async (t) => {
  const path = fixture(t);
  const moduleUrl = new URL("../collection/collector-lock.ts", import.meta.url)
    .href;
  await withCollectorLock(path, async () => {
    const code = `import { withCollectorLock } from ${JSON.stringify(moduleUrl)};
      try { await withCollectorLock(${JSON.stringify(path)}, async () => { console.log('entered'); }); }
      catch (error) { console.log(error.message); }`;
    const { stdout } = await promisify(execFile)(process.execPath, [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      code,
    ]);
    assert.match(stdout, /Another collector/);
    assert.ok(!stdout.includes("entered"));
  });
  assert.equal(existsSync(`${path}.lock`), false);
  assert.equal(
    await withCollectorLock(path, async () => "next collector"),
    "next collector",
  );
});

test("failed browser startup releases the database lock", async (t) => {
  const path = fixture(t);
  await assert.rejects(
    withCollectorLock(path, async () => {
      throw new Error("browser unavailable");
    }),
    /browser unavailable/,
  );
  assert.equal(await withCollectorLock(path, async () => 42), 42);
});

test("stale crash locks recover, but a fresh lock is not removed", async (t) => {
  const path = fixture(t);
  const lockPath = `${path}.lock`;
  mkdirSync(lockPath);
  await assert.rejects(
    withCollectorLock(path, async () => assert.fail("must not run")),
    /Another collector/,
  );
  assert.equal(existsSync(lockPath), true);
  const old = new Date(Date.now() - 120_000);
  utimesSync(lockPath, old, old);
  assert.equal(
    await withCollectorLock(path, async () => "recovered"),
    "recovered",
  );
});
