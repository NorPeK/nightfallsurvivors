# Save compatibility and recovery

Profile schema: **2**. Browser storage key remains `norpek-nightfall-save-v1` to preserve existing installations. Snapshot schema and content compatibility are checked independently by the simulation.

Version 0.4.0 uses **engine snapshot schema 3** inside the unchanged version-1 active-run wrapper. It enforces one live evolution, keeps the first earned evolution (inventory order is the fallback), and returns any other evolved weapons to their ordinary maximum rank. Historical achievement/evolution credit is preserved. The XP bar retains its fractional completion against the new XP curve; existing equipment ranks are not rewound.

Engine-v1/v2 migration rescales live main/mini health to current definitions while preserving the remaining percentage. Ordinary enemies already alive keep their birth-time health; new spawns use the stronger curve. Oversized legacy player projectiles and queued player casts are retired, while hostile delayed actions remain. Offered/active rituals migrate to the new target with proportional kill progress. Engine-v1 also skips newly introduced encounters whose times have passed without inventing rewards. Stacked consumables/chests treat legacy zero-valued records as one item. New snapshots retain enemy attack timers and validate the single-evolution limit. Permanent currency/ranks remain unchanged.

## Permanent progress

A run has a unique ID and a cumulative gold ledger. A checkpoint credits only the increase over the already credited total. Defeat, victory and deliberate ending settle the same run once. Starting another hunt records an interrupted attempt from its last durable counters. Fractional gold is kept internally; UI displays whole gold. Shop purchases deduct the actual rank price and store that paid price so refunds are exact. Migrated rank purchases use the historical pricing table.

Profiles include settings, capped ranks, bounded recent-run history, hunter mastery, achievements/discoveries, and an optional active-run snapshot. Save payloads have a stricter internal bound than YouTube's cloud-save ceiling. The final unload save is not relied upon: material progress checkpoints occur during play.

## Loading, failures and recovery

- Missing data creates a fresh profile only after storage has been read successfully.
- Invalid financial data, malformed JSON and unsupported future schemas stop loading; they do not silently reset gold or ranks.
- A failed cloud load keeps saving locked. Retry loading before starting.
- Browser saves preserve a previous copy. A valid backup is offered for explicit recovery when the primary was read but malformed. Recovery verifies the primary has not changed and preserves the backup even if the replacement write fails.
- A future-version profile never offers an older backup as an automatic downgrade route.
- Failed writes remain visible as pending. Retry saves after the problem is resolved; do not clear storage as a routine troubleshooting step.
- An incompatible run checkpoint does not invalidate permanent progress. End the saved attempt and start another hunt if it cannot resume.

## Concurrency and platform boundaries

One active writer/run per profile is supported. Ordered writes and revision checks prevent an older queued state replacing newer progress in the same page. Browser read-before-write checks detect another tab changing the key; cloud checks are best effort because the SDK provides no compare-and-swap transaction. Simultaneous offline play on two devices is not supported and is not merged.

Website and YouTube saves are separate. The Playables target never falls back to browser storage. The official SDK outside YouTube does not provide durable cloud persistence; preview data lasts only for the current page and is labeled accordingly.

## Rollback procedure

1. Retain the candidate ZIP/manifest and deployed source revision together. Record save schema/content version with the release.
2. Before release, test existing profile migration and representative active snapshots on the new version.
3. If a release must be withdrawn, prefer rolling forward with a fix that understands profile schema 2 and engine snapshot schema 3. Versions before 0.4.0 do not understand the current active-run rules and stacked pickup semantics and should not overwrite a 0.4.0 profile unchecked. The original version-1 implementation is not a safe blind rollback either.
4. A rollback build must preserve schema-2 permanent fields, reward ledger and paid costs, and explicitly discard only incompatible run state after explanation. Never deploy a migration that resets currency or converts a failed load into a new profile.
5. Re-run save, settlement, interrupted-run and failure tests against the exact rollback candidate before release.
