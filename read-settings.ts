import { readFileSync, existsSync, realpathSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = dirname(fileURLToPath(import.meta.url));
export interface Settings {
  databasePath: string;
  chromeProfilePath: string;
  capturesPath: string;
  port: number;
  sourceTimezone: string;
}

export function readSettings(): Settings {
  const read = (name: string) =>
    JSON.parse(readFileSync(join(projectRoot, name), "utf8"));
  const raw = {
    ...read("job-radar-settings.json"),
    ...(existsSync(join(projectRoot, "job-radar-settings.local.json"))
      ? read("job-radar-settings.local.json")
      : {}),
  };
  const localPath = (value: string) =>
    resolve(
      projectRoot,
      value.replace(/%([^%]+)%/g, (_, key) => {
        if (!process.env[key])
          throw new Error(`Missing environment variable: ${key}`);
        return process.env[key]!;
      }),
    );
  if (!Number.isInteger(raw.port) || raw.port < 1 || raw.port > 65535)
    throw new Error("Invalid server port");
  new Intl.DateTimeFormat("en-CA", { timeZone: raw.sourceTimezone }).format();
  return {
    ...raw,
    databasePath: localPath(raw.databasePath),
    chromeProfilePath: localPath(raw.chromeProfilePath),
    capturesPath: localPath(raw.capturesPath),
  };
}

// Resolve existing ancestors too, so a junction cannot alias a normal browser profile.
function physicalPath(path: string): string {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return parent === path
    ? path
    : join(physicalPath(parent), path.slice(parent.length + 1));
}

export function assertDedicatedProfile(profile: string): void {
  if (!process.env.LOCALAPPDATA)
    throw new Error("LOCALAPPDATA is required for the Windows bot profile");
  const actual = physicalPath(resolve(profile)).toLowerCase();
  const normal = physicalPath(
    join(process.env.LOCALAPPDATA, "Google/Chrome/User Data"),
  ).toLowerCase();
  const within = (child: string, parent: string) => {
    const part = relative(parent, child);
    return part === "" || (!part.startsWith("..") && !isAbsolute(part));
  };
  if (within(actual, normal) || within(normal, actual)) {
    throw new Error(
      "Refusing to use the normal Chrome user-data directory. Choose a separate bot directory.",
    );
  }
}
