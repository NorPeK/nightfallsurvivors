# Save and lifecycle recovery audit — September 29, 2026

This audit covers the profile repository, browser/Playables storage adapter, settings and audio failure boundaries. It also supplies an isolated browser recovery lab for the generated standalone artifact. The lab is developer tooling, not a fault mode in a production game bundle. No real player profile was reset or modified by these tests.

## Corrections and evidence

| Finding | Correction | Regression evidence |
| --- | --- | --- |
| A browser/platform conflict raised between the repository's read and write did not change repository status to `conflict`. A later reload could return the old cached profile. Coalesced callers could receive a generic error, concealing the reload action in the UI. | Promote storage-level `SaveConflictError` to repository conflict state. Preserve the same conflict type for queued/new callers until explicit loading reads the external profile. | A controlled write race replaces progress with 999 gold, rejects both the initial and latest queued callers as conflicts, refuses another stale save and reloads 999 gold. |
| A cloud write can commit and then reject because its acknowledgement is lost. The next queued revision treated the repository's own prior committed payload as another writer and stopped. | Remember only the exact uncertain attempted payload. A later read may reconcile that payload before saving its descendant; unrelated data and external deletion still cause a conflict. The same rule covers the dedicated pause checkpoint. | Before correction, the lost-acknowledgement test failed with `SaveConflictError`. It now persists the newer settings, clears the pending failure and passes `flush()`. Separate tests cover pause-checkpoint acknowledgement loss and externally deleted progress. |
| A malformed `activeRun.savedAt` caused valid permanent currency/ranks to fail loading. | Reject only that snapshot and preserve the permanent profile and reward ledger, with the existing incompatible-run notice. | Negative, fractional, unsafe, null and string timestamps load the profile's 321 gold and discard only active run state. |
| An unreadable primary could display a backup option even though recovery correctly refused to overwrite an unread primary. | Offer backup recovery only after the primary was successfully read and found invalid. | A failed primary read exposes no backup action and permits no recovery write. Existing corrupt-primary/future-schema/quota/conflict recovery tests remain in the suite. |
| A late SDK load could reopen saving after disposal or after a newer load failed. A completed old write could update a newly initialized session's local baseline. | Use a lifecycle generation for asynchronous completion/callback ownership and a load sequence for overlapping reads. Stale completions reject without reopening saving or mutating the new session. In-flight SDK requests themselves cannot be cancelled. | All three new lifecycle tests failed before correction. Late loads/writes now reject; a newer failed read keeps saving locked. |
| An SDK unsubscribe throwing during disposal could stop all remaining cleanup and leave suspended requests waiting indefinitely. Reinitialization retained the paused state. | Invalidate old callbacks first; reject waiters, reset lifecycle/readiness/suspension state and attempt every unsubscribe independently. | A deliberately broken unsubscribe no longer prevents the other handlers from detaching, pending work rejects, a new session loads normally, and a retained old pause callback is inert. |
| An optional SDK health logger throwing could interrupt the actual game error/recovery handler. | Treat reporting as best effort and preserve the existing no-report-during-suspension gate. | A throwing diagnostic transport does not escape `reportError()` and is not called while paused. |

The audit also independently reproduced an engine snapshot issue and handed it to the engine owner: a syntactically valid level-up draft could offer a new seventh weapon despite six occupied slots; restoration and selection produced seven weapons. The engine owns semantic equipment/draft/evolution validation and its regression tests. This document does not substitute profile-envelope validation for engine-state validation.

The existing SDK pause design remains: ordinary storage requests wait for resume; an idle, loaded repository may issue one explicit pause-boundary checkpoint without a new read. Busy repositories coalesce the latest state until resume. Repeated pause callbacks do not create repeated checkpoint windows. A final app exit or an unacknowledged/in-flight save remains best effort, so material progress is checkpointed during play.

No audio or settings implementation change was required by this pass. Existing audio tests still check platform mute precedence, queued-tone/music cancellation, independent volume limits and voice cleanup. Subjective sound quality and real operating-system audio interruptions require device listening tests.

## Isolated browser recovery lab

Build the intended standalone first, then run:

```sh
npm run build:standalone
node --import tsx scripts/recovery-lab.mts
```

An optional `--html /absolute/path/game.html` selects another generated standalone. The server prints its random `http://127.0.0.1:PORT` address and the SHA-256 of the source artifact. Open that address, choose a fixture and use **Open prepared game in a new tab**. Keep the separate setup tab open for live fault controls and save inspection. Close existing lab game tabs before seeding a different fixture. Stop the server with Ctrl-C.

Isolation guarantees:

- Bind only to loopback on an operating-system-assigned port. Every process also has an independent random storage namespace, so even a reused port does not read earlier lab data or ordinary save keys.
- Read the generated HTML once and serve an in-memory copy. Do not modify the source HTML or add fault branches to game source.
- Inject a small storage adapter before the game script. It redirects the normal save/backup keys into the lab namespace. Faults are explicit local `SecurityError`/`QuotaExceededError` exceptions; no external service or fake production SDK is used.
- Serve only the setup page, copied game and adapter. Reject other paths and non-GET/HEAD methods. Use `connect-src 'none'`, local/inline scripts/styles and no external fonts or assets.
- The separate setup tab changes faults or simulates another writer while the game stays open. Switch back to use the game's actual Retry action without reloading. Setup-page inspection bypasses the injected storage fault.

An initial in-game controls panel was removed after it covered a narrow-screen recovery action during browser testing. The lab now injects only the storage adapter and a document marker; it adds no controls, styles or layout to the game. Switching between the setup/game tabs also exercises ordinary browser visibility suspension. This remains a controlled persistence fixture rather than an official SDK-host test.

| Fixture | Expected browser exercise |
| --- | --- |
| Valid current profile | Load 1,000 gold; make a normal setting/purchase change and inspect the durable profile. |
| Corrupt primary + valid backup | Show a load error and explicit backup recovery. Recover 1,234 gold plus one paid Might rank, then inspect the primary/backup. |
| Future profile + older backup | Explain version incompatibility; do not offer the old backup as a downgrade or erase the 4,321-gold future payload. |
| Blocked load + valid primary | Show loading failure with Retry, without offering an unusable backup. Allow storage in the separate setup tab, then return to use the game's Retry action; recover the original 1,000 gold. |
| Blocked save + valid primary | Change a setting or buy an affordable rank; show unsaved progress without claiming success. Allow writes in the setup tab and return to use Retry save without reloading; confirm the intended new state persists. |
| Corrupt primary + blocked recovery write | Recovery fails visibly while the original corrupt primary and valid backup remain. Allow writes and retry the game's explicit backup recovery; restore 1,234 gold and the rank. |
| Simulated other writer | While the game remains loaded, use the separate setup tab to write an independent current profile containing 2,222 gold. Return and trigger a game save; require conflict/reload behavior. Explicit reload should use 2,222 gold rather than overwrite it with stale local state. |

## Verification and limits

Focused command:

```sh
node --import tsx --test tests/save.test.ts tests/platform.test.ts tests/audio.test.ts tests/recovery-lab.test.ts
```

Final focused result: **56 tests passed, 0 failed, 0 skipped** (34 save, 16 platform, 4 audio, 2 recovery-lab tests). Owned-file ESLint passes. The first aggregate TypeScript check identified an unrelated renderer test fixture using an obsolete `cd` field; its owner corrected that fixture. Final aggregate typecheck/build checks belong to the candidate verification pass.

The two recovery-lab regressions test the real served adapter using loopback HTTP and a controlled browser-storage/DOM boundary: source HTML unchanged, adapter-before-game order, CSP/network restrictions, fixture creation, failures/retries/conflict mutation and untouched ordinary profile keys. They do not claim a real browser walkthrough. Browser observations from the parent task belong in the dated candidate verification record; this audit agent did not operate the browser.

Limitations remain explicit: no actual YouTube portal/cloud outage test, no concurrent offline-device merge or cloud compare-and-swap, no guarantee that an already-sent request can be cancelled, and no guarantee of a final save after the host kills the process. Physical Android/iPhone interruptions and the full release matrix are still separate evidence requirements.
