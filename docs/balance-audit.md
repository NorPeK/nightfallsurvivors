# Engine implementation and verification evidence

Implementation date: 2026-09-28. Files: app/game/{engine,data,types}.ts; tests/engine*.test.ts; scripts/{simulate-balance,measure-weapons}.ts.

## Delivered

- Immutable per-run hunter/meta baseline; fixed 120 Hz simulation; seeded gameplay RNG separate from rendering/audio/cosmetic RNG; owner/run-bound serializable attack scheduler.
- Exactly-once termination, immediate protected victory, deliberate abandonment with run stats; coherent checkpoint callbacks after transactions.
- Distinct-target arrows with generation-safe entity IDs; swept projectile collision; corrected broadphase and post-movement grid; independent orb/dagger tick timers; correct angle wrap and Frost duration; unified Fire area; boss critical Bow splash.
- Accurate freeze, telegraphed committed hound charges, locked Death dash, telegraphed Lich teleport and summon grace periods.
- Guaranteed queued chest/critical rewards, value-conserving gem consolidation, fractional gold accounting, source/effective damage and overkill metrics.
- Serialized authored-encounter admission: bosses/Covenants reserve the slot, due elites/swarms remain pending, admissions have12s spacing and boss/Covenant recovery; bosses retain authored-minute priority over routine cooldown. Full40-enemy swarm capacity is reserved before delivery. The finale never releases an earlier backlog.
- Camera-aware offscreen spawns; final summon scaling freezes at30min. At dawn a surviving earlier boss is explicitly defeated/rewarded before Death appears. Classic remains30min plus finale.
- 3 rerolls,2 skips,1 banish per run; explicit selection among eligible evolutions; resolved numeric upgrade previews.
- Four hunter passive traits, implemented/tested exactly as described. Optional10min Covenant:12 nearby kills in45s, explicit accept/decline, choice of frozen-target bonus/full-health opener/meat protection.
- JSON-safe active-run snapshots with authoritative stats, input-independent intent, RNG, stable IDs, entity pools, status/damage cooldowns, delayed attacks (slash/lightning/meteor/slam/teleport), director sets/timers, drafts/chests, Covenant and traits. Runtime/audio/cosmetic caches excluded; restored modal re-emits callback. Strict validation rejects inherited content IDs, malformed display objects, impossible modal states, missing entity fields and unknown top-level fields.
- Developer-only seeded scenario launcher; QA invulnerability cannot be exported and is reset by restore. Production guard ignores debug constructor option.

## Reproducible commands

```
node --import tsx --test tests/engine.test.ts
RUN_LONG=1 node --import tsx --test tests/engine.long.test.ts
node --import tsx scripts/measure-weapons.ts
BALANCE_SEEDS=1,2 BALANCE_LIMIT=900 node --import tsx scripts/simulate-balance.ts
```

`BALANCE_LIMIT` is simulated seconds. Profiles use legal published permanent upgrades: fresh none, partial rank2 (no Revival), max full ranks. No bot invulnerability or time skipping. Seed/hunter/profile filters are available in the script. Bot dodging/build choices are deterministic heuristics, not a model of human skill. A timed-out900s trial is NOT a failed run or a victory.

## Completed checks

- All40 focused engine regressions passed after the director change (2.73s wall time on the available host). Includes run carryover/terminal guards, timer ownership, collision geometry, pools/rewards, traits/Covenant, snapshots, seeded stepping, QA production guard and three new admission-budget cases: boss deferral/recovery/restore, Covenant blocking/boss priority, full-ring pool admission. Parent final global gate passed typecheck, lint,100 normal tests, the optional full Classic fixture, all3 builds and the archive validator.
- Full continuous Classic director test passed, including a final parent rerun after the authored-admission change:all14 elites,7 swarms,3 bosses and victory; periodically restores every sampled snapshot. The earlier pre-admission run took27.6s headless wall time. This deliberately uses invulnerability and six evolved weapons to isolate scheduling/stability; it is NOT fresh-save balance evidence.
- Earlier full stress sample:1814.97 simulated seconds, max108enemies/17bullets/75pickups, largest sampled JSON snapshot69039bytes. This is not a browser memory/FPS measurement.
- TypeScript passed before final validation hardening. The later owned-file lint run identified one test-only prefer-const error, which was corrected; parent final global TypeScript/lint checks remain authoritative.
- The 300-enemy spatial microbenchmark performed 1,436,000 matching visits before and after numeric grid keys: measured process CPU fell from 689,329µs to 445,518µs (35.4%). Query order stays unchanged; distant-coordinate fallback is tested. This single CPU fixture is not a browser FPS claim.
- Snapshot active entries retain unique bounded pool indices. A focused test restores holes in pools, spawns new enemies and compares future seeded combat; this prevents changed recycled-slot targeting order after resume.

## Measured balancing pass

1. XP milestone multipliers now ramp across levels16–24 and36–44. Former adjacent jumps42.5% and74.6% become at most11.8% inside the transition windows. Requirements at44+ remain unchanged; cumulative XP needed to reach80 changes57488→57260 (−0.40%). Example requirements L19/20:167/238→189/207; L39/40:468/817→591/649. This removes an unexplained threshold cliff while preserving overall progression budget.
2. Frost evolution formerly applied1.6s freeze every1.08s before reductions, producing continuous freeze in all24 stationary crowd targets. Freeze now0.70s; at maximum legitimate cooldown reduction interval is~0.756s, leaving a real movement gap. Regression checks substantial but nonpermanent uptime. Description includes exact duration and boss resistance.
3. Fire area bug fixes are intentionally coherent: base level8 radius111.6 (formerly200.88 through double multiplication); evolved radius171 (formerly95). Warning radius matches damage radius. No further arbitrary damage nerf is applied solely from aggregate crowd DPS.
4. The first pilot bot stayed outside melee reach, giving melee first upgrades~215s vs ranged8–11s. This was a BOT POLICY error, not proof of a game defect. Corrected melee steering brings initial choices to6.78–19.28s across the observed fresh melee trials. Do not use the discarded pilot for hunter balance claims.

Offensive fixtures use level8, zero crit chance, a fixed single foe at75 units, boss at100units, or24 fixed foes around75–145units. Targets reset positions to isolate weapon geometry. Effective DPS is neither survival utility nor a global tier list:

| Weapon | Evolved single | Evolved boss | Evolved24-target aggregate |
| --- | ---: | ---: | ---: |
| Sword |88.75|88.75|1863.75|
| Bow |330.05|330.05|660.10|
| Orb |207.90|221.10|2999.70|
| Lightning |302.40|302.40|2086.20|
| Frost |54.15|54.15|1299.60|
| Fire |279.50|279.50|4863.30|
| Aura |68.75|68.75|1650.00|
| Daggers |0|108|1689.60|

Daggers' zero at75units is an actual inner orbit blind spot; at100units the boss intersects the ring. Description now explains the positioning tradeoff. Aura also heals1.2HP/sec; Frost controls; these values are not represented by DPS.

## Bot evidence and limits

The committed JSONL files under `docs/evidence` are bounded raw completed trials, not screenshots or release certification. These bot trials predate the final authored-encounter admission budget; its correctness has focused regressions, while its player-balance effect still needs new natural runs. The first broad pre-tuning batch was stopped under heavy host contention after 15 completed trials. Incomplete trials produce no row. The pilot with incorrect melee steering is deliberately excluded.

| Pre-tuning profile | Completed trials | Survived to 900s horizon | Deaths |
| --- | ---: | ---: | --- |
| Fresh | 8 (all four hunters, seeds 1 and 2) | 6 | Ranger seed2:636.82s; Reaper seed2:21.09s |
| Partial | 6 | 5 | Reaper seed2:43.46s |
| Max | 1 | 1 | None in this bounded sample |

These are horizon survival results, not wins. They flag weak melee steering/build dependence and draft variance worth human investigation; they do not justify a claim that permanent upgrades are required or that any hunter is fair/unfair. The bot uses one greedy build policy and has limited awareness of orbital geometry.

The post-tuning matched fresh Knight seed1 trial reached900s at level42,3338kills, no evolution; before tuning it reached level53,3748kills and first evolution650.92s. Small XP cadence changes move the seeded draft/kill trajectory, so one paired outcome is not causal proof of a regression or improvement. No extra tuning was made from this single outcome. The batch was stopped after three completed post-tuning fresh trials to relieve host contention. Ranger and Mage also reached the900s horizon; Reaper was interrupted and has no result. The committed artifact contains exactly these completed rows.

- `docs/evidence/balance-before-seed1.jsonl` and `balance-before-seed2.jsonl`: corrected-policy pre-XP/Frost diagnostics; only completed rows retained.
- `docs/evidence/balance-after-fresh-seed1.jsonl`: completed matched post-tuning fresh diagnostics.
- `docs/evidence/weapon-fixtures-before-frost-gap.jsonl`: the offensive fixture baseline above. Frost recovery-gap mechanics are independently regression-tested after the tuning.

No human playtest, physical touch/thermal test, natural fresh-save victory route for every hunter, late-game browser profiler, or YouTube certification is established by these engine checks. The full headless director test is a regression gate, not proof of fun/fairness. The all-hunter fresh/partial/max full-run matrix and human fresh-save balance gate remain release work.
