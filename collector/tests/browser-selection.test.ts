import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import type { BrowserContext } from "playwright";
import { readSettings, browserProfilePath } from "../../read-settings.js";
import { openPersistentBrowser } from "../browser/open-persistent-browser.js";
import { temporarySettings } from "./browser-test-helper.js";

function fixture(t: TestContext) {
  const folder = mkdtempSync(join(tmpdir(), "job-radar-selection-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return { folder, settings: temporarySettings(folder) };
}

test("old settings default to Chrome; a local override selects CloakBrowser without changing Chrome's path", (t) => {
  const { folder, settings } = fixture(t);
  const { browser, cloakBrowserProfilePath, ...legacy } = settings;
  writeFileSync(
    join(folder, "job-radar-settings.json"),
    JSON.stringify(legacy),
  );
  assert.equal(readSettings(folder).browser, "chrome");
  writeFileSync(
    join(folder, "job-radar-settings.local.json"),
    JSON.stringify({ browser: "cloakbrowser" }),
  );
  const selected = readSettings(folder);
  assert.equal(selected.browser, "cloakbrowser");
  assert.equal(selected.chromeProfilePath, settings.chromeProfilePath);
  assert.equal(
    selected.cloakBrowserProfilePath,
    join(process.env.LOCALAPPDATA!, "WebBot/CloakBrowser/User Data"),
  );
});

test("settings reject invalid browser values and resolve local relative profile overrides", (t) => {
  const { folder, settings } = fixture(t);
  writeFileSync(
    join(folder, "job-radar-settings.json"),
    JSON.stringify(settings),
  );
  for (const browser of ["auto", "firefox", "Chrome", "", null, 42]) {
    writeFileSync(
      join(folder, "job-radar-settings.local.json"),
      JSON.stringify({ browser }),
    );
    assert.throws(() => readSettings(folder), /Invalid browser/);
  }
  writeFileSync(
    join(folder, "job-radar-settings.local.json"),
    JSON.stringify({ cloakBrowserProfilePath: "profiles/cloak" }),
  );
  assert.equal(
    readSettings(folder).cloakBrowserProfilePath,
    join(folder, "profiles/cloak"),
  );
});

test("profiles reject personal Chrome, overlap, and junction aliases", (t) => {
  const { folder, settings } = fixture(t);
  for (const path of [
    settings.chromeProfilePath,
    join(settings.chromeProfilePath, "child"),
    join(settings.chromeProfilePath, "..child"),
    folder,
  ])
    assert.throws(
      () => browserProfilePath({ ...settings, cloakBrowserProfilePath: path }),
      /non-overlapping/,
    );
  assert.throws(
    () =>
      browserProfilePath({
        ...settings,
        cloakBrowserProfilePath: join(
          process.env.LOCALAPPDATA!,
          "Google/Chrome/User Data",
        ),
      }),
    /Refusing/,
  );
  mkdirSync(settings.chromeProfilePath);
  const alias = join(folder, "alias");
  symlinkSync(settings.chromeProfilePath, alias, "junction");
  assert.throws(
    () =>
      browserProfilePath({
        ...settings,
        cloakBrowserProfilePath: join(alias, "new-child"),
      }),
    /non-overlapping/,
  );
});

test("each selection launches only its own profile and preserves headed defaults", async (t) => {
  const { settings } = fixture(t);
  const calls: unknown[] = [];
  const context = {} as BrowserContext;
  const implementations = {
    chrome: async (profile: string, options: unknown) => {
      calls.push(["chrome", profile, options]);
      return context;
    },
    cloakbrowser: async (profile: string, options: unknown) => {
      calls.push(["cloakbrowser", profile, options]);
      return context;
    },
  };
  assert.equal(
    await openPersistentBrowser(settings, {}, implementations),
    context,
  );
  await openPersistentBrowser(
    { ...settings, browser: "cloakbrowser" },
    {},
    implementations,
  );
  assert.deepEqual(calls, [
    ["chrome", settings.chromeProfilePath, { headless: false, viewport: null }],
    [
      "cloakbrowser",
      settings.cloakBrowserProfilePath,
      { headless: false, viewport: null },
    ],
  ]);
});

test("launch errors never switch browser or expose raw command lines", async (t) => {
  const { settings } = fixture(t);
  for (const browser of ["chrome", "cloakbrowser"] as const) {
    for (const message of [
      "ProcessSingleton: profile in use private-token",
      "launch failed private-token",
    ]) {
      const calls: string[] = [];
      const fail = async () => {
        calls.push(browser);
        throw new Error(message);
      };
      const other = async () => {
        calls.push("unexpected");
        return {} as BrowserContext;
      };
      await assert.rejects(
        openPersistentBrowser(
          { ...settings, browser },
          {},
          {
            chrome: browser === "chrome" ? fail : other,
            cloakbrowser: browser === "cloakbrowser" ? fail : other,
          },
        ),
        (error: Error) => {
          assert.match(error.message, /busy|Cannot start/);
          assert.ok(!error.message.includes("private-token"));
          return true;
        },
      );
      assert.deepEqual(calls, [browser]);
    }
  }
});

test("missing CloakBrowser setup fails without signup prompts or Chrome fallback", async (t) => {
  const { folder, settings } = fixture(t);
  const oldKey = process.env.CLOAKBROWSER_LICENSE_KEY;
  const oldCache = process.env.CLOAKBROWSER_CACHE_DIR;
  delete process.env.CLOAKBROWSER_LICENSE_KEY;
  process.env.CLOAKBROWSER_CACHE_DIR = join(folder, "empty-cache");
  try {
    await assert.rejects(
      openPersistentBrowser({ ...settings, browser: "cloakbrowser" }),
      /npx cloakbrowser login/,
    );
  } finally {
    if (oldKey === undefined) delete process.env.CLOAKBROWSER_LICENSE_KEY;
    else process.env.CLOAKBROWSER_LICENSE_KEY = oldKey;
    if (oldCache === undefined) delete process.env.CLOAKBROWSER_CACHE_DIR;
    else process.env.CLOAKBROWSER_CACHE_DIR = oldCache;
  }
});
