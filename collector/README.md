# Collector

The collector runs independently of the search server. Start with `npm run profile` for manual account setup, `npm run inspect -- indeed` for page inspection, then `npm run collect` to save results.

Trace the code in this order:

1. `commands/`: manual entry points.
2. `browser/open-persistent-browser.ts`: the configured browser (`chrome` by default, or `cloakbrowser`), using separate dedicated persistent profiles.
3. `sources/indeed/`: observed page selectors, navigation, and field mapping.
4. `collection/`: configured searches, date windows, stop conditions and outcomes.
5. `storage/`: page transactions, source-key upserts, run results and completed checkpoints.

Edit `config/searches.json` for searches and bounded page/delay settings. Optional absent fields stay unknown. The source reads visible results and inline descriptions; it does not submit applications, save jobs on Indeed, or follow apply buttons.

Unexpected login/challenge pages stop the run. Open `npm run profile -- indeed` for manual attention and close it before retrying. A busy profile produces an error; no alternative profile is silently created.

Set `browser` in the shared settings or local override to switch browsers on the next command. `profile`, `inspect`, and `collect` all use the same selection. The profile command remains attached until the browser closes. CloakBrowser needs its own initial manual sign-in and the license/binary setup described in the root README. Existing Chrome sessions are preserved; a launch failure never selects the other browser.

`collection/collector-lock.ts` prevents two collectors from using one database across browser choices. It acquires a database-scoped lock before browser startup and interrupted-run recovery, releases it on completion/failure, and recovers locks left stale for one minute after a crash.

Inspection captures go to the ignored capture directory. They can contain private page content and must not be committed. Source investigation notes and verification evidence belong in the paired private engineering repository.
