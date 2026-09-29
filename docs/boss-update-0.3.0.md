# Boss expansion — version 0.3.0

Implemented September 29, 2026. This local candidate adds the requested twelve mini-bosses and six main bosses. It is rebuilt and passes the automated gates below. No deployment, YouTube submission or certification has occurred.

## Encounter schedule

| Minute | Encounter | Type / signature |
| ---: | --- | --- |
| 1 | Gravefang | Mini — committed charge |
| 3 | Bonehex | Mini — projectile fan |
| 5 | Korgath, the Bone Colossus | Main — existing Colossus fight |
| 7 | Webmaw | Mini — ground slam |
| 9 | Mourningveil | Mini — projectile fan |
| 10 | Varkos, the Blood Warden | Main — charge and fan |
| 11 | Ashmaw | Mini — committed charge |
| 13 | Gorebell | Mini — ground slam |
| 15 | Maltheor, the Hollow Lich | Main — existing Lich fight |
| 17 | Duskwing | Mini — committed charge |
| 19 | Bloodcantor | Mini — projectile fan |
| 20 | Rhazek, the Dread Knight | Main — charge and sequential slams |
| 21 | Pitbreaker | Mini — ground slam |
| 23 | Marrowking | Mini — ground slam |
| 25 | Nyxara, the Void Seer | Main — radial volley and offset slams |
| 27 | Nightreaver | Mini — committed charge |
| 29 | Dawnless | Mini — projectile fan |
| 30 | NORPEK, Death Incarnate | Main — existing final fight |

Mini-bosses have authored health, damage, speed and reward budgets increasing through the hunt. They resist freezing and knockback. Their warnings commit to the displayed path or impact area; killing the attacker cancels its pending attacks. Volley warnings show each projectile direction. Each mini awards XP and gold once; guaranteed evolution chests remain with elites and nonfinal main bosses.

Minis use independent enemy slots and may arrive during a main fight. An undefeated main boss keeps its slot, with later main bosses waiting in order. Routine spawn pressure drops during these encounters; support elites/swarms defer and keep a recovery gap. Pool saturation defers a mini without marking it delivered. Covenant offers need enough time for the 45-second challenge plus a 12-second buffer before the next scheduled encounter.

The existing 30-minute handoff remains: lesser enemies, including surviving minis, are cleared without rewards; a lingering main is settled through its reward path, and Death begins. Defeating Death remains the victory condition. Dawnless's final-minute window needs human pacing review.

## Presentation and saves

The HUD shows the next encounter. The Journal lists all eighteen fights and their attack guidance. Mini-bosses have enlarged sprites, a crown/rim, named health plates and prioritized offscreen markers. The new main bosses use distinct palettes on existing procedural sprite families. The isolated QA build can select every main and mini for testing; production builds exclude those controls.

Engine snapshots are now version 2; profile schema 2 and the active-run wrapper stay unchanged. Existing engine-v1 hunts skip newly introduced encounters whose minutes have passed, without receiving invented rewards or kill records. Future encounters follow the new schedule. New snapshots preserve minis, attack timers, delayed actions and projectile damage attribution. See [save compatibility](save-policy.md).

## Verification

| Check | Result |
| --- | --- |
| TypeScript / ESLint | Pass |
| Normal suite | 143 pass, 0 fail; one optional long fixture skipped here |
| Separate assisted Classic fixture | Pass: all 12 minis admitted, all 6 mains defeated, 14 elites and 7 swarms delivered; periodic checkpoint restore passed |
| Fresh-profile diagnostic | Knight seed 1 won at 30:21.24 and defeated all 18 bosses; Ranger alive at budget stop; Mage/Reaper not started |
| Combined main/mini CPU scene | Completed 20 simulated seconds without resource ceiling or pool errors; excludes browser rendering |
| Website / standalone / Playables / QA builds | Pass |
| Playables archive | Pass: SDK first, relative assets, five files |
| New browser visual walkthrough | Unverified: repeated browser-control connection/debugger failures prevented it |

The normal suite includes 13 new encounter regressions plus additional catalog, rendering and profile-history coverage. It covers exact schedule boundaries, main/mini overlap, main queuing, capacity deferral, reward uniqueness, attack ownership, legacy migration, snapshot round trips, control resistance and damage attribution. Full-run and resource-bounded raw evidence is linked in [the encounter diagnostic audit](encounter-diagnostics-2026-09-29.md).

The assisted fixture killed eleven minis; Dawnless survived until the dawn sweep. The normal-damage Knight bot killed all twelve. Neither result establishes human fairness. The previous 0.2.1 three-boss balance matrix and visual captures are historical. No fresh clean-install reproduction was performed for 0.3.0; dependencies did not change.

## Artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `game.html` | 423,211 | `306cdf220f769acf7e153832b6ecbacacbea9adb7b8a67543bec7c07998f6a96` |
| `dist/nightfall-survivors-playables.zip` | 134,334 | `89b24e05abd88ff6d8db1fee6be96cd1132dbb30f9ed74fd013f83d5f7b92897` |
| QA `qa-output/browser/index.html` | 627,658 | `cf07bc51f7dd29290f3cb7c0ef7e5834866a7690bdbb35c5b0ab5e6c57367016` |

The ZIP expands to 426,414 bytes across five files. The manifest contains per-file hashes. The QA artifact is isolated from normal saves and is not a release deliverable.

Human first-minute survival, overlapping warnings, encounter duration, chest/evolution pacing and final-minute targeting still need normal keyboard/phone play. Physical Android/iPhone testing and official YouTube checks remain on [the release checklist](release-checklist.md). The owner has both phone platforms but no portal access yet.
