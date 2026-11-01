export interface SavedJob {
  id: number;
  source: string;
  title: string;
  company: string | null;
  location: string | null;
  employment_types: string[];
  work_arrangement: string | null;
  salary_text: string | null;
  description: string | null;
  job_url: string;
  application_url: string | null;
  posted_date: string | null;
  posted_text: string | null;
  collected_at: string;
  details_collected_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
}
export interface Results {
  items: SavedJob[];
  total: number;
  limit: number;
  offset: number;
}

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.message || "Saved jobs are unavailable. Please retry.",
    );
  return body as T;
}
export function searchJobs(
  keywords: string,
  source: string,
  offset: number,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({
    keywords,
    limit: "25",
    offset: String(offset),
  });
  if (source) params.set("source", source);
  return get<Results>(`/api/jobs?${params}`, signal);
}
export const getJob = (id: number, signal: AbortSignal) =>
  get<SavedJob>(`/api/jobs/${id}`, signal);
