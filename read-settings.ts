import { readFileSync, existsSync, realpathSync } from "node:fs";
import {
  basename,
  dirname,
  resolve,
  relative,
  isAbsolute,
  join,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = dirname(fileURLToPath(import.meta.url));
export type BrowserName = "chrome" | "cloakbrowser";
export interface Settings {
  databasePath: string;
  browser: BrowserName;
  chromeProfilePath: string;
  cloakBrowserProfilePath: string;
  capturesPath: string;
  port: number;
  sourceTimezone: string;
}

export function readSettings(root = projectRoot): Settings {
  const read = (name: string) =>
    JSON.parse(readFileSync(join(root, name), "utf8"));
  const raw = {
    browser: "chrome",
    cloakBrowserProfilePath: "%LOCALAPPDATA%/WebBot/CloakBrowser/User Data",
    ...read("job-radar-settings.json"),
    ...(existsSync(join(root, "job-radar-settings.local.json"))
      ? read("job-radar-settings.local.json")
      : {}),
  };
  const localPath = (value: string) => {
    if (typeof value !== "string" || !value.trim())
      throw new Error("Configured paths must be nonempty strings.");
    return resolve(
      root,
      value.replace(/%([^%]+)%/g, (_, key) => {
        if (!process.env[key])
          throw new Error(`Missing environment variable: ${key}`);
        return process.env[key]!;
      }),
    );
  };
  if (raw.browser !== "chrome" && raw.browser !== "cloakbrowser")
    throw new Error('Invalid browser: choose "chrome" or "cloakbrowser".');
  if (!Number.isInteger(raw.port) || raw.port < 1 || raw.port > 65535)
    throw new Error("Invalid server port");
  new Intl.DateTimeFormat("en-CA", { timeZone: raw.sourceTimezone }).format();
  return {
    ...raw,
    databasePath: localPath(raw.databasePath),
    chromeProfilePath: localPath(raw.chromeProfilePath),
    cloakBrowserProfilePath: localPath(raw.cloakBrowserProfilePath),
    capturesPath: localPath(raw.capturesPath),
  };
}

// Resolve existing ancestors too, so a junction cannot alias a normal browser profile.
export function physicalPath(path: string): string {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return parent === path ? path : join(physicalPath(parent), basename(path));
}

function within(child: string, parent: string): boolean {
  const part = relative(parent, child);
  return (
    part === "" ||
    (part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part))
  );
}

export function browserProfilePath(settings: Settings): string {
  assertDedicatedProfile(settings.chromeProfilePath);
  assertDedicatedProfile(settings.cloakBrowserProfilePath);
  const chrome = physicalPath(
    resolve(settings.chromeProfilePath),
  ).toLowerCase();
  const cloak = physicalPath(
    resolve(settings.cloakBrowserProfilePath),
  ).toLowerCase();
  if (within(chrome, cloak) || within(cloak, chrome))
    throw new Error(
      "Chrome and CloakBrowser must use separate, non-overlapping bot profiles.",
    );
  return settings.browser === "chrome"
    ? settings.chromeProfilePath
    : settings.cloakBrowserProfilePath;
}

export function assertDedicatedProfile(profile: string): void {
  if (!process.env.LOCALAPPDATA)
    throw new Error("LOCALAPPDATA is required for the Windows bot profile");
  const actual = physicalPath(resolve(profile)).toLowerCase();
  const normal = physicalPath(
    join(process.env.LOCALAPPDATA, "Google/Chrome/User Data"),
  ).toLowerCase();
  if (within(actual, normal) || within(normal, actual)) {
    throw new Error(
      "Refusing to use the normal Chrome user-data directory. Choose a separate bot directory.",
    );
  }
}
