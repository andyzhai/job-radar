# Job Radar

Collect jobs manually from some job boards or websites of companies    , then search the saved listings in a local browser app. Collection and search run independently: closing the collector does not remove jobs or stop the search app.

## Requirements and setup

Windows and Node.js 24.20 or later in the Node 24 release line are required. Google Chrome is the default browser; CloakBrowser can be selected after its setup below.

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

This opens the browser selected by `browser` in `job-radar-settings.json`, or its override in `job-radar-settings.local.json`. Accepted values are `chrome` (the default, including when omitted) and `cloakbrowser`. All three commands—`profile`, `inspect`, and `collect`—use that selection. A failure stops the command; it never automatically switches browser.

Each browser has its own persistent bot profile, shared by its Indeed and LinkedIn sessions:

| Browser | Setting | Default directory |
|---|---|---|
| Chrome | `chromeProfilePath` | `%LOCALAPPDATA%\WebBot\Chrome\User Data` |
| CloakBrowser | `cloakBrowserProfilePath` | `%LOCALAPPDATA%\WebBot\CloakBrowser\User Data` |

Existing Chrome profiles and local `chromeProfilePath` overrides are preserved. Sign in manually using dedicated accounts in each browser. Switching back restores that browser's saved session; passwords, cookies, and profiles are not copied between browsers or from normal Chrome.

The profile command stays running until its browser closes. Close the bot windows before inspection or collection. Your normal Chrome can remain open. To reopen the configured Indeed search for manual verification:

```powershell
npm run profile -- indeed
```

The launcher refuses the normal Chrome user-data directory, its parents and child profiles, and overlapping bot profile paths (including junction aliases). Browser isolation separates local cookies and sessions; it does not guarantee that a website will permit automation or avoid account restrictions. Login and verification prompts require manual attention.

### Select CloakBrowser

Install its binary and configure a license once:

```powershell
npx cloakbrowser login
npx cloakbrowser install
npx cloakbrowser info
```

Current CloakBrowser requires a free or paid license key. Its CLI saves the key outside this repository; alternatively set `CLOAKBROWSER_LICENSE_KEY`. Never add keys to project settings or Git. The binary download is separate from `npm ci`. See the [official CloakBrowser setup documentation](https://github.com/CloakHQ/CloakBrowser/blob/main/js/README.md).

Add or merge this field into `job-radar-settings.local.json`:

```json
{
  "browser": "cloakbrowser"
}
```

Then run `npm run profile` to sign in. Set `browser` back to `chrome` to switch back on the next command. Chrome does not load CloakBrowser or require its key/binary. When CloakBrowser is selected, missing credentials or a missing binary produces setup instructions instead of a signup prompt during collection. CloakBrowser otherwise manages its own binary updates; `CLOAKBROWSER_AUTO_UPDATE=false` disables its automatic update checks.

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

Only one collector may use a database at a time, even with different browser selections. A lock beside the database is acquired before browser startup and interrupted-run recovery, refreshed while running, and released on exit. After a forced termination, a stale lock can be recovered after one minute. Do not remove an active collector's lock manually. Inspection and manual login still require the selected browser profile to be free.

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

Runs TypeScript checks, collector/storage/API tests, a production build and a desktop/mobile UI test. Browser tests default to Chrome independently of local application settings. They use temporary profiles and fixture data, check persistence and busy-profile handling, and never sign into job boards or use the bot profile. Tests run serially so CloakBrowser's normal test launches do not compete for license sessions.

After setting up CloakBrowser, run the same checks against it without changing application configuration:

```powershell
$env:JOB_RADAR_TEST_BROWSER = "cloakbrowser"
npm run check
Remove-Item Env:JOB_RADAR_TEST_BROWSER
```

The busy-profile test deliberately attempts a second launch and verifies that it fails without disturbing the first session. Live job-board collection must be verified separately.

Scheduling, LinkedIn collection, richer filters and company sources are future work.
