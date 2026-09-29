# September 29 engine and balance audit

Baseline: clean commit `2f8a339` (`added changes to games`). This pass completed 24 distinct full-Classic bot cases after the authored encounter director changes, corrected reproducible engine defects, and added bounded simulation diagnostics. No weapon damage, enemy scaling or economy tuning was chosen from bot win rates.

## Concrete corrections

- **Growth and boss XP:** normal-enemy gems already included Growth, but boss gems ignored it. A base boss reward was 168 XP with both 1.0× and 1.25× Growth. Boss drops now apply Growth once, producing 210 XP at 1.25×.
- **Control priority:** Mage’s fourth-orb pulse changed frozen enemies from zero speed to half speed. It now preserves stronger control. Weaker slow effects also cannot extend a short freeze by donating their longer duration; stronger effects replace weaker effects, and equal-strength effects refresh duration.
- **Projectile contact order:** swept arrows could consume their hit against a farther grid-cell enemy before a nearer enemy or boss. Contacts now resolve by first surface intersection with stable entity-ID ties. Fireballs explode at the impact point rather than the far end of their sweep.
- **Pull and spatial queries:** multiple Void Sphere pulls could move a large enemy across a cell boundary and leave later projectiles querying the old cell. Broadphase padding now includes a conservative displacement bound until the next grid rebuild, without rebuilding the full grid for every orb.
- **Covenant consistency:** Hunter’s Oath now grants its advertised full-health first-hit bonus against bosses as well as ordinary enemies.
- **Restored draft integrity:** an inconsistent saved draft could offer a seventh weapon. Snapshot validation and live actions now enforce slot capacity, ownership, `isNew`, exact next rank, evolved/maxed status, banish state and evolution partner readiness. Invalid restores leave the active game unchanged.
- **QA fixture only:** full-build scenarios start at level 80 with zero current XP and the level-80 threshold, so dense late-game scenes do not immediately generate early-level draft chains. An explicit level-up scenario still opens its draft. Production progression is unchanged by this fixture setting.

All **50 engine regression tests passed**, including the seven new combat tests, ten malformed-draft variants, live action guards and the QA cadence test. Owned-file ESLint passed. The parent’s final integration/build gate is separate.

## Full-Classic matrix

The unchanged bot uses keyboard-equivalent normalized movement, a deterministic greedy build/steering policy, normal damage and legal permanent-upgrade values. It declines all Covenants and does not use rerolls, skips or banishes. Fresh means no permanent upgrades; Partial means two ranks per upgrade where available and no Revival; Max means every published permanent rank. Viewport: 1000×600 logical units. Seeds: 1 and 2. Horizon: 1,860 simulated seconds.

**22 victories and 2 defeats across 24 distinct cases; no horizon timeouts.** Every victory delivered all 14 elites, 7 swarms and 3 bosses. Every hunter has at least one successful fresh-profile bot route in this sample. This establishes mechanical reachability for those seeds and policy, not a human success rate.

| Profile | Victories | Winning final levels | Winning finale duration |
| --- | ---: | ---: | ---: |
| Fresh | 7/8 | 183–191 | 12.97–23.73s |
| Partial | 7/8 | 188–200 | 13.93–20.89s |
| Max | 8/8 | 185–213 | 12.86–17.93s |

| Hunter | Seed | Fresh | Partial | Max |
| --- | ---: | --- | --- | --- |
| Knight | 1 | Win 30:17 | Win 30:14 | Win 30:13 |
| Knight | 2 | Win 30:15 | Win 30:19 | Win 30:15 |
| Ranger | 1 | Win 30:20 | Win 30:18 | Win 30:16 |
| Ranger | 2 | Win 30:12 | Win 30:17 | Win 30:16 |
| Mage | 1 | Win 30:17 | Win 30:13 | Win 30:12 |
| Mage | 2 | Win 30:16 | Win 30:14 | Win 30:13 |
| Reaper | 1 | Win 30:23 | Win 30:20 | Win 30:17 |
| Reaper | 2 | Defeat 0:21 | Defeat 0:43 | Win 30:15 |

Times in the case table are total simulated elapsed time, rounded down to whole seconds; JSONL retains precise values. Both defeats were Reaper on seed 2: 21.09s fresh and 43.46s partial. The bot’s awareness of orbital reach and its early steering remain limited. These failures warrant human first-minute tests and a policy comparison, not an automatic Reaper buff. Winning levels of 183–213 also flag the number of late surplus drafts for human pacing review; the bot resolves menus instantly and cannot measure that interruption cost.

The main process respected its **600 CPU-second / 900 wall-second** budget. It completed 23 cases and stopped the last Max/Reaper/seed-2 attempt at 1,482.40 simulated seconds. A separate **60 CPU-second / 120 wall-second** bounded replay completed that case at 1,815.37s. The original interruption is retained in the raw evidence and is not counted as a defeat. Main plus completion used about 632.7 CPU seconds and 806.7 wall seconds, including the interrupted attempt.

The matrix began after all combat corrections above. Only draft/snapshot validation and the developer-only level-80 preset changed while it ran; neither changes legitimate bot decisions or physics. Each evidence file records its source fingerprint. The completion replay and simulation benchmark used the final engine revision.

## Simulation CPU and memory

Each scene warms up for 5 simulated seconds, then measures 20 seconds at fixed 120Hz. Dense uses 300 enemies, six evolved weapons and 700 distant pickups. Final-boss sustains an enraged Death with 120 initial enemies. Huge fixture HP prevents early termination; these scenes are deliberately not balance tests. Each scene has a 20 CPU-second ceiling, and none reached it.

| Scene | Process CPU | Mean simulation tick | p95 tick | Sampled peak heap | Snapshot bytes | Clone + JSON time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| early | 0.485s | 0.2715ms | 0.7526ms | 13.50MiB | 57,325 | 3.139ms |
| dense | 1.925s | 0.7821ms | 1.4695ms | 106.87MiB | 286,130 | 9.709ms |
| final-boss | 1.146s | 0.4669ms | 0.9695ms | 103.14MiB | 121,296 | 2.701ms |

These are Node v24.19.0 measurements on the current host, not browser FPS or physical-device memory results. Rendering, React, DOM input dispatch, bot planning and persistence transport are excluded. Memory is sampled and GC-dependent; the high-water values do not establish retained-memory growth or a leak. Snapshot serialization can take several milliseconds under dense load. The UI currently spaces periodic captures 15 simulated seconds apart; capture/transport cost still needs browser profiling alongside pause checkpoints.

## Reproduction and evidence

```sh
node --import tsx --test tests/engine.test.ts
BALANCE_SEEDS=1,2 BALANCE_LIMIT=1860 BALANCE_CPU_BUDGET=600 BALANCE_WALL_BUDGET=900 node --import tsx scripts/simulate-balance.ts
BALANCE_SEEDS=2 BALANCE_PROFILES=max BALANCE_HUNTERS=reaper BALANCE_LIMIT=1860 BALANCE_CPU_BUDGET=60 BALANCE_WALL_BUDGET=120 BALANCE_LABEL=sept29-completion node --import tsx scripts/simulate-balance.ts
BENCHMARK_SECONDS=20 node --import tsx scripts/benchmark-simulation.ts
```

- [Main matrix JSONL](evidence/balance-sept29.jsonl): metadata, 24 attempted rows including the budget interruption, and batch summary.
- [Bounded completion JSONL](evidence/balance-sept29-completion.jsonl): the final distinct case replay and its summary.
- [Simulation diagnostic JSONL](evidence/simulation-sept29.jsonl): source fingerprint and the three scene measurements.

Human fresh-save sessions, physical touch/thermal testing, late-game browser profiling and YouTube host certification remain separate release gates. Two seeds and one omniscient steering heuristic are insufficient for a balance verdict or a promise that every build succeeds.
