# NORPEK: Nightfall Survivors

A gothic, single-player horde-survival game built with TypeScript, Canvas 2D, React, and a statically exported Next.js website. Survive thirty minutes, defeat the harbingers at 5:00 and 15:00, then defeat Death to reclaim the dawn. The final fight may extend past thirty minutes.

The upgrade is tracked in [plan.md](plan.md). See the [dated verification record](docs/verification-2026-09-28.md), [release checks](docs/release-checklist.md), [known limitations](docs/known-issues.md) and [changelog](CHANGELOG.md). A locally built Playables package is a test candidate, not YouTube certification.

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
| `npm run validate:playables` | Inspect generated ZIP structure, paths and size limits |
| `npm run test:engine` | Deterministic combat, lifecycle, snapshot and content checks |
| `npm run test:integration` | Persistence, audio and platform adapter checks |

Open `game.html` directly for offline play. Browser storage behavior for `file:` URLs varies; serving the web build is preferred for durable progress. The Playables build needs the official SDK network request; outside YouTube it visibly uses session-only preview progress.

## Controls and systems

- Move with WASD, arrow keys, or mouse/touch drag. Diagonal speed is normalized. Auto-attacks handle firing; Sword Wave follows your last movement direction.
- Pause with P or the on-screen button. Escape also pauses on the website; Playables leaves Escape to YouTube.
- Menus support keyboard focus, mouse and touch. Settings include fixed/floating controls, left/right placement, reduced motion, shake, flashes, effects, contrast, damage numbers, and separate music/effects volumes.
- Four hunters have distinct starting weapons, stat tradeoffs and passive signature traits.
- Eight weapons have eight ranks and paired evolutions. Carry the matching passive at any rank and maximize the weapon, then collect a chest. When multiple evolutions qualify, choose one.
- Six weapon and six passive slots; three rerolls, two skips and one banish per hunt.
- A ten-minute optional Covenant offers a limited ritual challenge and a choice of build-changing rewards. Declining costs nothing.
- Major authored encounters have spacing and wait while bosses or rituals are active. Screen-edge markers prioritize important threats and rewards.
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

The long test is an explicitly assisted director/stability fixture. The balance script uses legal builds and a deterministic bot; neither substitutes for human playtests, device profiling or YouTube validation. Release UI exposes no time-skip or invulnerability shortcuts.

With the development server running, open `http://127.0.0.1:3000/?debug=1` for the QA lab. It uses a disposable in-memory profile, never reads or writes real progress, and can open each draft/chest/evolution/Covenant/outcome phase with chosen enemies and bosses. The lab is excluded from production UI and invulnerable test runs cannot export resumable saves.

## Source layout

`app/game/engine.ts` owns simulation and session state; `data.ts` defines content; `input.ts` normalizes controls; `render.ts` consumes game state; `sprites.ts` caches procedural art; `audio.ts` handles synthesis and audio lifecycle; `meta.ts` validates profiles and serializes writes; `settings.ts` defines preferences; `platform.ts` separates browser and Playables behavior. `GameRoot.tsx` provides accessible screens and lifecycle integration. `scripts/` builds and validates all artifacts; `tests/` contains regression fixtures.
