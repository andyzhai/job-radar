# Job Radar

Collect jobs manually from some job boards or websites of companies    , then search the saved listings in a local browser app. Collection and search run independently: closing the collector does not remove jobs or stop the search app.

## Requirements and setup

Windows, Google Chrome, and Node.js 24.20 or later in the Node 24 release line are required.

```powershell
npm ci
npm run db:init
npm run build
npm start
```

Open **http://127.0.0.1:3210**. The server listens only on this computer. Its API reads SQLite; only the collector initializes and      the database.

Use `npm run profile -- app` to open the local app in the dedicated bot browser. Original-posting links then stay in that browser profile too.

## Dedicated bot browser

```powershell
npm run profile
```

This opens a separate Chrome user-data directory at `%LOCALAPPDATA%\WebBot\Chrome\User Data`, shared by the bot's Indeed and LinkedIn sessions. Sign in manually using your dedicated accounts. No passwords or cookies are copied from normal Chrome. The directory persists across runs and can be reused by other web bots, one browser process at a time.

Close the bot Chrome windows before inspection or collection. Your normal Chrome can remain open. To reopen the configured Indeed search for manual verification:

```powershell
npm run profile -- indeed
```

The launcher refuses the normal Chrome user-data directory or its child profiles. Browser isolation separates local cookies and sessions; it does not guarantee that a website will permit automation or avoid account restrictions. Login and verification prompts require manual attention.

## Collect and search

Edit [`collector/config/searches.json`](collector/config/searches.json) for the keywords, location, lookback, page cap and delay. The initial search is Software Developer in Toronto, ON, with a 30-day lookback and a three-page cap.

```powershell
npm run inspect -- indeed
npm run collect
# A smaller run:
npm run collect -- --max-pages 1
```

The inspector opens the same bot profile. Press Enter in its terminal to save a local page capture and close it. `npm run inspect -- indeed --capture` captures automatically. LinkedIn can be opened for inspection; its collector is not implemented yet.

Collection prints a per-search result. Exit code `0` means the accessible search/window ended successfully, `2` means partial coverage, and `1` means blocked or failed. A page cap, repeated page or missing required detail leaves progress unchanged. A later run starts from the previous successful window with overlap. Repeated jobs update the same source record; previously saved descriptions remain available if a later detail read fails.

Indeed's inspected layout does not expose posting dates on its cards. Such jobs retain an unknown posting date and remain in scope; a lookback cannot prove their publication date. Date sorting is selected, but early chronological cutoff is disabled until reliable source dates/order are established. A capped run is not complete coverage of the date window or platform.

In the UI, keyword terms combine with AND across title, company and description. Punctuation is literal. Source links open the original posting. Posting dates and collection/detail timestamps are distinct. Search does not trigger collection or apply for jobs.

## Project map

| Folder | Responsibility |
|---|---|
| [`collector/`](collector/) | Open the bot browser, inspect sources, collect, map and save |
| [`server/`](server/) | Read-only local job API and built UI hosting |
| [`ui/`](ui/) | Keyword/source search, paginated results and details |

[`job-radar-settings.json`](job-radar-settings.json) defines the shared paths, timezone and port. Optional `job-radar-settings.local.json` overrides those settings and is ignored. Relative paths resolve from the project root even when commands run from another directory. Keep profiles, database files and page captures out of version control; `runtime/` and local settings are ignored and never served by the app.

## Verification

```powershell
npm run check
```

Runs TypeScript checks, collector/storage/API tests, a production build and a desktop/mobile Chrome UI test using a temporary fixture database and a separate temporary browser. Tests never sign into job boards or use the bot profile. Live collection must be verified separately.

Scheduling, LinkedIn collection, richer filters and company sources are future work.
