import { createHash } from "node:crypto";
import type { SearchConfig, SourcePage } from "../data/job-record.js";

export function calendarDate(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function subtractDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

export function chooseSearchWindow(
  config: SearchConfig,
  previous: string | null,
  started: string,
  timezone: string,
): string {
  return subtractDays(
    calendarDate(previous || started, timezone),
    previous ? config.overlapDays : config.initialLookbackDays,
  );
}

export function definitionSignature(config: SearchConfig): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: config.source,
        keywords: config.keywords,
        location: config.location,
        initialLookbackDays: config.initialLookbackDays,
        overlapDays: config.overlapDays,
      }),
    )
    .digest("hex");
}

export function pageBeforeCutoff(page: SourcePage, cutoff: string): boolean {
  return (
    page.chronologicalOrderConfirmed &&
    page.ordinaryDates.length > 0 &&
    page.ordinaryDates.every((date) => date !== null && date < cutoff)
  );
}
