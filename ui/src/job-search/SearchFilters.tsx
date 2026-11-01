import { useState, type FormEvent } from "react";

export function SearchFilters({
  onSearch,
}: {
  onSearch: (keywords: string, source: string) => void;
}) {
  const [keywords, setKeywords] = useState("");
  const [source, setSource] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(keywords.trim(), source);
  }
  return (
    <form className="search-form" onSubmit={submit}>
      <label className="keyword-field">
        Keywords
        <input
          type="search"
          value={keywords}
          maxLength={200}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Job title, company, or skills"
        />
      </label>
      <label>
        Source
        <select
          aria-label="Source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">All sources</option>
          <option value="indeed">Indeed</option>
          <option value="linkedin">LinkedIn</option>
        </select>
      </label>
      <button className="primary" type="submit">
        Search saved jobs <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
