import { readSettings } from "../../read-settings.js";
import { openPersistentBrowser } from "../browser/open-persistent-browser.js";
import { readSearches } from "../collection/run-configured-searches.js";

async function main() {
  const settings = readSettings();
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
  const context = await openPersistentBrowser(settings);
  let isClosed = false;
  const closed = new Promise<void>((resolve) =>
    context.once("close", () => {
      isClosed = true;
      resolve();
    }),
  );
  const close = () => {
    void context.close().catch(() => {});
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  try {
    console.log(`Opened the dedicated ${settings.browser} bot profile.`);
    console.log(
      "Sign in manually with your dedicated accounts. This command stays running until the browser closes. Close these windows before collection or inspection.",
    );
    for (const [index, url] of urls.entries()) {
      if (isClosed) break;
      const page =
        index === 0
          ? context.pages()[0] || (await context.newPage())
          : await context.newPage();
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
      } catch {
        // A slow/offline site must not close the user's manual-login window.
        if (!isClosed)
          console.warn(
            `Could not load ${new URL(url).hostname}. You can navigate manually in the browser.`,
          );
      }
    }
    await closed;
  } finally {
    process.removeListener("SIGINT", close);
    process.removeListener("SIGTERM", close);
    await context.close();
  }
}

main().catch((error) => {
  console.error(error.message || "Could not open the selected bot browser.");
  process.exitCode = 1;
});
