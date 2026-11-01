# Collector

The collector runs independently of the search server. Start with `npm run profile` for manual account setup, `npm run inspect -- indeed` for page inspection, then `npm run collect` to save results.

Trace the code in this order:

1. `commands/`: manual entry points.
2. `browser/open-persistent-chrome.ts`: dedicated persistent Chrome, never normal Chrome.
3. `sources/indeed/`: observed page selectors, navigation, and field mapping.
4. `collection/`: configured searches, date windows, stop conditions and outcomes.
5. `storage/`: page transactions, source-key upserts, run results and completed checkpoints.

Edit `config/searches.json` for searches and bounded page/delay settings. Optional absent fields stay unknown. The source reads visible results and inline descriptions; it does not submit applications, save jobs on Indeed, or follow apply buttons.

Unexpected login/challenge pages stop the run. Open `npm run profile -- indeed` for manual attention and close it before retrying. A busy profile produces an error; no alternative profile is silently created.

Inspection captures go to the ignored capture directory. They can contain private page content and must not be committed. Source investigation notes and verification evidence belong in the paired private engineering repository.
