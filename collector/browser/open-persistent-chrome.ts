import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { assertDedicatedProfile, readSettings } from "../../read-settings.js";

export function chromeExecutable(): string {
  const candidates = [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
    process.env.LOCALAPPDATA,
  ]
    .filter(Boolean)
    .map((root) => join(root!, "Google/Chrome/Application/chrome.exe"));
  const found = candidates.find(existsSync);
  if (!found)
    throw new Error("Google Chrome is not installed in a standard location.");
  return found;
}

export async function openPersistentChrome() {
  const settings = readSettings();
  assertDedicatedProfile(settings.chromeProfilePath);
  mkdirSync(settings.chromeProfilePath, { recursive: true });
  try {
    return await chromium.launchPersistentContext(settings.chromeProfilePath, {
      channel: "chrome",
      headless: false,
      viewport: null,
      args: ["--no-first-run", "--no-default-browser-check"],
      timeout: 30_000,
    });
  } catch {
    // Do not leak Chrome command lines/profile data or silently switch profiles.
    throw new Error(
      "Cannot open the dedicated bot profile. Close its Chrome windows, then retry. Your normal Chrome can stay open.",
    );
  }
}
