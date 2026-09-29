# Expanded encounter diagnostics — September 29, 2026

This audit covers the requested twelve mini-bosses at minutes 1, 3, 7, 9, 11, 13, 17, 19, 21, 23, 27 and 29, and six main bosses at minutes 5, 10, 15, 20, 25 and 30. It supplements the previous 0.2.1 balance audit; that older three-boss matrix does not validate this new schedule.

## Regression coverage

Content checks pin the exact minute arrays, unique encounter IDs/minutes, finite positive combat values, increasing HP/contact budgets, valid mini enemy references/rewards and save-compatible collision sizes. Each mini has less HP than the following main boss. Existing elite/swarm director fixtures explicitly isolate the new schedule so they still test their original admission, recovery, capacity and restore behavior.

The opt-in long test runs a full Classic director at 120 Hz with enormous player HP, regeneration and six evolved weapons. It requires all six main bosses to be defeated exactly once, and all twelve mini-bosses, fourteen elites and seven swarms to arrive. Mini defeats must be valid and duplicate-free; the dawn sweep may clear a surviving mini without counting a kill or granting rewards. It periodically exports and restores real run snapshots. This deliberately assisted fixture checks scheduling and state integrity, not human difficulty.

The **54 existing engine/content tests pass** after those fixture updates. The engine agent added separate focused encounter regressions; the release verification records the final aggregate count.

The final assisted run **passed** at **1,814.675 simulated seconds (30:14.675)**. It defeated all six main bosses, admitted all twelve mini-bosses, delivered all fourteen elites and seven swarms, and restored every sampled checkpoint. The sampled peak UTF-8 snapshot size was **55,327 bytes**. Wall time was 143.26 seconds under concurrent host load; this is not a performance target.

Eleven mini-bosses died to the fixture's equipment. **Dawnless survived its minute-29 window and was cleared by the existing dawn sweep**, which correctly gave no mini-boss kill credit or rewards. The test initially overrequired twelve kills; it now checks the intended twelve admissions and records actual defeats separately. A slow circular movement fixture cannot establish whether the final mini's one-minute window feels fair. This is a specific human playtest item.

[Full assisted test output](evidence/encounter-long-2026-09-29.tap) records the complete encounter IDs and counts.

## Fresh-profile bot diagnostic

The batch requested all four hunters with seed 1 and no permanent upgrades. It respected the **120 CPU-second / 180 wall-second ceiling**, ending at **64.773 CPU seconds / 180.20 wall seconds** under host contention. It completed one run and part of a second; it does not provide a four-hunter balance result.

| Hunter | Result | Simulated time | Main bosses defeated | Mini-bosses defeated |
| --- | --- | ---: | ---: | ---: |
| Knight | Victory | 30:21.24 | 6/6 | 12/12 |
| Ranger | Resource ceiling; alive | 11:07.92 | 2/6 | 4/12; fifth spawned |
| Mage | Not started before ceiling | — | — | — |
| Reaper | Not started before ceiling | — | — | — |

The winning Knight delivered all fourteen elites and seven swarms, reached level 179, and took 351.95 total damage through normal combat. It defeated Dawnless before dawn. This demonstrates one mechanically reachable fresh-save route through the complete expanded schedule, including the final mini's window. The incomplete Ranger result is **not a defeat or a gameplay timeout**. No repeated matrix was launched to bypass the resource ceiling.

The first bot launch was stopped before a completed row when the parent requested sequential diagnostics; its metadata-only log is an ignored scratch artifact and is not counted. The final batch began after the projectile-source attribution fix, with frozen combat behavior. [Raw bot evidence](evidence/encounter-bots-2026-09-29.jsonl) records the source fingerprint, legal builds, encounter IDs and outcome/resource data.

## Simultaneous main and mini workload

Only the new combined scene was measured: Voidseer plus Dawnless, 120 normal enemies, six evolved weapons, 200 distant pickups, five simulated seconds of warmup and twenty measured seconds at 120 Hz. Targets and player have enormous fixture HP so the scene sustains pressure.

| Metric | Measurement |
| --- | ---: |
| Simulated ticks | 2,400 |
| Process CPU / wall time | 1.095s / 2.026s |
| Mean / p95 / p99 wall duration per simulation tick | 0.8393 / 2.5070 / 8.1126ms |
| Sampled peak heap / RSS | 19.98 / 103.75MiB |
| Sampled active enemies / player bullets / hostile bullets | 121 / 36 / 24 |
| Exported snapshot / clone-and-JSON wall time | 123,542 bytes / 34.198ms |
| 20 CPU-second scene ceiling reached | No |

These timings include host scheduling contention and cannot be treated as browser or phone frame rates. Rendering and persistence transport are excluded; sampled heap/RSS are GC-dependent and do not establish a memory leak or retained memory budget. Snapshot serialization remains a concrete browser profiling item. [Raw simulation evidence](evidence/encounter-simulation-2026-09-29.jsonl) includes the independent source fingerprint.

## Human checks remaining

Play the first three minutes with each fresh hunter, test a lingering main boss when the following mini arrives, and deliberately pursue Dawnless during minute 29. Review telegraph clarity, target priority, chest/evolution pacing, and how encounter recovery changes the horde rhythm. These checks need normal keyboard and phone play; the assisted run and one completed bot route cannot establish enjoyable difficulty or mobile performance.

## Reproduction

```sh
node --import tsx --test tests/content.test.ts tests/engine.test.ts tests/new-encounters.test.ts
RUN_LONG=1 node --import tsx --test tests/engine.long.test.ts
BALANCE_SEEDS=1 BALANCE_PROFILES=fresh BALANCE_LIMIT=1860 BALANCE_CPU_BUDGET=120 BALANCE_WALL_BUDGET=180 BALANCE_LABEL=expanded-encounters node --import tsx scripts/simulate-balance.ts
BENCHMARK_SCENES=main-and-mini BENCHMARK_SECONDS=20 node --import tsx scripts/benchmark-simulation.ts
```

The bot policy is unchanged: normal player damage, legal upgrades, no invulnerability, no time skips, no rerolls/skips/banishes and all Covenants declined. It runs one fresh-profile seed per hunter with a process-wide resource ceiling. A resource interruption is not a defeat. The bot does not model human reaction time or enjoyment, and a small sample cannot establish fair difficulty.

The CPU benchmark excludes rendering, React, touch input and save transport. Its main-and-mini scene sustains a minute-25 main boss alongside the minute-29 mini with enormous fixture HP. It measures bounded simulation workload only, not mobile FPS or memory. Other benchmark scenes mark mini schedules delivered to prevent unintended encounters from contaminating their isolated workloads.
