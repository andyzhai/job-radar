import type { SavedJob } from "../api/jobs-api.js";

function safeLink(value: string | null): string | undefined {
  try {
    const url = new URL(value || "");
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
const time = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Not collected";

export function JobDetailsPanel({
  job,
  loading,
  error,
  onBack,
}: {
  job: SavedJob | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <section className="detail-panel" aria-label="Job details">
      <button className="back" onClick={onBack}>
        ← Back to results
      </button>
      {loading ? (
        <p role="status">Loading job details…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : job ? (
        <>
          <span className="eyebrow">Saved from {job.source}</span>
          <h2>{job.title}</h2>
          <p className="detail-company">
            {job.company || "Company not provided"}
          </p>
          <p className="muted">{job.location || "Location not provided"}</p>
          <div className="tags">
            {[job.work_arrangement, ...job.employment_types]
              .filter(Boolean)
              .map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
          </div>
          {job.salary_text && (
            <p className="detail-salary">{job.salary_text}</p>
          )}
          <div className="source-links">
            {safeLink(job.job_url) && (
              <a
                className="primary"
                href={safeLink(job.job_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open original posting ↗
              </a>
            )}
            {safeLink(job.application_url) &&
              job.application_url !== job.job_url && (
                <a
                  href={safeLink(job.application_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Application page ↗
                </a>
              )}
          </div>
          <dl className="dates">
            <div>
              <dt>Posted</dt>
              <dd>
                {job.posted_date || "Unknown"}
                {job.posted_text ? ` · ${job.posted_text}` : ""}
              </dd>
            </div>
            <div>
              <dt>First collected</dt>
              <dd>{time(job.first_seen_at)}</dd>
            </div>
            <div>
              <dt>Last seen</dt>
              <dd>{time(job.last_seen_at)}</dd>
            </div>
            <div>
              <dt>Details collected</dt>
              <dd>{time(job.details_collected_at)}</dd>
            </div>
          </dl>
          <h3>About the role</h3>
          <p className="description">
            {job.description ||
              "A description has not been collected. Open the original posting for more information."}
          </p>
        </>
      ) : (
        <div className="detail-placeholder">
          <span aria-hidden="true">↖</span>
          <h2>A closer look at your next role</h2>
          <p>
            Select a saved job to read its description and open the original
            posting.
          </p>
        </div>
      )}
    </section>
  );
}
