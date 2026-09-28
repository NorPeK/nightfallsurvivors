# Changelog

## 0.2.0 — local candidate, September 28, 2026

Not deployed or certified. Physical-device, human balance and official YouTube checks remain release gates; see [the verification record](docs/release-checklist.md).

- Corrected all 27 baseline defect categories: run stat carryover, terminal races, delayed attacks, save validation, lost rewards, repeat projectile hits, damage cooldown interactions, collision bounds, attack geometry, effect formulas, freeze, warnings, rendering, suspension, controls, layouts, gold, finale scaling, spawning, packaging and fatal-error handling.
- Added fixed-step seeded simulation, validated resumable hunts, ordered saves, backup recovery, exactly-once reward banking and recorded-cost refunds.
- Added four hunter traits, an optional ten-minute Covenant, reroll/skip/banish tools, evolution choices, resolved upgrade previews, journal, mastery, achievements and run recaps.
- Smoothed the two XP requirement cliffs, corrected Fire coverage, and gave evolved Frost a recovery gap. Detailed diagnostics and their limits are in [the balance audit](docs/balance-audit.md).
- Added spaced admission of authored elites/swarms around bosses and rituals, prioritized offscreen markers, and redraw-on-demand for frozen scenes.
- Added complete pointer movement, movement-based facing, a consistent logical camera, clearer hostile warnings, responsive scrolling, keyboard focus and configurable comfort/touch/audio settings.
- Added a YouTube platform adapter with authoritative audio/lifecycle handling and cloud storage, separate from browser progress. Local SDK preview is explicitly temporary.
- Added separate website, self-contained HTML and validated Playables ZIP builds, runtime license notices, checksums, regression tests and developer-only isolated scenarios.

Save profile schema is 2. The existing browser key is preserved. Older builds must not be used as a blind rollback; follow [save compatibility guidance](docs/save-policy.md).
