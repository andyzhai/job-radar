import type { Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function capturePageLayout(
  page: Page,
  folder: string,
  label: string,
): Promise<string> {
  mkdirSync(folder, { recursive: true });
  const prefix = join(
    folder,
    `${label}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  // Captures are local only. Never capture cookies, storage state, request headers, or login forms.
  const pathname = new URL(page.url()).pathname;
  if (
    /login|signin|auth|checkpoint|challenge/i.test(pathname) ||
    /just a moment|access denied|verification required/i.test(
      await page.title(),
    ) ||
    (await page.locator('input[type="password"]:visible').count()) > 0
  )
    return "Login/challenge capture skipped";
  writeFileSync(
    `${prefix}.txt`,
    await page.locator("body").innerText(),
    "utf8",
  );
  writeFileSync(
    `${prefix}.aria.txt`,
    await page.locator("body").ariaSnapshot(),
    "utf8",
  );
  await page.screenshot({ path: `${prefix}.png`, fullPage: true });
  return prefix;
}
