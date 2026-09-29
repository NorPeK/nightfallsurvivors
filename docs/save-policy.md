# Save compatibility and recovery

Profile schema: **2**. Browser storage key remains `norpek-nightfall-save-v1` to preserve existing installations. Snapshot schema and content compatibility are checked independently by the simulation.

Version 0.5.0 uses **engine snapshot schema 4** inside the unchanged version-1 active-run wrapper. Each hunt captures its evolution capacity at start: one slot by default, plus one per permanent Evolutions rank, up to six. Later purchases apply to the next hunt; resumed version-4 hunts keep their captured capacity. Snapshots validate that evolved weapons fit that capacity.

Engine-v3 migration adds the legacy default of **one slot** to the saved stats and passive base. It preserves HP, XP, equipment, projectiles and pending attacks without repeating the older balance migration. An older permanent profile with no Evolutions rank remains rank 0 and supplies one slot to a new hunt.

Engine-v1/v2 migration retains the 0.4.0 compatibility rules before recording one slot: keep the first earned evolution (inventory order is the fallback), return others to ordinary maximum rank, preserve historical evolution credit, and retain the XP bar's fractional completion against the newer curve. Live main/mini health keeps its remaining percentage; ordinary enemies already alive keep their birth-time health. Oversized legacy player projectiles and queued player casts are retired, while hostile delayed actions remain. Offered/active rituals retain proportional progress against the newer target. Engine-v1 also skips newly introduced encounters whose times have passed without inventing rewards. Stacked legacy zero-valued consumables/chests count as one item. Permanent currency/ranks remain unchanged.

## Permanent progress

A run has a unique ID and a cumulative gold ledger. A checkpoint credits only the increase over the already credited total. Defeat, victory and deliberate ending settle the same run once. Starting another hunt records an interrupted attempt from its last durable counters. Fractional gold is kept internally; UI displays whole gold. Shop purchases deduct the actual rank price and store that paid price so refunds are exact. Migrated rank purchases use the historical pricing table. Evolutions ranks cost 1,000, 2,000, 4,000, 8,000 and 16,000 gold; their recorded paid prices persist and are refunded exactly. Refunds are blocked during an unfinished hunt; afterward, refunding the shop restores the default one-slot capacity for future hunts.

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
3. If a release must be withdrawn, prefer rolling forward with a fix that understands profile schema 2, engine snapshot schema 4 and the Evolutions shop entry. Older catalogs can discard the new rank and its paid costs despite the unchanged profile schema, so do not let an older build write current profiles unchecked. Versions before 0.4.0 also lack the current balance migration and stacked pickup semantics.
4. A rollback build must preserve schema-2 permanent fields, including Evolutions ranks and paid costs, and the reward ledger. It may explicitly discard only incompatible run state after explanation; it must not silently lower a saved hunt’s capacity or erase purchased ranks. Never deploy a migration that resets currency or converts a failed load into a new profile.
5. Re-run save, settlement, interrupted-run and failure tests against the exact rollback candidate before release.
