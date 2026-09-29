# Changelog

## 0.2.1 — follow-up local candidate, September 29, 2026

Not deployed or certified. See [the follow-up verification](docs/verification-2026-09-29.md).

- Corrected boss XP Growth, freeze/slow priority, swept projectile contact order, Fireball impact position, Void Sphere spatial queries and Hunter’s Oath boss damage. Restored and live drafts now enforce equipment slots and exact upgrade eligibility.
- Hardened save conflict handling, lost-write-acknowledgement recovery and stale SDK lifecycle completions. Unreadable primary saves no longer offer an unusable backup action; malformed run timestamps preserve permanent progress.
- Fixed keyboard focus around save errors, suspension and mandatory recovery; released movement on resize; preserved YouTube’s ownership of Escape. Improved text contrast and comfort settings.
- Blended hit flashes over enemy artwork and strengthened the hunter outline after reviewing an actual dense-combat capture.
- Added isolated save-failure tooling, bounded frame/simulation diagnostics, a separate QA build, a safer local preview server and an Android/iPhone test guide. Production builds exclude the QA interface.
- Completed 24 legal-build bot cases: 22 wins and two early Reaper defeats. These are diagnostic results, not proof of human balance; first-minute Reaper play and late surplus-draft pacing remain explicit review targets.

The save profile schema remains 2. No permanent prices, owned ranks or published damage values were retuned from bot results alone.

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
