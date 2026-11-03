import { chromium, type BrowserContext } from "playwright";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  browserProfilePath,
  type BrowserName,
  type Settings,
} from "../../read-settings.js";

interface BrowserOptions {
  headless?: boolean;
  viewport?: { width: number; height: number } | null;
}

type Launcher = (
  profile: string,
  options: BrowserOptions,
) => Promise<BrowserContext>;
type Launchers = Record<BrowserName, Launcher>;

const launchers: Launchers = {
  chrome: (profile, options) =>
    chromium.launchPersistentContext(profile, {
      channel: "chrome",
      ...options,
      args: ["--no-first-run", "--no-default-browser-check"],
      timeout: 30_000,
    }),
  cloakbrowser: async (profile, options) => {
    // Read only the documented credential locations; never print the key.
    let key = process.env.CLOAKBROWSER_LICENSE_KEY?.trim();
    if (!key) {
      try {
        key = readFileSync(
          join(
            process.env.CLOAKBROWSER_CACHE_DIR ||
              join(homedir(), ".cloakbrowser"),
            "license.key",
          ),
          "utf8",
        ).trim();
      } catch {
        /* Setup error below also covers an unreadable key file. */
      }
    }
    if (!key)
      throw new BrowserSetupError(
        "CloakBrowser needs a license key. Run npx cloakbrowser login or set CLOAKBROWSER_LICENSE_KEY.",
      );
    const cloak = await import("cloakbrowser");
    const customBinary = process.env.CLOAKBROWSER_BINARY_PATH;
    if (
      customBinary ? !existsSync(customBinary) : !cloak.binaryInfo().installed
    )
      throw new BrowserSetupError(
        "CloakBrowser binary is unavailable. Run npx cloakbrowser install and npx cloakbrowser info, or check CLOAKBROWSER_BINARY_PATH.",
      );
    return cloak.launchPersistentContext({
      userDataDir: profile,
      ...options,
      licenseKey: key,
      args: ["--no-first-run", "--no-default-browser-check"],
      launchOptions: { timeout: 30_000 },
    });
  },
};

class BrowserSetupError extends Error {}

export async function openPersistentBrowser(
  settings: Settings,
  options: BrowserOptions = {},
  implementations: Launchers = launchers,
): Promise<BrowserContext> {
  const profile = browserProfilePath(settings);
  mkdirSync(profile, { recursive: true });
  try {
    return await implementations[settings.browser](profile, {
      headless: false,
      viewport: null,
      ...options,
    });
  } catch (error) {
    if (error instanceof BrowserSetupError) throw error;
    // Do not expose raw launch command lines, credentials, or profile contents.
    const message = error instanceof Error ? error.message : "";
    if (
      /ProcessSingleton|SingletonLock|profile.*(?:in use|locked)|user data directory is already in use/i.test(
        message,
      )
    )
      throw new Error(
        `The ${settings.browser} bot profile is busy. Close its windows and retry.`,
      );
    const setup =
      settings.browser === "chrome"
        ? "Check that Google Chrome is installed."
        : "Check CloakBrowser setup and license with npx cloakbrowser info.";
    throw new Error(
      `Cannot start ${settings.browser}. Close its bot windows and retry. ${setup} No other browser was started.`,
    );
  }
}
