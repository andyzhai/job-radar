import type { JobRecord } from "./job-record.js";

export function cleanText(value: string | null | undefined): string | null {
  return value?.replace(/\s+/g, " ").trim() || null;
}

export function safeUrl(value: string | null | undefined): string | null {
  try {
    const url = new URL(value || "");
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function cleanJobRecord(job: JobRecord): JobRecord | null {
  const title = cleanText(job.title);
  const jobUrl = safeUrl(job.job_url);
  if (
    !title ||
    !jobUrl ||
    !cleanText(job.source) ||
    !cleanText(job.source_job_key)
  )
    return null;
  return {
    ...job,
    title,
    job_url: jobUrl,
    application_url: safeUrl(job.application_url),
    company: cleanText(job.company),
    location: cleanText(job.location),
    salary_text: cleanText(job.salary_text),
    posted_text: cleanText(job.posted_text),
    description: job.description?.trim() || null,
    employment_types: [
      ...new Set(
        job.employment_types.map(cleanText).filter((v): v is string => !!v),
      ),
    ],
  };
}
