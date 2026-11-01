import type { Results } from "../api/jobs-api.js";

export function JobResults({
  results,
  selectedId,
  onSelect,
  onPage,
}: {
  results: Results;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onPage: (offset: number) => void;
}) {
  return (
    <section className="results" aria-label="Saved job results">
      <div className="list-heading">
        <h2>
          {results.total} saved {results.total === 1 ? "job" : "jobs"}
        </h2>
        <span>Newest posted first</span>
      </div>
      {results.items.length === 0 ? (
        <div className="empty">
          <span aria-hidden="true">◎</span>
          <h3>No matching jobs yet</h3>
          <p>
            Try broader keywords or another source. New jobs appear here after a
            collection run.
          </p>
        </div>
      ) : (
        <ul className="job-list">
          {results.items.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                className={`job-card ${selectedId === job.id ? "selected" : ""}`}
                aria-pressed={selectedId === job.id}
                onClick={() => onSelect(job.id)}
              >
                <span className="card-meta">
                  <span className="source">{job.source}</span>
                  <span>
                    {job.posted_date ||
                      job.posted_text ||
                      "Posting date unknown"}
                  </span>
                </span>
                <h3>{job.title}</h3>
                <p className="company">
                  {job.company || "Company not provided"}
                </p>
                <p>{job.location || "Location not provided"}</p>
                {job.salary_text && <p className="salary">{job.salary_text}</p>}
                <span className="card-footer">
                  View saved details <span aria-hidden="true">→</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.total > results.limit && (
        <nav className="pagination" aria-label="Results pages">
          <button
            disabled={results.offset === 0}
            onClick={() => onPage(Math.max(0, results.offset - results.limit))}
          >
            Previous
          </button>
          <span>
            {results.offset + 1}–
            {Math.min(results.total, results.offset + results.limit)} of{" "}
            {results.total}
          </span>
          <button
            disabled={results.offset + results.limit >= results.total}
            onClick={() => onPage(results.offset + results.limit)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
