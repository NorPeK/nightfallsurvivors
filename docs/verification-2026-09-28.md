# Candidate verification — September 28, 2026

Version 0.2.0. This records checks actually performed and the limits of that evidence. It is not a YouTube certification report.

## Local automated checks

Host: Apple M4, 16 GB RAM, macOS; Node v24.19.0, npm 12.1.0. Other development workloads were active, so wall-clock timings are not device-performance benchmarks.

| Check | Result |
| --- | --- |
| TypeScript, final integrated source | Passed. |
| ESLint, entire repository | Passed with no reported errors or warnings. |
| Normal regression suite | 100 passed, 0 failed; one opt-in long fixture skipped here and passed separately. |
| Continuously stepped Classic fixture | Passed: 1,815 simulated seconds, all 14 elites, seven swarms and three bosses through victory. Explicitly assisted build; never evidence of natural-player balance. |
| Website, standalone and Playables builds | All passed; final archive validation passed. |
| Clean install and independent bundle reproduction | Passed in an isolated temporary directory; both standalone and ZIP match the primary build. ZIP also matches across two timezones. |

The normal suite covers 40 engine, 29 persistence, 12 platform, four audio, four input, six rendering, two archive and three content tests. Engine snapshots retain recycled pool-slot order as well as seeded RNG, and rendering is checked for state invariance. The final change after these tests was evolution-card display copy only; TypeScript, ESLint and all builds passed again afterward.

Final standalone: **404,916 bytes**. Final Playables ZIP: **128,794 bytes**, five files and **408,119 uncompressed bytes**. SHA-256:

```text
751a086403dfa8897a29245331c52997deb381934bc6b8e7ea59831708821ccd
```

See [clean-build evidence](clean-build.md) for reproduction details. Wall-clock host timings do not establish phone frame time or memory use.

## Browser observations

Chrome checks used isolated local preview origins and the development lab's disposable profile. The Playables preview used the real SDK's local no-op behavior under the restrictive local CSP; it did not exercise YouTube cloud storage.

| Surface | Observed result |
| --- | --- |
| Playables preview, 390×844 | Menu, settings, named volume sliders, reduced-motion control, all hunter cards, Lyra's opening combat, pause, ending the hunt, recap and shop were reachable. Preview audio ownership/help text was correct. |
| Playables preview, 844×390 | Build/settings panels scrolled to their bottom actions. Paused timer stayed at 00:25 through navigation. The ended hunt reported 26 kills and 158 damage. |
| Isolated QA, 320×568 | Three-card draft scrolled; reroll count changed from three to two. Chest rewards scrolled and Continue remained reachable. |
| Isolated QA, 1024×768 | Six eligible evolutions displayed; choosing Absolute Zero opened its reward chest. An inaccurate “level 1” evolution heading found here was corrected to “Evolution · max weapon.” |
| Isolated QA, 844×390 | Covenant offer described 12 kills in 45 seconds; accepting displayed the marked ritual circle and matching objective HUD. Reward completion was covered by tests, not this UI visit. |
| Isolated QA, 1280×720 | Forced victory → Hunt again reset Aldric to Sword Wave level 1, 120 HP and time zero. Forced defeat showed recap and recovery actions. These shortcuts do not verify natural wins/deaths. |
| Isolated QA shop | Buying Might deducted exactly 150 gold and raised rank to one; confirmed refund restored all 150 gold and rank zero. No real profile was touched. |
| Exported website, desktop | Reload/resume restored an actual paused Aldric hunt at 00:08, 104/120 HP, two XP and three kills, still paused with the same build. |
| Standalone served over HTTP | Menu, journal and all eight evolution recipes loaded; 390×844 menu inspected. Direct `file:` navigation was blocked by the browser automation security policy and was not bypassed. Direct-file operation remains a manual gate. |

These visits prompted corrections to a save-status overlay, slider names, Playables pause help, favicon and evolution-card wording. The automated Playables tab's captured warning/error log was empty during its completed visit. A separate native Chrome preview emitted a generic iframe sandbox warning; its source was not established and it must be rechecked in the official environment. No gameplay JavaScript exception was observed. The final copy-only rebuild was reloaded successfully at the menu. Browser control initially suffered contention but the selected checks above were subsequently completed; the remaining full device/failure matrix is not marked passed. No other project's files or processes were changed.

## Evidence that remains open

- Complete all-screen keyboard/touch/failure/recovery coverage on generated artifacts, direct-file opening, tablet portrait and wide/short stress sizes. The selected responsive visits above do not establish the whole matrix.
- Natural full runs with every hunter and representative permanent progression; dense visual clarity, balance and audio listening.
- The owner's Android and iPhone: exact models, OS/browser, touch, interruptions, frame time, heap, battery/thermal and repeated-session results.
- Actual YouTube Dev Link/test suite, cloud saves and app lifecycle. The owner currently has no portal access.
- Accurate final gameplay screenshots, required thumbnails and owner/publisher/rights confirmation.

Use [the release checklist](release-checklist.md), [balance evidence](balance-audit.md), and [save compatibility policy](save-policy.md) to finish these gates against the exact ZIP checksum. Do not deploy or submit this candidate on the strength of automated tests alone.
