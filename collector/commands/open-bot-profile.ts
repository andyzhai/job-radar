import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { assertDedicatedProfile, readSettings } from "../../read-settings.js";
import { chromeExecutable } from "../browser/open-persistent-chrome.js";
import { readSearches } from "../collection/run-configured-searches.js";

const settings = readSettings();
assertDedicatedProfile(settings.chromeProfilePath);
mkdirSync(settings.chromeProfilePath, { recursive: true });
const mode = process.argv[2];
if (mode && !["indeed", "app"].includes(mode))
  throw new Error("Usage: npm run profile [-- indeed|app]");
const search = readSearches().find((s) => s.enabled);
const indeed = new URL("https://ca.indeed.com/jobs");
if (search) {
  indeed.searchParams.set("q", search.keywords);
  indeed.searchParams.set("l", search.location);
  indeed.searchParams.set("sort", "date");
}
const urls =
  mode === "app"
    ? [`http://127.0.0.1:${settings.port}`]
    : mode === "indeed"
      ? [indeed.href]
      : [
          "https://accounts.google.com/",
          "https://ca.indeed.com/",
          "https://www.linkedin.com/login",
        ];
const child = spawn(
  chromeExecutable(),
  [
    `--user-data-dir=${settings.chromeProfilePath}`,
    "--profile-directory=Default",
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    ...urls,
  ],
  { detached: true, stdio: "ignore" },
);
child.on("error", () => {
  console.error("Could not open Chrome.");
  process.exitCode = 1;
});
child.unref();
console.log(
  `Opened the dedicated Web Bot Chrome profile: ${settings.chromeProfilePath}`,
);
console.log(
  "Sign in manually with your dedicated accounts. Close these bot windows before npm run collect or inspect.",
);
