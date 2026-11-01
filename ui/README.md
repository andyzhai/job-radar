# Saved-job search

Build with `npm run build` and serve with `npm start` from the project root. The UI reads the local API; it never opens or controls the collector.

`src/job-search/` holds the search form and result list. `src/job-details/` shows stored descriptions and source links. `src/api/jobs-api.ts` is the HTTP boundary. `src/styles/` holds the responsive layout.

Desktop shows results and details together. Narrow screens show the selected detail with a back button. Unknown values, loading, no matches and server errors have explicit states. Job text is rendered as text, and links must use HTTP(S).

`npm run test:ui` tests the production build in isolated headless Chrome with a temporary database, including pagination, source/keyword search, detail display, mobile navigation and error recovery.
