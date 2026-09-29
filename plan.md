# NORPEK: Nightfall Survivors — whole-game upgrade plan

Prepared September 27, 2026. Execution authorized September 28, 2026. This is now the living design, implementation and verification record. Baseline audit observations below describe the pre-upgrade source; use the execution ledger for current status.

Reading guide: the September 29 follow-up is the latest candidate record. The September 28 ledger maps every original section and issue to its implementation or explicit deferral; its measurements are historical. Sections 1–22 preserve the original audit, design hypotheses and proposed roadmap. Their words “current,” “proposed” and “next” refer to the September 27 baseline. Use the latest audit and [release checklist](docs/release-checklist.md) for work still required.

## Follow-up audit — September 29, 2026

Candidate **0.2.1 is built and locally verified**. All 126 regular regressions pass; the separate assisted long Classic fixture also passed after the engine fixes. Typecheck, lint, website/standalone/Playables builds and archive validation pass. A fresh independent `npm ci` reproduces both bundles byte for byte, including an alternate-time-zone ZIP rebuild. The original F01–F27 corrections remain in place; this deeper audit identified and corrected the additional interactions below. Nothing has been deployed or submitted, and this is not a claim of perfection or YouTube certification.

| Follow-up area | Implemented correction / evidence |
| --- | --- |
| Combat and progression | Boss XP applies Growth once; weaker slows cannot thaw or extend freeze; swept projectiles resolve the nearest surface, including bosses; Fireballs explode at impact; Void Sphere displacement remains within spatial query bounds; Hunter’s Oath applies to bosses. Saved/live drafts enforce six slots, exact next rank and evolution readiness. **50 engine regressions pass.** |
| Persistence and lifecycle | Every coalesced caller sees a write conflict; an acknowledged-by-data but failed-by-transport write can reconcile safely; malformed run timestamps preserve permanent progress. Unreadable primaries cannot authorize backup replacement. Stale SDK completions/callbacks cannot reopen saving or mutate a later session; cleanup continues through failing unsubscribe/log handlers. |
| Controls and accessibility | Playables leaves Escape to the host; browser shortcuts/composition do not move the hunter. Resize releases movement. Focus includes recovery actions, background controls are inert behind decisions/suspension, mandatory error recovery cannot be dismissed with P, and save-error height reserves room above footer actions. Numeric checks cover 39 active CSS text families; full assistive-technology certification is not claimed. |
| Visual comfort | Reduced motion/flash settings suppress additional decorative pulses and bright fills while preserving danger geometry. An actual dense canvas capture exposed opaque hit-flash clutter; final flashes blend at 28% over normal/frozen sprites and the hunter locator has a dark backing. Final captured pixels are in the dated verification; subjective phone readability remains open. |
| Balance evidence | **24 distinct legal-build bot cases: 22 wins, 2 defeats, no horizon timeouts.** Every win delivered 14 elites, 7 swarms and all 3 bosses. Reaper seed 2 died at 0:21 fresh and 0:43 partial; winning levels 183–213 flag surplus-draft pacing. These become human playtest targets, not reasons for speculative stat changes. The raw budget interruption and bounded completion are retained. |
| Performance evidence | Bounded Node simulation CPU/memory diagnostics cover early, dense and finale scenes. A final QA browser burst recorded 227 frame intervals at 1280×720; it is explicitly too short and artificial to certify sustained/mobile performance. Rolling diagnostics and real-canvas capture exist only in the separate QA build. |
| Failure/recovery browser evidence | Isolated corrupt-backup, blocked-load/write, future-schema and external-writer flows were exercised. The final standalone was retested at 320×568: buy Might 1,000→850, observe save failure, click Retry after restoring writes, reload to durable 850 gold. No real profiles were used for destructive fixtures. |
| Delivery and phone handoff | Added a read-only preview server with traversal/symlink containment, a separate QA artifact and isolated recovery lab. `npm run preview:mobile` prepares same-Wi-Fi testing; [the phone guide](docs/phone-playtest.md) includes result cards. Listing metadata now proposes “Nightfall Survivors” in accordance with the public no-branding metadata rule; exact portal assets remain pending. |

Latest evidence: [verification and artifact hashes](docs/verification-2026-09-29.md), [engine/balance/CPU audit](docs/balance-audit-sept29.md), [save audit](docs/save-recovery-audit-2026-09-29.md), [UI/contrast audit](docs/ui-audit-2026-09-29.md), [independent reproduction](docs/reproducibility-2026-09-29.md). Final ZIP: **130,201 bytes**, 5 files / **412,928 bytes uncompressed**, SHA-256 `9e944a8e30d39b12ecaf9087db2b72666afaeac212cea4668e9f8e70b14ab8c6`. Standalone: **409,725 bytes**.

### Next release gates — still open

1. **Human balance:** natural fresh/partial/full runs, especially Reaper's first minute and late surplus-draft frequency; alternative builds, boss escape routes, Covenant optionality and economy pacing. No blanket buff/nerf was made from one bot's two seeds.
2. **Android and iPhone:** use the prepared guide, record exact models/OS/browser, verify touch/rotation/interruption/audio/durable saves, then complete full-run heat/frame-time and repeated-session checks. The owner has both devices; no physical results are recorded yet.
3. **Remaining local matrix:** broader final-build keyboard/mouse/zoom/assistive-technology coverage, listening and sustained profiling, plus direct-file standalone opening. Selected checks passed; intermittent browser-control connection timeouts limited the final expanded viewport recheck and are not logged as game passes or game crashes.
4. **Official YouTube:** owner currently has no portal access. Onboarding, Dev Link/test suite, real SDK cloud/lifecycle/mute, metadata dimensions and rights details remain required. No upload or deployment has occurred.

Optional content deferrals in the original ledger are unchanged. Hardware and portal evidence cannot be replaced by source tests; this plan keeps those gates open rather than marking all 22 areas release-complete.

## Execution ledger — September 28, 2026

Status: **upgraded local candidate; automated verification passed and selected browser flows verified on September 28, 2026**. Combat corrections, the selected gameplay/features, persistence, UI, accessibility controls, platform adapter and packaging are implemented. The normal suite passes 100 tests; the optional assisted long-run fixture also passes separately. Typecheck, lint, all three builds and archive validation pass. Detailed artifact measurements and the exact scope of browser observations are recorded below. Human balance, the complete UI/failure matrix, physical devices and official YouTube verification remain open gates. Earlier measurements in the historical body are not current artifact measurements.

### Disposition of all 22 sections

“Implemented” below describes source behavior and the named regression coverage. It does not turn an unperformed release gate into a pass. “Deferred” identifies a proposal not included in this candidate, including later ideas the original plan explicitly left optional.

| Section | Current implementation / decision | Evidence and remaining gate |
| --- | --- | --- |
| 1. Direction and scope | Preserved thirty-minute Classic, four hunters, eight weapons/evolutions, existing owned content, English, Canvas 2D, website and standalone. Added the selected trait/Covenant/progression slice. No service accounts, advertisements, external analytics, upload or deployment. | Source and package entry points reflect these boundaries. The final fight may continue after 30:00. Release is a separate decision. |
| 2. Audit and evidence | Baseline retained; focused engine, input, rendering, profile, platform, audio, content and package tests added. Independent reviews found additional snapshot/lifecycle faults and prompted corrections listed below. | Final typecheck/lint pass; 100 normal tests and the separate assisted long fixture pass. All three builds and archive validation pass, with clean-install and alternate-time-zone ZIP reproducibility. Browser observations below have explicitly limited scope. |
| 3. Quantitative baseline | Smoothed XP milestone steps; fixed reward arithmetic, weapon formulas and control effects. Kept the original shop prices and authored enemy scaling as the starting economy/difficulty baseline. | Current formulas live in `data.ts`; `scripts/measure-weapons.ts` and `scripts/simulate-balance.ts` provide local diagnostics. Historical XP jumps and artifact sizes below describe the original version. Actual first-purchase/evolution timing needs human runs. |
| 4. Correctness backlog | All F01–F27 have implementation changes; the issue-by-issue evidence ledger follows. | Most have direct regression fixtures. Responsive usability, perceived combat fairness, interruption behavior on devices and official platform operation still need their respective gates. |
| 5. Movement, camera and feel | Normalized keyboard/pointer movement, pointer capture/cancellation, input reset, fixed/floating handed joystick, continuous last-movement sword direction, logical viewport scaling and offscreen spawn checks. | Input, viewport, spawn, sword and telegraph fixtures. No dash/active dodge added. Threat reaction time and touch occlusion remain human/device checks. |
| 6. Weapons, passives and builds | Corrected distinct-target piercing, independent contact cooldowns, Frost duration/control gap, Fire radius/evolution geometry and evolved Bow boss splash. Added weapon upgrade detail, recipe readiness, explicit evolution choice, three rerolls/two skips/one banish per run. Six weapon/passive slots remain. | Combat/draft/evolution fixtures and damage probes. Pairing weights remain; a new guaranteed useful early draft is not claimed. Full role balance, every combined build and tighter slot experiments remain measurement work. |
| 7. Hunter identity and mastery | Four bounded passive traits implemented and described in selection/build UI; last hunter remembered. Local hunter mastery, achievements, discoveries and recent results record progress without locking existing content. | Trait and profile fixtures verify triggers and persistence. Cosmetic mastery unlocks, portraits, lore progression and alternate starting loadouts are deferred. Each hunter still needs a demonstrated human fresh-save win route. |
| 8. Enemy ecology and difficulty | Preserved authored waves and enemy catalog; corrected freeze/drift, contact geometry, delayed attacks and finale scaling. Smoothed XP, added one optional mid-run encounter and an authored event admission budget: pending elites/swarms wait during bosses/rituals and have 12-second spacing. Bosses retain priority at their authored minute; dawn stops the backlog. | Deterministic overlap, saturation, recovery and restored-director fixtures support mechanics. New ranged/support AI and a complete enemy-composition rebalance are deferred. Full-run tension/recovery and fresh/partial/max-save fairness are open gates. |
| 9. Bosses and finale | Typed committed warnings, scheduled boss attacks invalidated on boss death, terminal victory, a visible finale duration and frozen post-30 summon scaling. At 30:00 an undefeated earlier boss is explicitly settled through its reward path before Death. | Boss ownership, telegraph, terminal and handoff fixtures. Existing boss patterns remain the foundation; a wholesale new phase catalog is not claimed. Every pattern's human escape route and boss duration remain playtest gates. |
| 10. Arena and signature feature | One optional Covenant is offered during minutes 10–14 when no boss is active: defeat 12 enemies inside a marked shrine radius within 45 seconds, then choose one of three conditional blessings. Declining is safe. | Covenant rules/terminal/snapshot fixtures and visible arena boundary. Up to three prioritized, labeled offscreen boss/ritual/elite/chest markers avoid HUD and touch controls. Geometry/purity fixtures cover orientations and priorities. Larger landmark/biome work, second arena and additional modes are deferred. Its value and optionality need human confirmation. |
| 11. Progression and persistence | Version-2 profile migration preserves the original browser key and ranks. Cumulative fractional gold is checkpointed and settled once per run; explicit end-hunt keeps earnings. Exact paid-cost refunds, backup recovery, bounded records and compatible active-run resume are implemented. Victory currently grants a fixed 250 gold. | Save/repository/engine integration tests cover malformed/future saves, failures, stale writes, refunds and replayed pickups. Cloud is one supported active writer, without cross-device merge. The victory bonus and purchase pacing are provisional balance choices. |
| 12. UI and player journey | Shared scrollable screen shells, focus handling, hunter comparison, contextual replayable onboarding, build/recipe journal, result recap, same-hunter retry, shop feedback, loading/error/recovery screens and explicit end-saved-hunt flow. | Selected Chrome portrait/landscape menu, hunt, pause, result/shop, draft/chest, build/settings, journal and reload/resume flows verified; QA evolution/Covenant/victory screens also exercised. Complete keyboard/mouse/touch and failure/recovery coverage remains on the release checklist. |
| 13. Art and readability | Kept procedural gothic art; corrected warning geometry, added player/hostile emphasis and reduced-effects controls, and created a local geometric game icon. System fonts remove external font dependency. | Render invariance/geometry fixtures and [asset register](docs/asset-register.md). A unified illustrated icon/portrait family, richer narrative animation and broad scenery redesign are deferred. Dense six-weapon readability is not yet a human-verified pass. |
| 14. Audio and music | Separate persistent music/SFX volumes, platform mute authority, cancellation of queued tones/music on suspension, voice budget and disposal behavior. Retained synthesized audio. | Audio/platform fixtures. Adaptive musical layers, soundtrack expansion and subjective clipping/fatigue evaluation are deferred or pending listening tests. |
| 15. Accessibility and comfort | Semantic/focusable UI, scoped gameplay touch handling, motion/shake/flash/effects/damage-number/contrast preferences, initial reduced-motion preference and left/right fixed/floating joystick. Essential guidance has text. | Settings/input/render fixtures and selected Chrome settings/scroll-reachability checks pass. Contrast measurement, color-vision review, zoom and complete keyboard/device audit remain gates. No full nonvisual canvas gameplay, remapping, controller support or assist mode is claimed. |
| 16. Architecture and tools | Added platform/profile/settings boundaries, fixed-step simulation scheduling, seeded gameplay RNG, stable entity IDs, validated snapshots, safe terminal paths and development-only scenario tools isolated from real saves. | State/determinism/snapshot/QA-release guards. Kept the existing engine and React shell; this is a refactor around tested seams, not a full ECS rewrite or a claim that all suggested module extraction occurred. |
| 17. Performance and stability | Retained pooling/cache/spatial foundations; corrected grid collisions, preserve critical pickups under saturation, bounded save/history payloads, coalesced persistence and suspend simulation/render/audio work. Effects controls reduce cosmetic work; paused/modal/result scenes repaint only on explicit invalidation. | Saturation, render purity, lifecycle and bounded-save fixtures. CPU/GPU percentiles, heap trend, repeated-session leak behavior, 30/60 FPS targets, thermal and battery results require actual device profiling. |
| 18. Delivery | Separate static website, fresh standalone HTML and SDK-first Playables ZIP builders; declared local dependencies, license notices, archive validator, manifest and preview server with CSP. Draft metadata, asset and save/rollback documentation added. | All three builds, package fixtures, archive validation and reproducibility checks pass. Website, Playables preview and HTTP-served standalone received selected Chrome checks. Direct-file standalone opening was blocked by browser security and remains unverified. Official SDK/cloud behavior requires portal access; none is available and no certification is claimed. |
| 19. Measurement | Local effective weapon damage, overkill, damage/healing, XP collected, gold sources, boss/evolution events and run results; deterministic weapon fixtures and legal-build bot tooling. | These are diagnostic tools, not evidence of fun or player skill. The full proposed metric catalog—such as XP left behind, cap time, modal duration and first-purchase learning studies—is not implemented as a telemetry system. No external analytics added. |
| 20. Verification | Regression matrix has executable coverage across engine, persistence, input, render, platform, audio, content and packaging. The normal suite passes 100 tests; its one optional long fixture is skipped there, then passes in a separate assisted 1,815-second simulation. | Final artifact results and selected browser flows are recorded below. Human fresh-save routes, natural full runs, the remaining UI/failure matrix, physical phones and actual YouTube tests remain open gates in [release checklist](docs/release-checklist.md). |
| 21. Roadmap | Original foundation/platform work and selected identity features are implemented together in a local candidate. Validation follows below; original phases remain historical ordering guidance. | Balance/readability/performance exit gates are not complete merely because source exists. Expansion remains outside the current release slice. |
| 22. Risks and decisions | Continuous sword direction, keep-earned-gold policy, exact refunds, compatible snapshots, four passive traits and one Covenant are the selected decisions. Classic/content/economy compatibility retained. | Remaining risks are corrected damage changing familiar builds, new trait/Covenant dominance, touch visibility and unverified device/platform behavior. Deferred decisions and next steps are explicit below. |

### F01–F27 correction and evidence ledger

The original issue descriptions and reproduction context remain in section 4. Test references here identify relevant coverage; the passing final suite and bounded browser observations are recorded below.

| ID | Current correction | Evidence / limit |
| --- | --- | --- |
| F01 | Rebuild immutable base stats for every run; reset run-owned progression/trait state. | `tests/engine.test.ts`: hunter/meta/passive reset fixture. |
| F02 | Terminal guards stop further same-step collection, chest and simulation transitions after death. | Fatal-contact plus same-frame chest fixture. |
| F03 | Victory becomes terminal immediately; engine termination and profile settlement reject repeat/stale outcomes. | Immediate victory/idempotence and cumulative settlement fixtures. |
| F04 | Simulation-time actions replace combat wall-clock callbacks; run/boss ownership cancels stale work. | Pause, retry and boss-death scheduled-action fixtures. |
| F05 | Validated versioned profiles distinguish absent, malformed, unsupported and unreadable data; failed load locks saving. | Save migration/failure/recovery and platform load-lock fixtures. |
| F06 | Preserve critical chest rewards and consolidate/defer pickups without losing XP value. | Full-pool chest and XP fixture. Other capacity/performance behavior remains subject to dense-scene profiling. |
| F07 | Checkpoint credited gold; explicit abandonment settles once and retains earnings/counters. UI reports pending save/error. | Abandon, interrupted attempt, crash-after-checkpoint and retry fixtures. App termination can still lose work after the last durable checkpoint. |
| F08 | Stable enemy IDs and projectile hit history enforce distinct-target piercing; swept overlap handles crossed targets. | Same-target, across-frame and swept-arrow fixtures. |
| F09 | Boss orb timer advances once per target step. | Unrelated projectile-count invariance fixture. |
| F10 | Orb and dagger cooldowns are independent. | Dagger/orb coexistence fixture. |
| F11 | Radius-aware broadphase, refreshed ordering and collision-free negative/distant grid keys. | Random brute-force comparison, large enemy and distant-coordinate fixtures. |
| F12 | Normalize sword angle differences and use continuous movement direction. | Outside-arc symmetry fixture; perceived aiming still needs human testing. |
| F13 | Carry resolved Frost duration into the projectile/status effect. | Selected-duration collision fixture. |
| F14 | Resolve Fire area once; evolution carries level area and displays matching warning bounds. | Fire evolution geometry fixture; damage fixtures provide tuning evidence, not final balance. |
| F15 | Freeze stops voluntary lateral drift as well as forward motion. | Frozen-wraith fixture; force/status combinations remain gameplay regression candidates. |
| F16 | Typed dash intent locks target/path and renders zero coordinates correctly. | Locked-endpoint/origin render fixture plus boss scheduled-action tests. |
| F17 | Damage-number/particle time advances in simulation; rendering does not mutate gameplay. | Repeated rendering across viewports/settings leaves snapshots unchanged. |
| F18 | Separate gameplay phase and platform suspension; stop frame/audio scheduling, preserve modals and honor platform mute. Gate ordinary cloud requests while paused. | Engine/audio/platform fixtures, including one bounded pause checkpoint. Actual app lifecycle timing remains a portal/device gate. |
| F19 | Ignore pause repeats, reset all movement state on blur/disable/cancel, share joystick displacement model. | Keyboard, pointer cancellation and disabled-control input fixtures. |
| F20 | Unified pointer movement supports mouse and touch; sword follows last movement direction. | Pointer and sword fixtures. Complete mouse-only/touch-only UI flow remains a release walkthrough. |
| F21 | Responsive scrollable shells, safe-area styling, scoped touch action and focus controls replace clipped modal/menu assumptions. | Selected 320×568 draft/chest, 390×844 menu/hunt flow and 844×390 build/settings checks pass. Full viewport/screen/input matrix still pending. |
| F22 | Central gold accounting retains fractional cumulative value. Coins, draft gold and chest gold apply Greed before entering the ledger; the current victory bonus is fixed. | Small-coin Greed and monotonic fractional ledger fixtures; display rounds separately. |
| F23 | Freeze finale summon scaling at the thirty-minute boundary; report extra finale duration. | Finale scaling fixture. Human prolonged-fight pacing remains unverified. |
| F24 | Shared logical combat viewport/camera policy; regular spawns check visible bounds. | Portrait/landscape viewport and wide/narrow offscreen-spawn fixtures. Equivalent human reaction opportunity is not established by geometry alone. |
| F25 | Declare local bundler dependencies, generate fresh CSS, isolate targets and validate ZIP structure/references/licenses. | Package fixtures, all three builds, clean-install rebuild, archive validation and alternate-time-zone ZIP identity pass. Selected artifact browser checks pass; official runtime/CSP verification and direct-file standalone testing remain open. |
| F26 | Stop on fatal frame faults, preserve last valid progress and present recovery instead of logging/repeating indefinitely. | Engine fault-path and UI source inspection; final fault-recovery walkthrough still required. |
| F27 | Explicitly settle an undefeated earlier boss through its reward path at the final handoff; invalidate its pending actions. | Finale handoff and boss-action invalidation fixtures. |

### Additional audit corrections after the original 27

- **Snapshot transactions:** progress callbacks now observe completed transactions. A reward during evolution/chest processing can no longer persist an intermediate modal state with missing options. A regression exports/imports at each progress callback.
- **Snapshot validation and deterministic restore:** reject inherited catalog keys, malformed/oversized draft or chest values, impossible Covenant modal states and invalid entity/action data before touching the live game. Preserve validated unique pool-slot indices as well as stable entity IDs, timers, RNG and queues so recycling order and future seeded combat survive restoration. Cosmetic/browser caches are excluded. Snapshot schema 1 is pre-release and independently checked from profile schema 2.
- **Gold versus older snapshots:** the profile ledger remains authoritative when a durable snapshot precedes the latest credited gold. Replaying a coin after resume does not credit it twice. Human-readable build labels are stored separately from stable weapon IDs used for discoveries.
- **Save recovery and ordering:** explicit corrupt-primary backup recovery verifies the primary has not changed; a failed recovery write cannot destroy the valid backup. Future-version profiles do not offer a destructive downgrade. One in-flight save plus one replaceable latest pending payload prevents an unbounded queue; caller promises wait for the revision that covers them. UI status ignores stale promise completions.
- **SDK initialization and loading:** partial handler registration rolls back and can retry. A failed load after a prior success closes the saving gate again. Browser empty strings remain malformed data rather than silently becoming a new player.
- **Pause/network race:** new ordinary load/save operations wait until resume; there is no unconditional asynchronous gap that lets an already-starting operation slip past a pause check. An idle, already-loaded repository may issue one explicit pause-boundary checkpoint without another load; a busy repository queues the latest state for resume. Already in-flight operations cannot be cancelled. Final app-exit persistence remains best effort; material progress is saved during play. This integration must still be verified with the real SDK host.
- **Comfort/UI:** added independent flash/pulse preference with reduced-motion precedence, explicit saved-hunt ending before refund, and an explained conflict reload flow. A later render audit removed flashing warning/enrage rims when motion or flash is disabled and stops decorative countdown-ring rotation under reduced motion while keeping the timing cue. Selected final Chrome flows and QA screen observations are recorded below; they do not establish full usability, accessibility conformance or physical touch behavior.

### Final reconciliation and packaging audit

- **Authored encounter budget:** scheduled elites and swarms remain pending during bosses and an active Covenant. At most one event enters each 12-second admission window, with recovery after a boss/ritual; a swarm waits for all 40 pool slots. Boss arrivals keep priority. The thirty-minute finale intentionally stops deferred routine events. Cooldown and delivered sets restore deterministically.
- **Offscreen guidance:** pure, steady directional badges prioritize boss, active ritual, nearest elite and nearest chest, with at most three visible at once. Labels and shapes supplement color; badges avoid the HUD, onboarding, touch controls and one another. This is covered by geometry and renderer-state tests, with human readability still pending.
- **Idle rendering:** manual pause, draft/chest/Covenant screens and results retain their battlefield without a perpetual rendering loop. Phase, settings, panel and resize changes request one redraw; playing and animated menus continue normally. Platform suspension cancels rendering and resume wakes it without dismissing the current phase.
- **Content validation:** new catalog checks cover hunter/evolution references, every weapon rank's resolved values and meaningful preview, the complete Classic wave schedule, enemy parameters and every permanent upgrade's cost/stat bounds.
- **Build reproducibility:** a clean install exposed different CSS caused by Tailwind scanning the previously generated standalone HTML. Explicit stylesheet-relative app scanning removes that artifact feedback. ZIP timestamps use a local-calendar DOS date instead of a UTC date whose bytes differ by time zone. The final clean-install and alternate-time-zone rebuilds produce the same ZIP bytes and checksum recorded below.
- **Reward wording:** Greed explicitly describes coin/treasure gold and its fixed-dawn-bonus exception; victory results disclose the actual dawn bonus.

### Final local verification — September 28, 2026

| Check | Final result and scope |
| --- | --- |
| Typecheck and lint | Both pass. |
| Normal test suite | **100 pass**: 40 engine, 29 save, 12 platform, 4 audio, 4 input, 6 render, 2 package and 3 content tests. One additional optional long-run fixture is skipped in the normal command. |
| Separate long fixture | Passes 1,815 seconds of continuously stepped, explicitly assisted Classic simulation; director exercises 14 elites, 7 swarms and 3 bosses. This verifies schedule/state continuity, not a natural human victory or balance. |
| Build targets and archive | Website, standalone and Playables builds pass; Playables archive validator passes. |
| Reproducibility | Clean `npm ci`/rebuild and alternate-time-zone rebuild produce byte-identical Playables ZIPs. |
| Playables ZIP | **128,794 bytes**, 5 files, **408,119 bytes** uncompressed. SHA-256: `751a086403dfa8897a29245331c52997deb381934bc6b8e7ea59831708821ccd`. |
| Standalone HTML | **404,916 bytes**. Selected HTTP-served flow verified; direct-file opening remains unverified because the browser blocked the attempt. No security workaround was used. |

Selected actual Chrome observations are listed precisely rather than treating one walkthrough as the entire device matrix. QA scenarios establish screen reachability and transitions; they do not prove natural progression, balance or release-only behavior.

| Target / viewport | Verified observation |
| --- | --- |
| Playables local preview, 390×844 | Menu, settings and volume sliders; Lyra hunt → pause → deliberate end → results → shop. Preview behavior does not verify durable YouTube cloud saves. |
| Playables local preview, 844×390 | Build/settings content and actions reachable by scrolling; paused timer stays frozen. |
| Playables local preview, 320×568 | Draft reroll; chest reward scrolling and Continue reachable. |
| Development QA, 1024×768 | Absolute Zero evolution selection transitions to chest rewards. |
| Development QA, 844×390 | Covenant offer accepted; ritual circle and progress HUD displayed. |
| Development QA, 1280×720 | Victory → retry resets the hunt. |
| Development QA, isolated temporary profile | Forced defeat displays recap/actions. Buying Might for 150 gold changes treasury 100,000 → 99,850 and rank 0 → 1; refund confirmation returns exactly 150 gold, restoring treasury 100,000 and rank 0. Forced defeat is a UI scenario, not a natural-death playtest. |
| Built website, HTTP port 4173 | Reload/resume restores the exact paused 00:08 checkpoint: HP 104/120, XP 2, kills 3. |
| Built standalone, HTTP port 4174 | Menu, journal and evolution recipes opened. Direct `file:` navigation was blocked by browser security; direct-file compatibility was not established. |

Open gates remain: full human runs and hunter/build fairness, complete keyboard/mouse/touch and failure/recovery UI matrix, dense-combat readability, physical Android/iPhone and performance/thermal tests, direct-file standalone compatibility, publication assets/rights, and official YouTube verification. The owner has Android and iPhone available but no physical results are recorded; the owner has no Playables portal access. See [dated verification](docs/verification-2026-09-28.md) and [release checklist](docs/release-checklist.md).

### Selected gameplay and economy decisions

The four traits are now concrete: Sentinel prepares a 40% reduction and short retaliation after four damage-free seconds; Windrunner prepares a 25% stronger next bow volley after three seconds moving; Voidcaller slows nearby foes on every fourth orb cast; Forsaken heals 2 HP on a dagger kill at most once every two seconds. These bounded mechanics and displayed text are covered by fixtures; their relative strength is still a tuning question.

The first Covenant offers Winter Oath (+20% damage to frozen enemies), Hunter’s Oath (+20% opening damage to full-health enemies), or Mercy Oath (one second of protection after food). The shrine challenge and reward conditions are explicit and tested. Further rituals are deferred until the first is useful without becoming mandatory.

XP now ramps through eight-level bands around the former level-20/40 jumps while preserving the established later multiplier. Evolved Frost has a control gap even at maximum cooldown reduction. Existing permanent prices/rank ownership remain unchanged; refunds use actual paid costs, with the historical price table for migrated purchases. The fixed 250-gold victory bonus is a candidate value, not a measured economy conclusion. Current bot/weapon results must be interpreted after all formula/trait fixes and followed by human runs.

### Deferred design work and current roadmap

The original plan expressly limited the first release and listed experiments. This candidate does not claim to implement all optional content: new arenas/hunters/weapons, ranged/support enemies, a broader adaptive encounter director beyond the implemented authored-event budget, new boss phase catalogs, extra Covenant encounters, alternative loadouts/cosmetic rewards, unified portraits/icons, adaptive music, dash, controller/remapping, assist/short/endless/boss-rush modes, seeded challenge presentation, localization/RTL, multiplayer, online rankings and accounts remain later projects. Smaller loadouts, broader shop repricing and extensive enemy-stat changes are deferred until corrected-game evidence supports them.

Work required before calling this release-ready:

1. **Complete the remaining local walkthrough matrix.** Automated tests, typecheck/lint, all builds, archive validation and reproducibility are complete with results above. Expand the selected browser observations to every screen and input mode, storage/fault/conflict recovery and remaining runtime/network/CSP checks. Verify standalone direct-file behavior in a browser that permits opening the file. Preserve the tested candidate and manifest when making later changes.
2. **Establish human balance and clarity.** Natural Classic runs across four hunters and fresh/partial/full progression; check early choices, evolutions, alternative builds, boss escape routes, Covenant optionality, shop pacing and dense-combat readability. Assisted long fixtures and legal-build bots are diagnostic evidence only.
3. **Use the owner's Android and iPhone.** Record models/OS/browser and complete the physical-device test card, including input cancellation, orientation, audio/lifecycle interruptions, full-session frame time, thermal behavior and repeated retries. Availability of devices is not a passing result.
4. **Complete official integration when access exists.** The owner currently has no Playables Developer Portal access. Obtain access, run the actual Dev Link/test suite, verify cloud/audio/pause/network behavior and prepare accurate screenshots/metadata/rights information. No upload or deployment is authorized by this implementation record.
5. **Prioritize later content from evidence.** Address confirmed fairness/performance issues first, then choose one expansion with a separate scope and acceptance gates. Do not treat the historical phase table as a promise that every optional feature is already built.

Current supporting records: [release checklist](docs/release-checklist.md), [save/rollback policy](docs/save-policy.md), [asset register](docs/asset-register.md), [draft metadata](docs/release-metadata.md), and [project commands and controls](README.md), [dated verification](docs/verification-2026-09-28.md), [known limitations](docs/known-issues.md), and [changelog](CHANGELOG.md).

## Historical audit and design proposal — September 27, 2026

The following 22 sections are retained to preserve the original evidence, reasoning, alternatives and acceptance criteria. They describe the pre-upgrade source and the plan before implementation. Where an original statement conflicts with the execution ledger, the ledger records the current decision; unresolved acceptance criteria remain valid gates.

## 1. Direction and recommended scope

Turn the existing game into a fair, readable, distinctive gothic survival game with satisfying movement, deliberate builds, a paced thirty-minute arc, and reliable progression on desktop, mobile, and YouTube Playables.

The current project already has a useful core: four hunters, eight weapons with eight levels and evolutions, eight passives, twelve enemy definitions, three bosses, permanent upgrades, procedural graphics, synthesized audio, and a small static build. Keep those foundations. The biggest opportunity is to make their interactions correct and meaningful before expanding the content catalog.

The first upgraded release should deliver:

1. Correct combat, run state, reward settlement, and save handling.
2. Reliable keyboard, mouse, and touch movement, with fair threat visibility across screen sizes.
3. Clear menus, readable combat, useful settings, and a better first-run experience.
4. A measured rebalance of existing hunters, weapons, passives, enemies, bosses, XP, and gold.
5. More deliberate build choices, a visible evolution system, and useful run results.
6. Separate, reproducible website, standalone HTML, and Playables builds.

After that foundation, introduce character traits, one distinctive encounter system, mastery goals, and eventually additional arenas or modes. Do not attempt every proposed feature in one release.

### Design pillars

- **Movement creates decisions.** Dodging, approaching treasure, choosing an attack angle, and moving between objectives should matter.
- **Damage is understandable.** Players should recognize a threat, understand the available response, and identify why they were hit.
- **Builds change behavior.** Choices should influence positioning and priorities, beyond increasing the same numbers.
- **Power feels earned.** Early vulnerability should develop into visible mastery without removing the need to move.
- **Progress is trustworthy.** Rewards, purchases, descriptions, saves, and retry behavior must agree.
- **Gothic atmosphere supports readability.** Preserve the dark identity while keeping the hunter and danger clearly visible.
- **One-handed play remains complete.** Auto-attacks and simple movement are strengths. Additional buttons must justify their complexity.

### Boundaries

- Preserve the current thirty-minute Classic run. Its final boss fight can extend actual play beyond thirty minutes; explain this accurately.
- Keep existing hunters and weapons available to existing players. Do not retroactively lock their content or erase upgrades.
- Keep English. Prepare text for future localization; Arabic remains an optional later project, including proper RTL layout work.
- Keep the current engine and Canvas 2D unless measurements establish a specific limit.
- Keep the website and standalone HTML working while adding Playables support.
- No deployment, YouTube submission, new advertising, paid economy, analytics service, or account system is included in implementing this plan by default.
- Gameplay proposals below are recommendations and experiments, not claims that their exact numbers are already balanced.

## 2. Audit scope and evidence

### What was examined

The audit covered `data.ts`, `engine.ts`, `input.ts`, `meta.ts`, `types.ts`, `render.ts`, `sprites.ts`, `audio.ts`, the React screens in `GameRoot.tsx`, global styles, the standalone entry/build script, package configuration, the previous Playables report, and the installed Next.js static-export guide.

Fresh checks during this audit:

| Check | Result | Interpretation |
| --- | --- | --- |
| `npm run build` | Passed | Production compilation, Next.js type checking, and static generation succeeded. |
| `./node_modules/.bin/tsc --noEmit --incremental false` | Passed | Current TypeScript types compile. This does not establish gameplay correctness. |
| `npm run lint` | Failed: 2 errors, 2 warnings | Synchronous effect state update, a `prefer-const` issue, unused import, and font lint warning. Record and address deliberately. |
| Local desktop browser smoke check | Main menu, character selection, opening combat, counters, and pause inspected | Brief dev-build observation, not a full run, performance benchmark, or mobile certification. |
| In-memory engine probes | Multiple defects reproduced | TypeScript was transpiled in memory; animation/audio/browser boundaries were stubbed. Useful for engine logic, not rendering or device behavior. |
| Existing exported artifacts | Prior measurements matched at audit start | `out/`: 29 files, 814,326 bytes; largest 229,156 bytes. Existing `game.html`: 332,525 bytes. The standalone file was not rebuilt. |

The existing `plan.md` was empty when the original audit started. No gameplay source was changed to produce that September 27 audit; the authorized implementation recorded above followed on September 28. A Next.js-generated change to `AGENTS.md` was restored after the original local audit.

### Evidence labels

- **Reproduced:** demonstrated through a focused engine probe or the brief browser check.
- **Confirmed source:** behavior follows directly from the current implementation.
- **Historical observation:** the earlier review or its screenshot, not a fresh reproduction.
- **Design hypothesis:** a plausible improvement or balance concern requiring experiments and playtests.

Full natural thirty-minute runs, every boss/build combination, physical touch behavior, late-game frame time, peak memory, and YouTube certification remain unverified. This is a broad audit, not a claim that every possible defect has been discovered.

## 3. Current game model and quantitative baseline

### The player loop

Choose hunter → move and auto-attack → collect XP/gold → select upgrades → defeat elites and open chests → evolve weapons → defeat the bosses → spend permanent gold → retry.

The loop is complete, but most decisions are concentrated in upgrade modals. The arena has decorative props without meaningful destination choices. Character identity is mostly starting equipment and static statistics. There are few systems that change the player's objective between boss encounters.

### Content and pacing

| System | Current implementation |
| --- | --- |
| Hunters | Aldric/Sentinel, Lyra/Windrunner, Morwen/Voidcaller, Vex/Forsaken; all available immediately |
| Run equipment | Up to six of eight weapons and six of eight passives |
| Weapon progression | Eight levels, then evolution via paired passive and a chest |
| Passive progression | Five levels each |
| Boss schedule | Colossus at 5:00, Lich at 15:00, Death at 30:00 |
| Elite opportunities | Every two minutes from minute 2 through 28, approximately at :25 |
| Swarms | Minutes 3, 7, 11, 17, 21, 24, 27, approximately at :28 |
| Movement | Base speed 175 world units/second; horizontal facing controls Sword Wave |
| Player damage protection | 0.65 seconds of invulnerability after a hit |
| Permanent progression | Ten upgrade tracks, 45 purchased ranks |
| Pool capacities | 400 enemies, 300 friendly bullets, 120 hostile bullets, 700 pickups, 500 particles, 90 damage numbers |

Pool limits are implementation limits, not evidence that their current values are sufficient. Critical rewards and essential attacks need defined behavior when a pool is exhausted.

### Current difficulty curve

Derived from the wave table and scaling functions, not measured survival results:

| Minute | Enemy HP multiplier | Contact damage multiplier | Enemy XP multiplier | Nominal regular spawns/second | Regular alive cap |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 1.000 | 1.00 | 1.00 | 1.429 | 30 |
| 5 | 1.657 | 1.20 | 1.60 | 2.500 | 80 |
| 10 | 2.546 | 1.40 | 2.20 | 5.556 | 150 |
| 15 | 3.632 | 1.60 | 2.80 | 5.263 | 170 |
| 20 | 4.900 | 1.80 | 3.40 | 8.000 | 220 |
| 25 | 6.340 | 2.00 | 4.00 | 8.571 | 255 |
| 29 | 7.609 | 2.16 | 4.48 | 11.667 | 285 |

These rates exclude swarms, elites, summons, and the effect of reaching the alive cap. During a boss, regular spawn frequency is divided by 2.6 and the alive cap becomes 35% of normal. That breathing room is a useful design foundation; preserve it while measuring whether fights still drag.

XP requirements have sharp steps: level 19 requires 167 XP for the next level, level 20 requires 238; level 39 requires 468, level 40 requires 817. Those are approximately 42.5% and 74.6% increases between adjacent requirements. They may create stalls, but actual collection rates must be measured before smoothing them.

Six level-eight weapons and six level-five passives require 77 ranks beyond the starting weapon. Chests supply some of those ranks. This makes modal frequency and time spent choosing an important part of the real session length.

### Current gold economy

| Upgrade | Total cost to max | Ranks |
| --- | ---: | ---: |
| Might | 3,961 | 5 |
| Vitality | 3,168 | 5 |
| Swiftness | 3,432 | 5 |
| Haste | 4,753 | 5 |
| Magnetism | 2,014 | 5 |
| Fortune | 3,695 | 5 |
| Greed | 2,904 | 5 |
| Growth | 4,224 | 5 |
| Armor | 1,608 | 3 |
| Revival | 2,400 | 2 |
| **Total** | **32,159** | **45** |

Most prices grow by 1.9× per rank while the listed rank benefits increase linearly. Higher ranks therefore have lower marginal value per gold. This is a pacing choice to validate, not automatically a bug.

Other useful baselines:

- A normal kill has a base expected coin reward of 0.175 gold, assuming all dropped coins are collected.
- Fourteen elite opportunities, two early bosses, and their sixteen chests offer approximately 1,340 base gold before ordinary drops, assuming all occur and all rewards are collected. This is an opportunity calculation, not typical run earnings.
- Luck affects coin/healing drops, chest gold, chest upgrade counts, and draft option count. At 1.5 luck, draft choices jump from three to four.
- A non-evolution chest averages 1.56 upgrade ranks at base luck, subject to available upgrades; at 2.25 luck the expectation becomes 2.26.
- Maximum permanent Might/Haste provide about 42.9% more nominal damage per second for cooldown-based weapons before other factors. With maximum in-run Whetstone/Storm Crystal, the corresponding multiplier is 2.5× base before character, critical hits, weapon levels, targeting, and evolution.
- A completed six-weapon build contains 75% of the weapon catalog. Variety can be limited even when many combinations technically exist.

## 4. Correctness backlog: fix before final balancing

Priority definitions: **P0** protects run outcomes, rewards, saves, or basic state integrity; **P1** fixes combat fairness, misleading behavior, usability, or release readiness; **P2** adds depth and polish; **P3** is an expansion experiment.

Source line references describe the audited revision and will move during implementation.

| ID | Priority / evidence | Problem and consequence | Implementation direction and acceptance |
| --- | --- | --- | --- |
| F01 | P0 / reproduced | `passiveBase` survives across runs. A passive or ordinary chest can restore the previous hunter's stats and erase new permanent upgrades. `engine.ts:291,1751`. | Build immutable base stats for each new run and reset every run-owned field. Knight → upgraded Mage → passive must retain Mage/upgrade stats; test retries, purchases, chests, and consumed revives. |
| F02 | P0 / reproduced | The update continues after fatal damage. A same-frame chest can replace game over, recompute HP to at least 1, and resume play. `engine.ts:383,743,1583,1774,1789`. | Make terminal transitions exclusive; stop simulation stages once terminal. Dead players cannot collect/open a chest or return to play. |
| F03 | P0 / reproduced | Fatal damage and the pending victory timer can both settle the same run as loss and win in one frame. `engine.ts:416,976,1928`. | Define death/victory precedence and an idempotent terminal/settlement operation. Exactly one result and one reward transaction per run. |
| F04 | P0 / confirmed source | Combat callbacks use wall-clock `setTimeout`; stopping the engine does not cancel them. Old attacks can fire into a new run, and pause can discard delayed attacks instead of preserving them. `engine.ts:852,1098,1139,1181`. | Move combat delays onto simulation time; associate queued actions with a run ID. Pause preserves remaining delay; restart invalidates old actions. |
| F05 | P0 / reproduced | Saves accept invalid shapes. `{"gold":-100,"upgrades":null}` loads and crashes stat construction. `meta.ts:6–22`. | Version, validate, migrate and recover saves. Distinguish missing data from failed loading; never overwrite unread cloud data with defaults. |
| F06 | P0 / reproduced | A full 700-pickup pool silently drops chests and other non-gem rewards. `engine.ts:1494`. | Guarantee critical rewards using reserved capacity/priority queues and value-preserving consolidation. An elite/boss chest must survive a full pool. |
| F07 | P0 / confirmed source | Abandon bypasses reward settlement, losing run gold/stats. Closing/reloading also loses unbanked rewards. Chest text says treasury although gold is not yet permanent. `GameRoot.tsx:72,192`; `engine.ts:1828`. | Define banking and abandonment policy; checkpoint earned permanent rewards and settle once. Display pending versus banked currency honestly. |
| F08 | P1 / reproduced | Arrows have no hit history. One piercing arrow can damage the same overlapping foe repeatedly, consuming all pierces. A 10-damage arrow with pierce 3 dealt 40 to one target. `engine.ts:1396,1428`. | Track already-hit entity IDs per projectile; define pierce as additional distinct targets. Use stable IDs across pool reuse. |
| F09 | P1 / reproduced | Boss orb cooldown is decremented once per active bullet, so unrelated arrows multiply orb damage. Probe: one orb dealt 40 over one second; adding nine distant arrows raised it to 300. `engine.ts:1434`. | Advance each target timer once per simulation step. Unrelated projectile count must not change orb tick frequency. |
| F10 | P1 / confirmed source | Orbs and orbiting daggers share `enemy.orbCd`, suppressing each other's damage. `engine.ts:1293,1379`. | Specify per-source hit cooldowns and intentional stacking rules. Purchasing a second weapon must not silently disable the first. |
| F11 | P1 / reproduced | Spatial query cell bounds ignore enemy radius. A target intersecting an attack across a cell boundary can be missed. Grid is also reused after enemies move/teleport. `engine.ts:387,593–632`. | Correct broadphase bounds and update ordering. Compare spatial queries against brute-force overlap checks over randomized fixtures and large elites. |
| F12 | P1 / reproduced | Sword angular wrapping can produce a negative angle difference, allowing hits outside the cone when facing left. `engine.ts:1095,1231,1248`. | Normalize angles consistently. Right/left and all evolved directions must have symmetric hit geometry. |
| F13 | P1 / confirmed source + probe | Frost's advertised duration upgrade is ineffective: data says 1.6 → 2.4 seconds but shard hits always apply 1.8. `data.ts:119–124`; `engine.ts:1170,1385`. | Carry resolved effect duration into the projectile and collision. Every displayed upgrade must change its promised property. |
| F14 | P1 / confirmed source | Fireball area multiplies its level area twice. At base global area, level-eight radius is 200.88; evolved meteors use radius 95 and ignore that level-area value. `engine.ts:1084,1184,1200`. | Define radius/area semantics once. Correct the formula, then deliberately retune evolution damage, coverage and cadence; do not assume a formula fix alone preserves feel. |
| F15 | P1 / reproduced | Frozen wraiths/shadows still drift because lateral movement is outside the slow/freeze multiplier. `engine.ts:641–688`. | Define whether freeze stops voluntary motion, knockback and pull separately. Freeze must match its description and visual state. |
| F16 | P1 / confirmed source | Death's dash warning uses an earlier direction, while the attack recomputes aim at windup end. A target at `(0,0)` also selects the wrong telegraph shape through a truthiness check. `engine.ts:826,927`; `render.ts:308`. | Store a typed attack intent with locked target/direction and render that exact geometry. Never infer shape from coordinate truthiness. |
| F17 | P1 / confirmed source | Rendering mutates damage-number state using fixed `1/60`, making duration refresh-rate-dependent and allowing advancement during pause. `render.ts:751`. | Move all state updates out of rendering. Rendering the same state repeatedly must leave simulation unchanged. |
| F18 | P1 / confirmed source | Pause leaves RAF loops, music scheduling, and other activity running. Audio resumption only considers local mute. `GameRoot.tsx:119`; `engine.ts:340`; `audio.ts:54,240`. | Separate user pause, modal pause and platform suspension. Freeze required systems; preserve current screen and platform audio precedence. |
| F19 | P1 / confirmed source | Key repeat can repeatedly toggle pause; focus loss clears keys but leaves joystick state. Visual joystick reaches its edge before input reaches full speed. `input.ts:25,30,102`; `render.ts:808`. | Ignore toggle repeats, centralize input reset, and share one joystick response model between input and drawing. |
| F20 | P1 / confirmed source | Movement lacks mouse support; attack facing only records horizontal motion. `input.ts:66`; `engine.ts:426,1089`. | Add complete pointer movement. Deliberately redesign facing/aiming so vertical movement and sword direction are understandable. |
| F21 | P1 / historical observation + source | Character menus clip on portrait/landscape; global touch-action blocks normal menu scrolling; several modals cannot scroll. `GameRoot.tsx:418,569,611,642,667`; `globals.css:24`. | Shared responsive screen/modal shells with safe scrolling and reachable actions. Retest all screens across the viewport matrix. |
| F22 | P1 / confirmed source | GoldGain rounds each small coin, producing 5,6,6,7,7,8 gold for a nominal 5-value coin across Greed ranks. Bag of Gold ignores the multiplier. `engine.ts:1554,1728`. | Define reward rules centrally, retain fractional precision until the chosen banking/display boundary, and make every rank's benefit accurate. |
| F23 | P1 / confirmed source | HUD time freezes at 30:00 but later summons scale from increasing internal time. A prolonged Death fight silently grows harder. `engine.ts:384,522,1966`. | Choose a visible finale escalation policy or freeze scaling. Show final-fight duration separately if used for records. |
| F24 | P1 / confirmed source | Spawns/recycling use fixed world radii while the visible world is CSS-pixel-sized. Large displays can see enemies appear; mobile sees much less warning. `engine.ts:481,521,553,660`; `render.ts:276`. | Shared camera/visibility policy and spawn checks against the visible region. Test threat reaction time across orientations. |
| F25 | P1 / confirmed source | Standalone packaging imports missing `esbuild` and continues without CSS. Playables integration and dedicated package are absent. `build-standalone.mjs:5,29`; `package.json`. | Declare build dependencies, fail incomplete builds, create isolated outputs, and validate the generated archive. |
| F26 | P1 / confirmed source | Frame exceptions are logged and the loop continues indefinitely; errors may repeatedly corrupt or stall a run. `engine.ts:346`; `GameRoot.tsx:142`. | Classify recoverable errors; stop safely on repeated/fatal faults, retain valid progress, and expose bounded diagnostics in development. |
| F27 | P1 / confirmed source | At 30:00 an undefeated earlier boss is silently replaced by Death without its normal death/reward path. `engine.ts:586–588`. | Define whether the earlier boss retreats, is explicitly settled, or must be defeated first. Test the boundary with pending attacks and make reward/narrative behavior intentional. |

Additional integrity checks should cover fast-bullet tunneling, current versus stale contact positions, multiple simultaneous pickups, exhausted enemy/projectile pools, queued modals, and stale UI commands. These are test targets; do not call every one a reproduced defect before testing it.

## 5. Movement, camera, input and combat feel

### Movement policy

Keep immediate movement as the default. Do not add heavy acceleration or inertia to a game built around narrow dodges. Normalize diagonals. Use a small, configurable analog dead zone and a clear full-speed radius; keyboard movement should reach intended speed immediately.

Implement one normalized movement-intent API fed by keyboard and Pointer Events. Pointer capture should permit dragging outside the initial control region. Reset intent on cancellation, lost capture, suspension, run termination, and appropriate focus changes. Multiple touches and UI interactions must not steal the active movement pointer.

Offer floating joystick by default, with a fixed-position option and left/right placement after basic pointer control is proven. Mouse dragging should be sufficient for the whole game. Click-to-move and controller support are later options, not dependencies for the first upgrade.

### Attack direction

The current Sword Wave fires left/right, even when movement is vertical. Prototype an eight-direction or continuous last-movement aim vector, retaining sprite-facing separately. Show direction subtly when useful. Preserve auto-targeting for weapons whose identity depends on it. Avoid introducing mandatory manual aiming across every weapon.

Compare stationary, moving vertically, reversing, and circling behavior. A melee hunter must be able to intentionally attack an approaching threat without unexplained aim flips.

### Camera and viewport fairness

Define a logical combat scale independent of device pixel ratio. CSS layout, canvas pixel resolution, and world visibility should be separate concerns. Choose a minimum useful tactical view for the shortest viewport dimension, then test portrait and ultrawide behavior; avoid simply shrinking the hunter until threats become unreadable.

Spawn normal foes outside the visible combat rectangle with a safety margin. Intentional visible summons must have a clear arrival warning and grace period. Recycling must not teleport an elite into view without warning. Keep safe regions for HUD and fingers in mind when deciding where threats become visible.

Camera following should remain smooth but should not conceal enemies in the direction of travel. Prototype modest movement look-ahead and cap camera lag. Screen shake must never alter collision coordinates or input interpretation.

### Damage feedback and agency

- Make the hurt state, invulnerability interval and recovery readable through silhouette/outline and health change, not only blinking.
- Record damage source and attack type for the death recap.
- Ensure hostile projectile shapes remain distinguishable from friendly attacks.
- Keep attack impact feedback short: restrained flash, selected hit sounds, limited knockback and readable critical hits.
- Prototype a dodge/dash only after movement and encounter fairness are fixed. A dash changes enemy design, input complexity, invulnerability balance, and touch accessibility; it is not a quick universal fix.

Acceptance: keyboard, mouse and touch complete the same run flow; no stuck movement; diagonal speed is correct; attack facing is consistent; every imminent attack has a visible response window on the smallest supported viewport.

## 6. Weapon roles, passives and build diversity

### Weapon role matrix

Rebalance after F08–F16 are resolved. Nominal damage alone cannot compare piercing, area attacks, control, sustain and targeting.

| Weapon | Intended strength | Intended weakness / decision | Upgrade and evolution direction |
| --- | --- | --- | --- |
| Sword Wave | Directed close-range clearing; creates a safe lane | Requires positioning and facing | Improve directional control. Evolution adds coverage and capped on-kill sustain without removing all exposure. |
| Hunter Bow | Reliable priority-target damage | Limited crowd coverage without pierce/crit setup | Distinct-target piercing, readable volley targeting, measurable boss contribution. |
| Arcane Orb | Persistent lane control and group damage | Slow travel and imperfect coverage against mobile targets | Separate tick rules; evolution pull should support combinations, not suppress daggers or hide danger. |
| Lightning | Distributed burst and clustered-target payoff | Target randomness and gaps between strikes | Prefer valid targets, avoid redundant dead-target strikes, make chains legible and bounded. |
| Frost Shards | Creates breathing room and controls pursuers | Lower direct damage and limited boss control | Make every duration rank work. Specify boss resistance; prevent permanent full-area freeze from becoming the only safe strategy. |
| Fire Wand | High-impact explosions against groups | Telegraph/travel delay and less dependable single-target uptime | Correct area formula; evolve into a meaningful meteor tradeoff or clear upgrade, with honest descriptions. |
| Holy Aura | Close-range defense and weak-enemy cleanup | Requires dangerous proximity; modest boss damage | Protect its defensive niche. Sustain and knockback need caps so it does not remove movement decisions. |
| Spirit Daggers | Strong orbital zone rewarding distance management | Targets inside/outside the orbit can escape damage | Independent target timers, clear orbit reach, evolution treasure utility that does not replace all pickup decisions. |

### Upgrade quality

Every rank must have an observable, truthful effect. Generate the numerical preview from resolved stats rather than duplicating prose assumptions. Clarify whether an “area” bonus changes radius or actual covered area; a 40% radius increase produces approximately 96% more circular coverage.

Use controlled fixtures for single stationary target, moving target, sparse enemies, dense enemies, boss, and combined weapons. Report effective damage, target coverage, control uptime, overkill, healing, and survival impact separately.

Avoid forcing all weapons to identical DPS. Aim for useful niches, combinations and tradeoffs. Correcting the arrow/orb bugs may make familiar builds weaker; rebalance the legitimate mechanics and communicate the change.

### Passive roles and transparency

- Damage, cooldown and critical chance need visible current values and consistent stacking rules.
- Movement and pickup radius should improve the experience without becoming mandatory fixes for bad default controls or collection.
- Health/regen/armor need evaluation against actual hit frequency and enemy damage, across fresh and progressed saves.
- Luck currently controls too many hidden benefits. Explain its effects immediately, then test separating draft convenience from drop luck. Do not silently remove purchased value.
- Evolution recipes must be visible in an equipment journal and on relevant cards. A passive at any rank currently qualifies; state this clearly.

### Draft system

For the first upgrade, keep the six weapon/six passive caps to avoid changing the entire progression budget at once. Add:

1. Current → next level, exact stat change, item role and slot use on each choice.
2. Evolution partner and readiness indicators; warn before filling the last slot needed by a desired recipe.
3. A bounded reroll/skip system; prototype banish later. Initial draft tools should not require spending permanent currency to make the game usable.
4. Limited bad-luck protection for a functional starting build, with a clear rule rather than hidden manipulation.
5. An explicit evolution choice when several weapons qualify, or a clearly documented priority policy.
6. Deliberate handling of queued level-ups/chests so one input cannot accidentally confirm the next screen.

Test smaller loadouts only as an experiment. Reducing six slots to four would change enemy budgets, progression length and existing strategies, so it needs its own full rebalance.

## 7. Hunter identity and mastery

First make the existing stat differences reliable. Then prototype one readable signature trait per hunter, using passive triggers before adding active buttons.

| Hunter | Current role | Candidate identity experiment | Main risk to test |
| --- | --- | --- | --- |
| Aldric | Durable sword starter | Guard/retaliation rhythm tied to deliberate positioning and facing | Must not encourage safe permanent standing still or automatic damage immunity. |
| Lyra | Fast precision hunter | Moving for a short interval prepares a precision volley | Avoid rewarding endless circles regardless of threats; expose the charge clearly. |
| Morwen | Frail area caster | Controlled grouping/arcane interaction that changes spell placement | Pull must not drag enemies into unavoidable contact or stack without limits. |
| Vex | Fragile orbital fighter | Bounded risk/recovery window tied to close-range blade kills | Avoid permanent low-HP exploitation and mandatory sustain combinations. |

These are candidate prototypes, not four approved implementations with final values. Test one at a time against the same baseline seeds and save profile. Each hunter must have an intelligible strength, weakness, starting weapon, and recommended first build.

Character selection should show comparable information for all hunters. Penalties must be labeled as penalties, not presented in the same green list as benefits. Replace emoji-only identity gradually with coherent portraits based on the existing art direction.

Mastery should reward learning a hunter: distinct achievements, cosmetic accents, lore entries, or alternative starting loadouts with tradeoffs. Avoid an endless second layer of mandatory damage upgrades.

## 8. Enemy ecology, difficulty and encounter pacing

### Enemy roles

Most ordinary enemies currently approach the player; hounds charge and wraiths/shadows drift. Twelve appearances should produce more than twelve stat packages.

Map each enemy to a readable role before adding new types:

- **Fodder:** rewards clearing and provides predictable XP.
- **Pursuer:** tests sustained movement and route changes.
- **Charger:** announces a direction, commits, then exposes recovery time.
- **Flanker/drifter:** pressures the side without ignoring freeze rules.
- **Heavy:** creates a slow obstacle and rewards focused damage.
- **Ranged pressure:** proposed later, with deliberate firing windows and visible projectiles.
- **Support/summoner:** proposed later, creates a priority target and a reason to move toward danger.

Each new behavior needs a silhouette, tell, counterplay, reward budget and simultaneous-threat limit. Do not add ranged attackers merely by increasing bullet density.

### Difficulty model

Balance enemy composition, approach directions, speed, attack timing, count, HP and rewards together. Increasing HP alone can create long cleanup periods rather than useful tension.

Keep authored waves as the primary system. Add encounter budgets that prevent unfair combinations, such as a swarm, elite, dash and dense projectile pattern all demanding incompatible movement. Any later adaptation should be explicit and carefully tested; do not secretly cancel good builds by scaling enemies to player damage.

Use three balance profiles: fresh save, representative partial progression, and max progression. Cross all four hunters and both mouse/keyboard and touch. A skilled fresh-save player should have a viable victory route; permanent upgrades should widen tolerance, not make a mathematically impossible run possible.

### Proposed Classic arc

| Segment | Intended experience | Design work |
| --- | --- | --- |
| 0–2 minutes | Learn movement and get the first useful choices | Active starting weapon, readable weak enemies, nearby collectible XP, short contextual prompts. |
| 2–5 | Commit to an early build | First elite/chest teaches reward pursuit; first swarm teaches an escape route; prepare for Colossus. |
| 5–10 | Demonstrate growth | Recover after boss, introduce new enemy roles, build toward a first evolution. |
| 10–15 | Test the build's weakness | Mix complementary threats, offer an optional risk/reward encounter, prepare for Lich. |
| 15–22 | Express a mature build | Larger but readable fights; movement objectives and meaningful evolution choices. |
| 22–30 | Build final pressure | Short recovery windows, avoid repeated indistinguishable stat escalation, signal approaching dawn. |
| Finale | Prove mastery | Distinct Death phases, honest telegraphs, readable victory transition and earned reward. |

Provisional tuning hypotheses: a first meaningful upgrade within roughly 20–45 seconds; a focused build can reach its first evolution around minutes 7–12; an ordinary boss encounter often resolves in roughly 45–120 seconds for an appropriately developed build. These are experiment starting points, not current measurements or hard promises. Adjust after actual player data, especially on touch.

Measure time spent without a useful decision, time stuck at the enemy cap, collectible XP left behind, and elapsed time inside modals. Do not use debug time skipping as proof of pacing: it bypasses scheduled elite/swarm opportunities and progression.

## 9. Boss redesign and finale integrity

Keep the three-boss structure and give each fight a distinct lesson. Define the 30:00 handoff if an earlier boss is still alive; the current silent replacement must become an explicit encounter and reward policy. Include that boundary in regression tests.

### Colossus: positioning and commitment

Retain the visible slam and summoning identity. Make warning duration, impact radius and actual collision agree. Suspend the windup with the simulation clock. Summons should create choices without surrounding the player with no exit. A boss defeated during windup must not leave an unexplained attack behind unless that behavior is explicitly designed and telegraphed.

### Lich: projectile lanes and target priority

Retain radial volleys, aimed spreads and repositioning. Telegraph the arrival position and provide a brief readable arrival window. Ensure spread/radial combinations leave a feasible route at base movement speed. Reduce incidental horde clutter enough to read the pattern. Test offscreen starts and touch occlusion.

### Death: a fair culmination

Use a typed attack state for windup, committed dash, recovery, spiral barrage and summoning. The displayed dash corridor must match the committed path. Signal the half-health enrage through stable UI and animation, not only shake/flashes. Define a visible escalation timer if prolonged fights are intended to intensify; otherwise freeze summon scaling.

After the killing blow, enter an exclusive victory transition: hostile damage can no longer turn the same result into defeat, reward settlement happens once, and queued modals have a defined resolution. Decide whether remaining nearby rewards are automatically credited before results.

Clarify the narrative: there are two earlier bosses and Death, three total. Current menu wording can imply three harbingers plus Death.

Acceptance: every attack has a valid counterplay route at baseline mobility, warning and impact geometry agree, pause/restart cannot leak attacks, and death/victory resolve exactly once even on simultaneous events.

## 10. Arena design, objectives and distinctive features

The current infinite decorative ground provides space but few destinations. Improve reasons to move before increasing map count.

### First arena pass

- Organize visual regions through landmarks, silhouettes and ground treatment while preserving open escape routes.
- Distinguish decorative props from collision-bearing objects. Do not make existing scenery solid without testing enemy navigation and player trapping.
- Add subtle offscreen indicators for boss, elite/chest and optional objective; prioritize rather than filling every screen edge with arrows.
- Make valuable reward locations create a meaningful approach decision while guaranteeing they remain recoverable.
- Use regional visual variety that does not camouflage enemies or projectiles.

### Proposed signature system: Nightfall Covenants

Prototype a small number of optional ritual encounters during a run. A visible shrine offers a clearly stated risk and a build-shaping reward. Entering or explicitly accepting starts a short authored challenge, such as holding a marked region through a telegraphed wave or defeating a marked elite before its ritual completes.

The reward should be a limited rule change, not another generic +damage stack: examples include frost shattering marked targets, a precision volley changing formation, or a defensive ring releasing a counterattack. Each needs a cap and clear downside/condition.

Prototype only one encounter and a few rewards first. Schedule it away from major boss introductions. Allow declining it with no penalty. Test whether it creates meaningful movement and build decisions before adding more shrines. Keep Classic completable without it; avoid accidental mandatory rewards.

### Later content

- A second arena should change routes, threat composition and objectives, not just recolor the floor.
- Additional hunters/weapons should fill missing roles established by data.
- Seeded challenge runs and explicit difficulty modifiers can add replay value after deterministic simulation and save/version rules exist.
- An optional shorter mode may be valuable, but it needs its own progression, rewards and pacing. It must not silently replace the thirty-minute Classic mode.
- Endless mode, boss rush, controller support and more complex active skills are separate expansion decisions.

## 11. Permanent progression, rewards and persistence

### Reward policy

Recommended policy: legitimate collected gold remains earned on death or deliberate abandonment. A visible, deliberate “End run” action should explain that the current attempt ends and state what is kept. For Playables, confirm its wording/placement against platform exit-button interpretation before shipping it.

Use a unique run ID and a monotonic credited-reward total so periodic checkpoints and final settlement cannot pay the same gold twice. Track completed, won and abandoned attempts consistently. Display gold pending save if storage is temporarily unavailable; do not silently claim it was banked.

Save material permanent progress promptly. Closing an app cannot depend solely on a last-moment unload save. A full mid-run resume system is a separate capability and should not be claimed until the whole run can be restored correctly.

### Economy tuning

1. Fix reward rounding and multiplication inconsistencies.
2. Measure first-purchase time, purchases per run, and progress after early losses for actual new players.
3. Make the first useful purchase achievable without requiring a long successful run; treat the precise target as a playtest decision.
4. Show current total benefit, next-rank benefit, cost and remaining gold in the shop.
5. Consider a free respec/refund system with exact paid-cost accounting so players can experiment; define migration of historical purchases before enabling refunds.
6. Give victory a meaningful, explicit reward. Choose a bonus from measured earning rates rather than inventing an arbitrary large payout.
7. Add horizontal goals after shop completion: mastery, discoveries, cosmetic variants and challenge records. Avoid limitless stat inflation or multiple unnecessary currencies.

### Save architecture

Use a versioned envelope for profile, settings, discoveries, optional active run and settlement metadata. Validate known IDs, finite numbers, rank caps, ranges and maximum sizes. Migrate older data through explicit steps. Preserve a last-known-good recovery path where the storage environment permits it.

Start with one supported active run per profile. Document browser-tab and platform-device conflict behavior; do not promise concurrent-run merging before the storage API and replay/settlement rules have been tested.

A malformed save, unavailable storage, failed cloud load and genuinely new player are different states. Present useful recovery/retry choices without exposing implementation details. Disable destructive overwrites after unresolved load failures.

Purchases and reward settlement should be idempotent domain operations outside React state updater side effects. Serialize persistence writes and define stale-write/conflict behavior supported by the selected storage API. Preserve the website's existing save key/schema through migration. Website localStorage and YouTube cloud storage are separate histories; do not promise automatic transfer.

### Active-run resume, after core lifecycle work

A correct snapshot needs run/content version, RNG states, simulation time, hunter/base stats, equipment, HP/revives, XP, credited rewards, enemies/bosses, projectiles/pickups as needed, scheduled attacks, director state, queued drafts/chests and terminal state. Do not serialize canvases, audio nodes or transient rendering caches.

Resume must restore a safe readable frame before accepting input. Test snapshots during boss windup, level-up, treasure, manual pause, low HP and final transition. Define an honest compatibility policy for snapshots from older balance versions; never erase permanent progress because an active run cannot be resumed.

## 12. UI, onboarding and the complete player journey

Build a shared screen shell and modal shell before polishing each screen independently. Include safe-area insets, dynamic viewport height, vertical overflow, visible focus, and consistent primary/secondary actions.

| Screen / moment | Planned improvement |
| --- | --- |
| Main menu | One clear Play action, readable premise, Power-Ups, Help and Settings; compact progress summary and next meaningful objective. |
| Character selection | Consistent portrait, weapon, role, benefit, drawback, selected state and remembered last hunter; reachable Back/Hunt controls. |
| First run | Skippable contextual movement/auto-attack/XP/first-choice guidance; prompts match input device; sword direction explained. |
| HUD | Health, current milestone/time and pause take priority; reorganize narrow layouts instead of overlapping independently positioned clusters. |
| Inventory/build view | Names, levels, effective stats, evolution partners and readiness; icons alone are insufficient. |
| Level-up | Numerical before/after, category, slot use and synergy information; reliable focus and deliberate selection. |
| Chest/evolution | Clear reward changes, concise celebration, immediate usable Continue, scroll support for large reward sets. |
| Pause | Resume first, then build details, settings/help and deliberate run-ending action with consequences. |
| Death | Cause of death, milestone reached, final build, banked rewards and a useful next step. |
| Victory | Distinct dawn payoff, accurate final-fight result and first-win/mastery rewards where implemented. |
| Retry | Offer same-hunter retry directly, alongside change hunter/build; do not require the full selection flow every time. |
| Power-Ups | Cumulative/next benefit, rank, affordability/maxed states, purchase feedback, clear route back to play. |
| Journal/help | Pickups, weapon roles, evolution recipes, enemy/boss tells, control reference and discoveries. |
| Loading/save failure | Genuine loading and interaction readiness; clear retry/recovery state without replacing valid progress. |

Avoid accidental choices from held keys/touches when a modal opens. Enter should activate an intentionally focused item, not instantly purchase a newly appeared default. Escape handling must be state-specific and must not prevent the platform's Escape behavior in Playables.

First-run test: observe new players without coaching. Can they move, understand automatic attacks, collect gems, make an informed upgrade, identify damage, and reach the shop after a loss? Record actual confusion and revise prompts; do not solve every problem with another paragraph of instructions.

## 13. Art direction, animation and combat readability

Keep blue-black stone, restrained crimson danger, warm gold rewards, arcane violet magic and distinct hunter accents. Use decorative typography for titles and a legible UI face for information. Bundle licensed fonts or choose system fallbacks deliberately.

Use a compact narrative premise: four hunters confront a night ruled by NORPEK, and victory visibly restores dawn. Give each hunter and boss a short recognizable motive or identity through selection text, journal discoveries and encounter presentation. Keep story optional and brief; do not block repeat runs with cutscenes.

The existing procedural sprites and cached effects are useful. Improve consistency and silhouettes before replacing the entire art pipeline. Gradually replace mixed platform emoji with a coherent original/licensed icon set; retain text labels and accessible names.

### Readability order

Hunter → imminent hostile attacks → nearby enemies → valuable pickups/objectives → friendly attacks → decorative environment.

Currently telegraphs draw below everything while later effects can cover the player. Separate world fills from important telegraph outlines/markers. Define explicit visual semantics for hostile danger versus friendly meteors, freeze, healing and rewards. Use pattern/shape as well as color.

Keep glow bounded. A huge evolved build should feel powerful without hiding where the player can safely move. Add an effects-intensity control, damage-number density options, and an option to emphasize hostile projectiles/player outline. Test busy scenes rather than only isolated sprites.

Improve animation with purposeful anticipation, attack commitment, recoil and recovery. Use stronger timing and silhouettes rather than more particles. Consider subtle hitstop only after clock/suspension architecture is correct, and ensure reduced-motion settings remain respected.

Art acceptance: consistent icon family, readable type at small sizes, distinguishable enemy roles, visible hunter in the densest supported scene, accurate telegraph bounds, and documented provenance for every added asset.

## 14. Audio and music

Retain synthesized audio initially; there is no demonstrated need for large audio assets. The engine already has separate music/SFX gains but only exposes master mute.

- Add music and SFX volume controls; persist preferences through the appropriate platform adapter.
- Keep platform mute authoritative, including pending tones and resumed audio contexts.
- Establish a voice/concurrency and headroom budget. Reserve audible space for damage, boss warnings, evolution and rare rewards.
- Reduce repetitive hit/pickup fatigue; prioritize meaningful events rather than making every collision equally loud.
- Cache reusable noise buffers if profiling shows allocation cost; clean up/disconnect finished audio nodes appropriately.
- Schedule music with a stable audio clock/look-ahead method and suspend cleanly. Do not restart the song accidentally on every modal or resume.
- Prototype musical layers for early exploration, horde pressure, bosses and dawn. Use a few deliberate transitions before commissioning a full soundtrack.
- Important information must remain available visually with all sound disabled.

Actual sound quality, clipping and fatigue require listening tests; this audit inspected synthesis/scheduling code and did not establish measured audio quality.

## 15. Accessibility and comfort

Accessibility is part of the first quality pass, not only a final checklist.

- Semantic controls for character selection and all menus; selected/disabled state and visible focus.
- Keyboard-complete menus, shop, drafts, treasure, pause and retry; predictable focus entry/return for dialogs.
- Internal touch target goal of at least 44×44 CSS pixels for essential actions, with spacing against accidental taps.
- Larger readable essential information; current 8–10 px badges should not carry the only explanation of a build.
- Measure text contrast against actual backgrounds; target 4.5:1 for ordinary UI text and appropriate large-text/icon contrast.
- Independent shake, flash/pulse, damage-number and effect-intensity options; honor reduced-motion preference on initial setup.
- Color-independent damage/benefit/penalty and danger markers; test common color-vision simulations.
- Left/right joystick placement and optional fixed controls; later remapping/controller support if demand justifies it.
- Clear audio-independent warnings and no essential information conveyed only through decorative animation.
- Review zoom restrictions and scalable UI. Keep touch behavior scoped to the gameplay surface instead of globally suppressing usable browser/menu gestures.
- Do not announce the entire 10 Hz HUD through a screen reader. Expose menus and meaningful events with restrained announcements; evaluate canvas gameplay accessibility honestly without claiming full nonvisual support prematurely.
- Offer transparent assist settings or a clearly labeled gentler mode after baseline balance is understood. Separate records when rules affect challenge; do not hide assistance behind permanent-grind requirements.

## 16. Technical architecture and maintainability

Refactor around tested seams, not a full rewrite. The roughly 2,000-line engine currently owns simulation, state transitions, progression, rewards, timers and audio calls; the React shell also owns a separate render loop and lifecycle behavior.

### Recommended boundaries

| Module boundary | Responsibility |
| --- | --- |
| Game session/state machine | Own run identity, allowed transitions, terminal precedence, pause/suspension reasons and disposal. |
| Simulation clock/scheduler | Fixed or controlled simulation steps, delayed gameplay actions, deterministic ordering. |
| Combat systems | Weapons, damage/status rules, stable entity IDs, collisions and target selection. |
| Director/encounters | Waves, elites, swarms, bosses and optional ritual budgets. |
| Progression/rewards | Drafts, evolutions, currency rules, mastery and idempotent settlement. |
| Persistence service | Validation, migrations, snapshots, ordered writes and recovery states. |
| Platform adapter | Browser versus Playables loading, storage, lifecycle, audio and capability differences. |
| Input controller | Normalized intent and device-specific controls, separate from menu focus. |
| Renderer/audio presentation | Consume state/events; do not mutate gameplay or determine game outcomes. |
| React UI | Screen flow, accessible controls and low-frequency HUD presentation. |
| Content definitions | Typed, validated, inspectable balance data and descriptions. |

### Simulation rules

- Prefer one coordinated frame driver. Use a controlled timestep with bounded catch-up and a deliberate slow-frame policy; do not let a large resume delta advance combat.
- Platform suspension is separate from a gameplay phase. Resuming the platform must not dismiss a level-up or manual pause. Include UI timers and CSS/Web Animations as well as simulation, rendering and scheduled audio in the suspension audit; use platform lifecycle callbacks for platform pause authority.
- Resolve terminal events before applying further rewards/attacks. Every public action validates its phase and run identity.
- Give entities stable IDs independent of pooled array indices so projectile hit history survives slot reuse safely.
- Separate gameplay RNG streams from cosmetic/audio randomness. Seeded testing must not change because rendering uses another random number for shake.
- Use explicit discriminated attack/effect types rather than optional coordinate fields or ad hoc `_orbCd` properties.
- Centralize formulas and generated descriptions. Validate every ID, evolution pairing, wave entry, rank and effect parameter at build/test time.
- Treat error handling as a recovery design. Repeating console errors every frame is not reliable fault tolerance.

### Development tooling

Add a developer-only scenario launcher: chosen hunter/save profile/build, minute, boss, density, seed, invulnerability and visible hitboxes. Mark debug runs and disable debug access/scoring hooks in release builds as appropriate. Time skip is a scenario tool, not an equivalent full run.

Keep detailed instrumentation local during development. External analytics must be a separate decision and must respect Playables restrictions. Exportable QA results should contain game diagnostics rather than personal data.

## 17. Performance, stability and battery use

Do not change engines or increase pool sizes blindly. Profile representative scenes on declared test devices first.

Measure simulation, collision queries, rendering, React updates, audio allocation, garbage collection, load time and memory separately. Use percentile frame times and long tasks, not average FPS alone.

Source-level areas worth profiling:

- Repeated full-pool scans, temporary arrays and spatial-grid allocations.
- Dynamic gradients, shadows and filters in busy rendering paths.
- Canvas resolution/device-pixel-ratio choices and oversized desktop viewports.
- Noise-buffer creation and simultaneous audio nodes.
- Prop-cache clear/rebuild behavior during long travel.
- Offscreen effect processing, damage-number density and HUD object creation.

Existing pooling, sprite caching, spatial partitioning and approximately 10 Hz HUD updates are useful foundations. Preserve them where measurements support them.

Define graceful saturation: decorative particles may be omitted; required chests must not disappear; hostile attack capacity must not silently change difficulty. Aggregate distant XP while preserving value and visibility. Use quality settings that reduce cosmetic cost without changing enemy counts, damage or attack warnings.

Provisional internal goals: smooth 60 FPS on the reference desktop and capable mobile device, a stable 30 FPS quality mode on a declared lower-end device, no repeated long stalls, no sustained memory growth across retries, and no gameplay/resource scheduling during platform suspension. Record exact hardware/browser and scenario with each result; these goals are not current measurements.

Run thermal/battery sessions on phones and a repeated-retry leak test. Test background/resume, resizing, orientation changes, audio interruption, unavailable storage and failed assets. Peak JavaScript heap must also satisfy the current Playables limit; maintain substantial headroom. [Stability requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability)

## 18. Website, standalone and YouTube Playables delivery

Share game code through separate entry points. Preserve the Next.js website and existing standalone format; create a dedicated Playables archive with `index.html` at its root and relative local asset references. Declare missing build dependencies, generate fresh CSS, and fail on incomplete output. Test each artifact independently. [SDK setup](https://developers.google.com/youtube/gaming/playables/reference/getting_started), [file requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability)

For Playables: load the SDK before game code; signal loading and actual interaction readiness; use SDK cloud saves after successful loading; make platform audio authoritative; suspend execution through SDK lifecycle callbacks while preserving the current game state. Do not substitute Page Visibility callbacks for its lifecycle. Treat master-mute removal and run-ending UI review separately from mandatory integration behavior. [Integration requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration)

Bundle licensed fonts locally or use system fonts. Audit runtime requests and test the published CSP. The documentation's Google Fonts allowlist does not resolve every policy interpretation; local fonts remove the dependency. [Privacy requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_privacydata), [test guide](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide)

Local SDK execution is a no-op, so use a controlled adapter harness for lifecycle/storage failure tests and the official test environment when accessible. Document the difference between local success and platform validation. [SDK setup](https://developers.google.com/youtube/gaming/playables/reference/getting_started)

Keep English, support complete touch/mouse interaction and responsive layouts, and review launch metadata, asset rights and content suitability before submission. No shortened run is implied by these requirements. Portal access and certification remain separate from package creation; no certification claim before approval. [Design requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_design), [language requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_i18n_l10n), [Developer Portal](https://developers.google.com/youtube/gaming/playables/developer_portal)

Before a release, prepare accurate gameplay screenshots, description, control help and thumbnails under the platform's current metadata rules. Keep an asset/license register, a versioned changelog, known-issues list and save-compatible rollback procedure. After release, prioritize crash/save reports, device regressions and balance outliers; request useful seed/build/version details through an appropriate support route without adding unsolicited external telemetry.

Planned commands should be explicit, for example `build:web`, `build:standalone`, `build:playables`, `typecheck`, `lint`, `test:engine`, and `test:integration`. These names are proposed; they do not currently exist. The web serving command must match static-export deployment rather than implying a server runtime the artifact does not have.

## 19. Measurement and balancing workflow

### Instrument before tuning

Capture local per-run/per-minute diagnostics:

| Area | Measurements |
| --- | --- |
| Combat | Effective damage, overkill separately, damage by weapon/target type, target uptime, control uptime, incoming hits/source, effective healing |
| Difficulty | Survival milestone, death reason, enemy density/cap time, attack overlap, boss duration, reaction windows |
| Progression | XP spawned/collected, levels, offered/selected items, evolution readiness/time, uncollected/lost rewards |
| Economy | Gold by source, amount banked, first purchase timing, purchase order, abandoned-run outcome |
| Experience | First-action/first-choice timing, modal duration, confusing choices, accidental input, retry friction |
| Performance | Frame-time percentiles, long tasks, allocation/memory trend, active entity/audio counts and pool saturation |

Current aggregate damage includes overkill, so it cannot serve as effective DPS without correction. Record simulated run time and real elapsed session time separately. Compare save profiles, input device, experience level, hunter and mode; a pooled win rate can hide major imbalance.

### Experiment sequence

1. Reproduce and fix deterministic correctness faults.
2. Establish a corrected baseline with stable seeds and fixed test scenes.
3. Test movement/visibility independently from balance.
4. Tune early survival and first meaningful choices.
5. Tune weapons and passives in fixtures, then combined builds.
6. Tune enemy budgets, XP and boss pacing across full natural runs.
7. Tune permanent progression against actual earned gold and player learning.
8. Add one new mechanic, compare against baseline, and remove/rework it if it adds confusion without interesting decisions.

Use automated bots only for deterministic regression and rough comparisons; they cannot establish fun or human fairness. Begin human testing with a small mix of new and experienced players, record qualitative problems, and expand quantitative samples before making strong claims. Do not invent target win rates as if they were measured facts.

## 20. Verification matrix and release gates

### Engine regression fixtures

- Retry same hunter, switch hunter, buy meta ranks, take passive/chest, consume revive; verify every resulting stat.
- Death + chest, death + XP, death + pending victory, boss death + queued attack; one legal terminal result.
- Arrow distinct-target hits and recycled entity IDs; orb damage independent of unrelated projectile count.
- Every weapon rank/evolution and advertised passive effect; numeric resolution matches description.
- Spatial query versus brute force, grid boundaries, large elites, teleports, fast projectiles and moving targets.
- Freeze/slow/knockback/pull combinations with explicit precedence.
- Full pickup pool and all other pool limits; no lost required reward or unexplained missing attack.
- Pause during every delayed attack and modal, restart before callback, dispose twice, rapid retry; no stale work.
- Same seed and inputs across render rates produce equivalent simulation; rendering alone never changes state.

### Save and economy fixtures

- Empty, old, malformed, truncated and future-version saves; unknown IDs, null fields, invalid ranks and invalid numeric values.
- Failed/slow load, failed save, rapid purchases, overlapping writes and repeated settlement; no overwrite/duplication.
- Crash after a successful reward checkpoint but before final settlement, then reopen and settle: already credited gold remains exactly once. Test stale same-run saves and enforce/document the supported session-conflict policy.
- Gold source multipliers and rounding; every advertised permanent rank has the intended benefit.
- Migration preserves owned content/currency/settings; rollback and incompatible active-run recovery are documented.
- Snapshot/resume, if implemented, at every phase; reward credit remains exactly once.

### UI/device matrix

At minimum: 320×568, 390×844, 844×390, tablet portrait/landscape, 1280×720, 1920×1080, and wide/short/extreme aspect-ratio stress cases. Test browser zoom/text scaling and safe areas as applicable. Platform requirements cover more than these representative samples.

Every screen must scroll where necessary, maintain state on resize, and keep essential actions reachable. Test all four hunters, shops with long text, three/four-choice drafts, multi-reward chests, boss warnings, pause and both outcomes.

Use desktop browser coverage plus physical Android/iPhone touch and WebView/app testing when available. Emulation is supplementary. Inspect both fresh and maxed saves. Test keyboard, mouse-only and touch-only completion of the full UI flow.

### Gameplay/content gates

- Complete natural Classic runs and all bosses with multiple representative builds; debug-skipped runs do not replace these.
- Demonstrate a skill-based fresh-save win route for each hunter, with viable alternative builds rather than one mandatory weapon; investigate weak roles and document any intentionally specialized challenge constraints.
- Review full-length pacing, recovery windows, repeated sessions, and actual post-fix evolution timing.
- Test dense six-weapon scenes, low health and boss telegraphs under normal/reduced effects.
- Validate the proposed ritual/trait in isolation before expanding it.
- Finish asset provenance, metadata and relevant content review before submission.

### Build/release gates

- Build, typecheck and agreed lint checks pass; warnings are fixed or explicitly justified.
- Clean-install builds are reproducible; no hidden global dependencies or stale CSS.
- Website, `game.html` and Playables ZIP are each opened/tested from their generated output.
- ZIP has correct root, valid paths/names, expected file count/size and no unwanted development artifacts.
- Runtime network/CSP audit passes for the intended platform.
- Actual platform tests and physical-device limitations are recorded; never label unperformed tests as passed.

## 21. Phased implementation roadmap

Effort bands describe relative scope, not calendar promises: **S** localized change, **M** one substantial system, **L** multiple systems plus testing, **XL** expansion requiring its own prototype and rebalance.

| Phase | Scope | Dependencies | Deliverable / exit gate | Effort |
| --- | --- | --- | --- | --- |
| 0. Baseline and tools | Capture regression fixtures, local metrics, scenario launcher, build/lint baseline | None | Repeatable reproduction cases and baseline records; no balance claims from broken mechanics | M |
| 1. Run and combat integrity | F01–F18, finale handoff, reward arithmetic, state validation, pool guarantees, critical save validation | Phase 0 | Terminal/state/save tests pass; every weapon rank has intended semantics | L |
| 2. Controls and readable play | Pointer controls, facing experiment, input resets, camera/spawn policy, scroll-safe UI, essential accessibility | Phase 1 state/input boundaries | Full mouse/touch/keyboard flow and fair readable encounters across representative viewports | L |
| 3. Existing-content balance | Weapon niches, passive stacking, XP cadence, enemy budgets, bosses, fresh/partial/max-save economy | Phases 1–2 and instrumentation | Natural-run evidence, published balance rationale, no known dead upgrades or obvious forced build | L |
| 4. Progression and player journey | Build view, recipes, bounded rerolls, result/death recap, banking, shop clarity, onboarding/settings | Phases 1–3; some UI work can overlap Phase 2 | Players understand choices/rewards; repeated sessions retain correct progress | L |
| 5. Platform and packaging | Adapters, SDK lifecycle/cloud/audio, local fonts, three build targets, CSP/network/archive checks | Phase 1 lifecycle/save contracts | Website regression passed, standalone rebuilt, local Playables candidate ZIP and validation report | L |
| 6. Identity and depth | Prototype hunter trait, one Covenant encounter, journal/mastery, art/audio polish | Stable corrected baseline; Phase 3 evidence | Feature proves useful in playtests and stays within readability/performance budgets | L |
| 7. Release candidate | Full matrix, long runs, device profiling, migration/rollback, content/rights review, platform tests when accessible | Phases included in chosen release | Concrete checklist and known-issues report; ready for separate release decision | L |
| 8. Expansion | Additional arenas/hunters, seeded challenges, shorter/endless modes, controller/advanced accessibility | Successful first upgrade and actual player feedback | Separate scoped design and acceptance gates per feature | XL |

Phase 3 establishes an initial corrected balance baseline. Rerolls/skips in Phase 4 and traits/Covenants in Phase 6 change power acquisition and encounter outcomes; each included feature requires a fresh full-run balance pass before the release candidate.

Platform adapter contracts should be designed in Phase 1 even if final packaging is Phase 5. Essential accessibility ships with controls/UI. Do not postpone save integrity or mandatory input compatibility until the final release week.

Good parallel work after contracts are stable: UI screens, asset/icon consistency, packaging validation, and pure content analysis. Keep state-machine, reward/persistence and combat-timing edits coordinated because their invariants overlap.

### First implementation batch

Start with the smallest coherent set that makes future work reliable:

1. Add focused regression fixtures for stat carryover, terminal-state collisions, projectile hits, delayed attacks and reward loss.
2. Introduce run identity, immutable base stats and exactly-once termination/settlement.
3. Replace wall-clock combat delays and make rendering read-only.
4. Correct collision/tick/upgrade formulas and critical reward handling.
5. Validate saves and add safe storage-readiness/error behavior.
6. Re-run baseline builds/tests and document the corrected mechanics before adjusting balance values.

This batch is intentionally focused. It provides the trustworthy foundation required for the larger gameplay upgrade.

## 22. Risks, decisions and deferred ideas

| Decision / risk | Recommended treatment |
| --- | --- |
| Bug fixes reduce familiar damage output | Correct mechanics first, then retune and explain changes; do not preserve an exploit accidentally as a balancing dependency. |
| Camera changes alter difficulty | Evaluate threat reaction time and aiming across screens; do not combine with major enemy-stat changes in the same experiment. |
| New traits create dominant combinations | Add one trait at a time with explicit caps and build-pair tests. |
| More visual effects hide counterplay | Enforce the readability hierarchy and dense-scene acceptance gate. |
| More content delays fixing the core | Limit the first upgrade to existing content plus a small validated feature slice. |
| Active-run saves become too complex | Ship reliable permanent progress first; use an explicit snapshot contract and compatibility policy before promising resume. |
| Economy changes devalue prior purchases | Preserve owned ranks/content; document migration and refunds/compensation where needed. |
| Shorter sessions are desirable | Prototype an additional mode later; preserve Classic and separate its records/rewards. |
| Global rankings invite cheating and service work | Keep personal records/seeded local challenges first; online competitive infrastructure is a separate project. |
| Monetization changes incentives | Defer until the game is satisfying and platform/business scope is explicit; do not introduce pay-to-win upgrades. |
| Multiplayer/cloud accounts expand architecture | Out of the initial upgrade. They are not required for Playables compatibility or a strong single-player game. |
| Exact balance numbers are unknown | Mark proposed values as hypotheses; determine them from corrected fixtures and human runs. |

Decisions to revisit at the relevant milestone: eight-direction versus continuous sword aim; whether and how to add a dodge; the banking/abandon presentation; the first hunter trait; the first Covenant reward; exact progression targets; active-run resume scope; reference devices; and which optional expansion deserves development after the core release.

The recommended next step is Phase 0 followed immediately by the first integrity batch. The desired result is a game whose controls, rules and rewards can be trusted, then a deeper game whose choices and pacing have been demonstrated through play.
