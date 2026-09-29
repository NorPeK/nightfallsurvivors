# Release candidate verification

Status: **local implementation candidate built and audited; release gates remain open; not submitted or certified**. The owner confirmed no Playables Developer Portal access yet, and availability of Android and iPhone for physical playtests. Device models and results are still to be recorded. Do not turn an unperformed check into a pass.

## Automated checks

Run against the final source and retain output with the candidate manifest:

```sh
npm ci
npm run typecheck
npm run lint
npm test
RUN_LONG=1 node --import tsx --test tests/engine.long.test.ts
npm run build:all
npm run validate:playables
```

Latest local result (0.5.0, September 29): **188 normal tests passed**; the optional long Classic fixture was skipped for this shop change (last passed on 0.4.0). TypeScript, ESLint, all three production builds, QA build and archive validation passed. See [the Evolutions shop verification](evolutions-shop-0.5.0.md) for artifact hashes and observed UI results. Clean-install/alternate-time-zone reproduction was performed on the previous 0.2.1 candidate; those [historical results](reproducibility-2026-09-29.md) are not a fresh 0.5.0 reproduction claim.

The normal suite covers combat defects, terminal ordering, pool saturation, input resets, persistence/migration/recovery, snapshot restoration, platform lifecycle/audio, content and archive constraints. The optional long fixture continuously steps the authored Classic schedule with an explicitly assisted build. Neither is a human balance test.

The [current difficulty audit](difficulty-update-0.4.0.md) records eight normal-health cases (seven defeats, one alive at the 31-minute horizon), a survival-assisted progression probe that finished equipment at 30:01.52, and stationary/orbit comparisons. Early Knight survival and whether this pass overshoots difficulty need human review. Old 0.2.x/0.3.0 win rates are historical. Boss durations, first evolution, mini/main overlaps, ritual fairness and Dawnless's final-minute window remain explicit targets. Save command parameters with output; hunter/profile/duration/AI policy materially change interpretation. No telemetry is transmitted.

## Artifact checks

| Artifact | Required check |
| --- | --- |
| Website `out/` | Serve with `npm start`; complete menu → hunt → pause → result → shop → retry; reload a compatible checkpoint. |
| Standalone `game.html` | Open fresh generated file directly; complete the same flow. Test storage errors separately because `file:` persistence varies by browser. |
| Playables ZIP | Validate archive, inspect relative references, load with `npm run preview:playables`, confirm session-preview notice and no master mute. |
| Actual YouTube release | Use portal Dev Link and test suite; cloud reload, platform pause/resume/mute, embedding, input, memory and network must pass there. Local no-op SDK behavior does not verify these. |

The local preview CSP is deliberately stricter than the published example (no unsafe eval, remote fonts or workers). Test the exact published policy in the official environment as well. See [the test-suite guide](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide).

## UI and device matrix

Version 0.5.0 received isolated Chrome QA checks at 1470×742: all five Evolutions purchases, maximum-rank lock, a new hunt with six slots, and an exact 31,000-gold refund. Most observations below predate this candidate. Version 0.4.0 received selected checks of one-evolution choices, reduced Meteor Storm impacts, mixed enemies and rituals. These are temporary/forced scenarios, not full-run balance evidence. Full responsive, touch, assistive-technology and production-target coverage must still be completed on the current build. Assess natural balance and sustained performance with purchased two-to-six evolution capacity separately from the previous one-slot measurements.

For each row, record browser/OS version, screenshot, input method and pass/fail for menus, shop, drafts, chest/evolution, ritual, pause/build/settings/journal, defeat and victory. Check scroll reachability, focus, pinch/zoom behavior, safe areas, orientation, hostile warnings and pointer cancellation. Emulated touch is supplementary.

| Environment | Status |
| --- | --- |
| Development Chrome desktop, Apple M4 / 16 GB host | Isolated QA defeat, victory/retry, purchase and exact refund observed. Forced scenarios are not natural full-run evidence. |
| Chrome responsive 320×568 | Earlier draft/chest scrolling; final 0.2.1 standalone blocked-save purchase → visible Retry → durable reload passed in isolated storage lab. Keyboard wrap through Retry also observed. Full generated-artifact/input matrix remains open. |
| Chrome responsive 390×844 and 844×390 | Playables menu/settings/hunter/hunt/pause/end/recap/shop and build-panel scrolling observed; timer remained frozen. Isolated Covenant acceptance observed. |
| Tablet portrait/landscape | Earlier 1024×768 isolated evolution/chest; baseline export 768×1024 menu/settings and keyboard return observed September 29. Final expanded viewport recheck was limited by intermittent browser-control timeouts. |
| Desktop 1280×720, 1920×1080, wide/short stress | Final QA dense capture and a short 227-frame diagnostic recorded at 1280×720. Final website retained the paused 00:08 saved hunt. Baseline export settings at 1920×540 and pause at 320×1138 were reachable. Full final 1920×1080/wide/short matrix remains open. |
| Android physical device | Owner has a device; model/browser/results pending. |
| iPhone physical device | Owner has a device; model/iOS/results pending. |
| YouTube desktop/mobile web, Android/iOS app | Blocked by portal onboarding/access, not marked passed. |

## Physical-device test card

Use [the phone playtest guide](phone-playtest.md) for the same-Wi-Fi command and a per-device result form. No LAN server or public deployment is started by writing that guide.

1. Start with a fresh test profile. Without coaching, move, collect XP, choose an upgrade, pause, inspect a recipe and return to play. Record confusing steps.
2. Play one complete Classic run on each phone. Record hunter, permanent ranks, weapons, evolution times, boss durations, death cause and whether warnings left a clear escape route. Include fresh, partial and full progression over subsequent runs.
3. Repeat with reduced effects, motion/flash disabled, high contrast and opposite-side fixed joystick. Verify pointer cancellation, multiple touches and scrolling without accidental movement or choices.
4. Interrupt during a draft, chest, boss windup and manual pause. Restore the app and ensure that phase stays intact, no attack jumps forward and controls are released.
5. Disable device/platform audio, resume, then change in-game music/effect sliders. Muted output must remain silent. Listen for clipping or fatigue in dense late-game combat when audio is enabled.
6. Confirm gold and shop ranks after defeat, ending a hunt, reload and failed-save retry. Save failure must remain visible. Do not clear real progress to test corruption; use isolated test profiles.
7. Run three consecutive hunts/retries and a full-length thermal session. Record heat, battery change, frame-time percentiles, long stalls and heap trend with exact hardware. No sustained leak or repeated crash is acceptable.
8. Repeat cloud and lifecycle steps using the official YouTube Dev Link once access exists. Export test-suite results and attach the exact candidate ZIP SHA-256.

## Acceptance that needs human evidence

- Each hunter has a viable skill-based fresh-save win route and useful alternative builds.
- Early choices, evolutions, enemy pressure, recovery windows and boss durations feel deliberate across the entire Classic run.
- Six-weapon combat preserves the hunter silhouette, hostile projectile shapes and true telegraph bounds.
- The Covenant stays optional and traits create understandable choices without becoming mandatory combinations.
- Menus are usable by keyboard/mouse/touch; sound is optional. Full nonvisual canvas gameplay support is not claimed.

## Publication preparation

- [ ] Confirm owner/publisher/developer details and rights to the existing game/name.
- [ ] Capture accurate final-build gameplay images and create portal-sized thumbnails after checking current metadata specifications.
- [ ] Finish fresh-save and repeated-session human playtests; triage every repeatable crash/save/input issue.
- [ ] Record physical device, browser and performance evidence above.
- [ ] Obtain Playables onboarding/portal access; complete official verification.
- [ ] Review metadata, known issues and save-compatible rollback with the exact release candidate.
- [ ] Submit only after explicit release authorization; no upload/deployment is performed by this upgrade task.

Portal access is currently invitation based and requires an onboarded channel. See [Developer Portal prerequisites and verification](https://developers.google.com/youtube/gaming/playables/developer_portal). Size/memory/platform constraints must be checked against [current stability requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability); lifecycle/cloud/audio behavior against [integration requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration).
