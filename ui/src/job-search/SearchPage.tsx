import { useEffect, useState } from "react";
import {
  searchJobs,
  getJob,
  type Results,
  type SavedJob,
} from "../api/jobs-api.js";
import { SearchFilters } from "./SearchFilters.js";
import { JobResults } from "./JobResults.js";
import { JobDetailsPanel } from "../job-details/JobDetailsPanel.js";

export function SearchPage() {
  const [query, setQuery] = useState({
    keywords: "",
    source: "",
    offset: 0,
    revision: 0,
  });
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [job, setJob] = useState<SavedJob | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSelectedId(null);
    searchJobs(query.keywords, query.source, query.offset, controller.signal)
      .then(setResults)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.message || "Cannot reach the local server.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setJob(null);
    setDetailError(null);
    setDetailLoading(selectedId !== null);
    if (selectedId !== null)
      getJob(selectedId, controller.signal)
        .then(setJob)
        .catch((e) => {
          if (!controller.signal.aborted) setDetailError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setDetailLoading(false);
        });
    return () => controller.abort();
  }, [selectedId]);
  return (
    <>
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◎
          </span>{" "}
          job radar<span className="brand-dot">.</span>
        </a>
        <span className="local-badge">
          <i /> Your local job library
        </span>
      </header>
      <main>
        <section className="intro">
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h1>
            Good opportunities.
            <br />
            <em>One place to find them.</em>
          </h1>
          <p>
            Search the jobs you’ve collected, take a closer look, and find your
            next move.
          </p>
        </section>
        <SearchFilters
          onSearch={(keywords, source) =>
            setQuery((q) => ({
              keywords,
              source,
              offset: 0,
              revision: q.revision + 1,
            }))
          }
        />
        <p className="library-note">
          Searching your saved library · Collection runs separately
        </p>
        {loading ? (
          <div className="state" role="status">
            Searching saved jobs…
          </div>
        ) : error ? (
          <div className="state error" role="alert">
            <h2>Saved jobs are unavailable</h2>
            <p>{error}</p>
            <button
              onClick={() =>
                setQuery((q) => ({ ...q, revision: q.revision + 1 }))
              }
            >
              Retry
            </button>
          </div>
        ) : (
          results && (
            <div
              className={`workspace ${selectedId !== null ? "show-detail" : ""}`}
            >
              <JobResults
                results={results}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onPage={(offset) => setQuery((q) => ({ ...q, offset }))}
              />
              <JobDetailsPanel
                job={job}
                loading={detailLoading}
                error={detailError}
                onBack={() => setSelectedId(null)}
              />
            </div>
          )
        )}
      </main>
      <footer>
        Job Radar{" "}
        <span>
          Saved listings may change. Check the original posting for current
          details.
        </span>
      </footer>
    </>
  );
}
