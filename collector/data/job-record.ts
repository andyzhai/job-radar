export interface JobRecord {
  source: string;
  source_job_id: string | null;
  source_job_key: string;
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
}

export interface SearchConfig {
  id: string;
  enabled: boolean;
  source: "indeed";
  keywords: string;
  location: string;
  initialLookbackDays: number;
  overlapDays: number;
  maxPages: number;
  delayMs: number;
}

export type RunStatus = "completed" | "partial" | "blocked" | "failed";
export interface SourcePage {
  jobs: JobRecord[];
  ordinaryDates: (string | null)[];
  chronologicalOrderConfirmed: boolean;
  explicitEnd: boolean;
  incompleteDetails: boolean;
  skipped: number;
  blockedReason?: string;
}
