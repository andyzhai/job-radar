import type { JobRecord } from "../../data/job-record.js";
import { cleanJobRecord, cleanText } from "../../data/clean-job-record.js";
import {
  calendarDate,
  subtractDays,
} from "../../collection/choose-search-window.js";

export interface IndeedJobFields {
  id: string | null;
  title: string;
  company?: string | null;
  location?: string | null;
  salary?: string | null;
  employmentTypes?: string[];
  workArrangement?: string | null;
  description?: string | null;
  url: string;
  applicationUrl?: string | null;
  postedText?: string | null;
  detailsCollectedAt?: string | null;
}

export function parsePostedDate(
  text: string | null | undefined,
  observed: string,
  timezone: string,
): string | null {
  const value = cleanText(text)
    ?.toLowerCase()
    .replace(/^posted\s+/, "")
    .replace(/^employer\s+/, "");
  if (!value) return null;
  const today = calendarDate(observed, timezone);
  if (/^(today|just posted)$/.test(value)) return today;
  if (value === "yesterday") return subtractDays(today, 1);
  const match = /^(\d+) days? ago$/.exec(value);
  if (match && Number(match[1]) <= 3650)
    return subtractDays(today, Number(match[1]));
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    if (
      !Number.isNaN(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value
    )
      return value;
  }
  return null; // "30+ days ago", "new", and ambiguous dates remain unknown.
}

export function mapIndeedJob(
  raw: IndeedJobFields,
  observed: string,
  timezone: string,
): JobRecord | null {
  let url: URL;
  try {
    url = new URL(raw.url);
  } catch {
    return null;
  }
  if (
    !/^([a-z]+\.)?indeed\.com$/i.test(url.hostname) ||
    url.protocol !== "https:"
  )
    return null;
  const id = cleanText(raw.id) || url.searchParams.get("jk");
  if (id) {
    url = new URL("https://ca.indeed.com/viewjob");
    url.searchParams.set("jk", id);
  } else
    for (const key of [
      "from",
      "fromage",
      "tk",
      "advn",
      "utm_source",
      "utm_medium",
      "utm_campaign",
    ])
      url.searchParams.delete(key);
  url.hash = "";
  const labels: Record<string, string> = {
    "full-time": "Full-time",
    "part-time": "Part-time",
    permanent: "Permanent",
    contract: "Contract",
    "fixed term contract": "Contract",
    temporary: "Temporary",
    internship: "Internship",
    casual: "Casual",
    seasonal: "Seasonal",
  };
  const employmentTypes = (raw.employmentTypes || [])
    .map((label) => labels[label.trim().toLowerCase()])
    .filter(Boolean);
  const work = cleanText(raw.workArrangement)?.toLowerCase();
  return cleanJobRecord({
    source: "indeed",
    source_job_id: id,
    source_job_key: id ? `id:${id}` : `url:${url.href}`,
    title: raw.title,
    company: raw.company || null,
    location: raw.location || null,
    salary_text: raw.salary || null,
    employment_types: employmentTypes,
    work_arrangement:
      work && ["remote", "hybrid", "on-site"].includes(work) ? work : null,
    description: raw.description || null,
    job_url: url.href,
    application_url: raw.applicationUrl || null,
    posted_date: parsePostedDate(raw.postedText, observed, timezone),
    posted_text: raw.postedText || null,
    collected_at: observed,
    details_collected_at: raw.detailsCollectedAt || null,
  });
}
