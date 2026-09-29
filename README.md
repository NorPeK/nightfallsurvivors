# Nightfall Survivors

A gothic, single-player horde-survival game built with TypeScript, Canvas 2D, React, and a statically exported Next.js website. Fight twelve mini-bosses throughout the night and a main boss every five minutes. Survive thirty minutes, then defeat Death to reclaim the dawn. The final fight may extend past thirty minutes.

The upgrade is tracked in [plan.md](plan.md). See the [Evolutions shop update and verification](docs/evolutions-shop-0.5.0.md), [release checks](docs/release-checklist.md), [known limitations](docs/known-issues.md) and [changelog](CHANGELOG.md). A locally built Playables package is a test candidate, not YouTube certification.

## Run and build

Use Node.js 20.9 or newer (development checks currently use Node 24) and the committed lockfile.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build:all
```

| Command | Output / purpose |
| --- | --- |
| `npm run build:web` | Static website in `out/` |
| `npm start` | Serve `out/` on `http://127.0.0.1:3000` |
| `npm run build:standalone` | Fresh self-contained `game.html`; no Next build prerequisite |
| `npm run build:playables` | `dist/playables/`, ZIP and SHA-256 manifest |
| `npm run preview:playables` | Local candidate on port 3001 with restrictive CSP |
| `npm run preview:mobile` | Serve the built website on your trusted Wi-Fi for physical phone testing; prints phone URLs |
| `npm run build:qa` / `npm run preview:qa` | Separate development-only scenario build in `qa-output/browser/`, served on port 4300 |
| `npm run validate:playables` | Inspect generated ZIP structure, paths and size limits |
| `npm run test:engine` | Deterministic combat, lifecycle, snapshot and content checks |
| `npm run test:integration` | Persistence, audio and platform adapter checks |

Open `game.html` directly for offline play. Browser storage behavior for `file:` URLs varies; serving the web build is preferred for durable progress. The Playables build needs the official SDK network request; outside YouTube it visibly uses session-only preview progress.

For the owner's Android and iPhone checks, follow [the phone playtest guide](docs/phone-playtest.md). The normal server stays on loopback. The mobile command explicitly listens on the local network, serves only `out/`, and is stopped with Ctrl-C; it does not publish a website. Save progress is separate for each device/browser/origin.

## Controls and systems

- Move with WASD, arrow keys, or mouse/touch drag. Diagonal speed is normalized. Auto-attacks handle firing; Sword Wave follows your last movement direction.
- Pause with P or the on-screen button. Escape also pauses on the website; Playables leaves Escape to YouTube.
- Menus support keyboard focus, mouse and touch. Settings include fixed/floating controls, left/right placement, reduced motion, shake, flashes, effects, contrast, damage numbers, and separate music/effects volumes.
- Four hunters have distinct starting weapons, stat tradeoffs and passive signature traits.
- Eight weapons have eight ranks and paired evolutions. Carry the matching passive at any rank and maximize the weapon, then collect a chest. Start with one evolution slot. Permanent Evolutions ranks unlock one more slot each, up to six; when capacity is full, chests grant ordinary equipment and gold.
- Six weapon and six passive slots; three rerolls, two skips and one banish per hunt.
- Evolutions ranks cost 1,000, 2,000, 4,000, 8,000 and 16,000 gold. Capacity is captured at hunt start, so purchases apply to the next hunt and a resumed hunt keeps its existing limit.
- Fifteen ordinary enemy types enter at two-minute intervals, with mixed cohorts, increasing health and warned ranged/ground attacks. Every main and mini-boss has four times its version-0.3.0 health.
- An optional Covenant between minutes 10 and 14 requires 60 kills inside a smaller shrine within 45 seconds, plus at least 30 seconds survived. Both hunter and defeated enemy must be inside for progress. Repeated mixed reinforcements and warned ground attacks add pressure. It waits for a clear interval between scheduled fights; declining costs nothing.
- Mini-bosses arrive at 1, 3, 7, 9, 11, 13, 17, 19, 21, 23, 27 and 29 minutes; main bosses at 5, 10, 15, 20, 25 and 30. The Journal shows the complete schedule and attack guidance. Mini-bosses grant XP/gold; elites and non-final main bosses retain chest rewards.
- Extra elite/swarm events wait during boss fights or rituals and retain recovery spacing. Mini-bosses can join an unfinished main fight; a later main boss waits for the occupied main-boss slot. Death's 30:00 finale retains priority. Screen-edge markers prioritize important threats and rewards.
- Collected gold is checkpointed, retained on defeat or ending a hunt, and settled exactly once. Permanent ranks can be refunded at their recorded purchase cost outside an unfinished hunt.
- The journal contains recipes, controls, boss guidance, discoveries, mastery and recent results. Compatible active hunts can resume from their latest checkpoint.

## Saves and diagnostics

Website progress uses the original `norpek-nightfall-save-v1` storage key with a validated version-2 envelope. Valid older profiles migrate; malformed or newer incompatible profiles are not replaced with defaults. A validated browser backup can be restored explicitly. YouTube progress uses SDK cloud storage and is separate from website progress. One active run/writer is supported; concurrent changes stop saving until reloaded. See [save policy and rollback](docs/save-policy.md).

No external analytics, accounts, advertising SDKs or score submission are included. Runtime art and audio are generated locally; system fonts avoid remote-font requests. Runtime license notices accompany generated output.

For reproducible developer diagnostics:

```sh
RUN_LONG=1 node --import tsx --test tests/engine.long.test.ts
BALANCE_SEEDS=1,2 node --import tsx scripts/simulate-balance.ts
```

The long test is an explicitly assisted director/stability fixture. The balance script uses legal equipment choices and a deterministic bot; `BALANCE_SURVIVAL_ASSIST=1` explicitly adds huge health for progression measurement, and `BALANCE_STAND_AFTER=300` tests stopping movement after five minutes. `scripts/diagnose-pressure.ts` compares stationary and orbiting fixed-build combat. These tools do not substitute for human playtests, device profiling or YouTube validation. Release UI exposes no time-skip or invulnerability shortcuts.

Run `npm run build:qa` followed by `npm run preview:qa`, then open `http://127.0.0.1:4300/?debug=1` for the QA lab. The same lab is available from the Next development server with `?debug=1`. It uses a disposable in-memory profile, never reads or writes real progress, and can open each draft/chest/evolution/Covenant/outcome phase with chosen enemies and bosses. It includes rolling frame diagnostics and a battlefield-only PNG capture. The lab is excluded from production UI and invulnerable test runs cannot export resumable saves. Never submit `qa-output/` as a release.

For isolated persistence faults, build the standalone and run `node --import tsx scripts/recovery-lab.mts`. The printed loopback URL provides test-only profiles and blocked-read/write, backup and conflict controls; it does not touch ordinary saves. See [the recovery audit](docs/save-recovery-audit-2026-09-29.md). The [balance and CPU audit](docs/balance-audit-sept29.md) contains bounded reproduction commands and raw evidence.

## Source layout

`app/game/engine.ts` owns simulation and session state; `data.ts` defines content; `input.ts` normalizes controls; `render.ts` consumes game state; `sprites.ts` caches procedural art; `audio.ts` handles synthesis and audio lifecycle; `meta.ts` validates profiles and serializes writes; `settings.ts` defines preferences; `platform.ts` separates browser and Playables behavior. `GameRoot.tsx` provides accessible screens and lifecycle integration. `scripts/` builds and validates all artifacts; `tests/` contains regression fixtures.
