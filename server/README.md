# Local search API

`npm start` serves the built UI and a read-only API on `127.0.0.1:3210`. Run `npm run build` first. The database is configured in the root settings; initialize it using `npm run db:init` or collect jobs.

| Endpoint | Behavior |
|---|---|
| `GET /api/health` | Database readiness and schema version |
| `GET /api/jobs` | `{ items, total, limit, offset }` |
| `GET /api/jobs/:id` | Saved job details, source URLs and observation timestamps |

List parameters: `keywords` (up to 200 characters), repeated `source` values, `limit` (1–100, default 25), `offset` (0–1,000,000). Keywords use case-insensitive literal substring matching for each whitespace-separated term, combined with AND. Source selections use OR, combined with keywords using AND. Results sort by posting date descending, unknown dates last, then first-seen timestamp and ID descending.

Unknown/invalid filters return 400, missing jobs 404, unsupported methods 405 and an absent/incompatible database 503. The server never creates a database or starts collection. Descriptions are plain text. `first_seen_at`, `last_seen_at` and `details_collected_at` distinguish summary observation from successful detail collection.
