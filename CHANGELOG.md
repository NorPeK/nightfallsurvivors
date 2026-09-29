# Changelog

## 0.5.0 — permanent Evolutions slots, September 29, 2026

The shop can now expand evolution capacity from one to six per hunt. See [the feature and verification record](docs/evolutions-shop-0.5.0.md).

- Added five permanent Evolutions ranks, each unlocking one additional slot. Rank prices are 1,000, 2,000, 4,000, 8,000 and 16,000 gold; purchases persist and refunds use the exact recorded spend.
- Captured evolution capacity at hunt start. Later shop purchases apply to the next hunt, while a resumed hunt retains its original capacity. Weapon rank, passive partner and chest requirements still apply.
- Updated chest eligibility, evolution choices, recipes and capacity displays for the purchased limit. The 0.4.0 combat and progression changes remain.
- Added engine-snapshot-v4 compatibility: version-3 hunts receive one slot without changing HP, XP or pending attacks; older runs retain their previous migration. Existing profiles without an Evolutions rank default to one slot.

Profile schema stays 2. Older builds must preserve Evolutions ranks and paid costs before writing these profiles; see [save compatibility and rollback](docs/save-policy.md). Local candidate only; no deployment or certification is claimed.

## 0.4.0 — playtest difficulty pass, September 29, 2026

Implements the owner's stationary-play, oversized-evolution and early-full-build feedback. See [the difficulty audit](docs/difficulty-update-0.4.0.md) for measurements and limits.

- Quadrupled all main/mini-boss health. Ordinary enemies scale continuously through the hunt; a new type enters every two minutes, including three new silhouettes. Faster brutes and warned ranged/ground attacks keep pressure in mixed waves.
- Limited each hunt to one evolution. Reduced evolution damage/cooldown bonuses, shrank Meteor Storm and Void Sphere, and removed Void Sphere pulling completely.
- Slowed later XP levels and limited ordinary chest rewards to one equipment rank plus gold. A normal-damage, survival-assisted probe completed its build at 30:01.52, with 48 of 78 equipment ranks at minute 17. This remains a human pacing target, not a guarantee.
- Fixed pickup saturation: consolidate older matching pickups to free a slot for new loot at the kill location, preserving XP, gold and stacked consumables/chests. Queues remain bounded.
- Made rituals require 60 shrine kills and at least 30 seconds survived within 45 seconds, with a smaller circle, mixed reinforcements and ground attacks. Reduced damage blessings to 10% and meat protection to half a second.
- Preserved hostile warnings under visual-effect saturation; attacks wait if a complete warning cannot fit. Updated UI rules and corrected stale ritual completion text found in browser QA.
- Added engine-snapshot-v3 migration, preserving permanent progress, XP-bar fraction, first earned evolution and live boss health percentage. Added 26 regressions; all 169 regular tests and the separate assisted full-run fixture pass.

Eight normal-health bot cases produced seven defeats and one still-alive finale at the 31-minute horizon. No normal bot victory is claimed; the first-minute Knight result and broad balance remain playtest targets. Profile schema stays 2. Start a fresh hunt to assess the new pacing; permanent upgrades are retained.

## 0.3.0 — expanded boss encounters, September 29, 2026

Local candidate; not deployed or certified. See [the boss update and verification](docs/boss-update-0.3.0.md).

- Added twelve named mini-bosses at minutes 1, 3, 7, 9, 11, 13, 17, 19, 21, 23, 27 and 29, with warned charges, volleys or ground slams, growing combat budgets, control resistance, XP and gold rewards.
- Expanded main bosses to minutes 5, 10, 15, 20, 25 and 30 with the Blood Warden, Dread Knight and Void Seer. A live main boss is preserved while the next main queues; minis can overlap main fights.
- Added the next-encounter HUD, all eighteen encounters in the Journal, mini-boss name/health plates, offscreen guidance and distinct main-boss colors.
- Reserved encounter capacity, thinned routine enemies during fights, and scheduled Covenant offers around the denser boss timetable. Existing dawn cleanup and Death victory rules remain.
- Added snapshot-v2 migration and encounter history preservation. Older active hunts skip newly introduced historical encounters without receiving unearned rewards.
- Passed 143 regular regressions, the separate assisted full Classic fixture, typecheck, lint, production/QA builds and package validation. A bounded fresh Knight bot defeated all eighteen bosses; broader human/device balance and the new visual walkthrough remain open.

The profile schema remains 2. Nested engine snapshots are now version 2; follow [save compatibility guidance](docs/save-policy.md) before rolling back.

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
