# NORPEK: Nightfall Survivors

A dark gothic horde-survival game in the spirit of **Vampire Survivors**, built with Next.js + canvas.

Survive **30 minutes** of escalating hordes. Harbinger bosses arrive at **5:00** and **15:00** — and at **30:00**, **NORPEK, Death Incarnate** comes for you. Slay it to reclaim the dawn and win the run.

## Play

**Easiest:** double-click `game.html` — a fully self-contained offline build (works on desktop and mobile browsers).

**Dev server:**

```bash
npm install
npm run dev
# open http://localhost:3000
```

**Static build:** `npm run build` exports to `out/` (serve with any static file server).

**Rebuild the single-file `game.html`:** `npm run build && node scripts/build-standalone.mjs` (requires `esbuild`).

## Controls

- **Move:** WASD / arrow keys — on mobile, touch & drag anywhere (floating joystick)
- **Pause:** ESC or P, or the ⏸ button
- Weapons fire automatically — your job is to dodge, collect gems, and build wisely.

## Game systems

- **4 characters** with distinct stats and starting weapons
- **8 weapons × 8 levels**, each with a **paired passive** — max a weapon, hold its passive, then open a treasure chest to **evolve** it
- **8 passive items**, 6 weapon + 6 passive slots per run
- **12 enemy types**, crowned **elites** that drop chests, swarm events, and 3 bosses with telegraphed attacks
- **XP gems, gold, meat, magnets, bombs** — gold persists between runs and buys permanent **Power-Ups** (10 upgrade tracks)
- Synthesized WebAudio SFX + a procedural dark music loop (no audio assets)

## Debug mode

Open with `?debug=1` for testing hotkeys: `T` +60s · `Y` +290s · `X` +XP · `K` kill all on screen · `B` melt boss to 2% HP.

## Code layout

```
app/game/engine.ts   core simulation: entities, weapons, bosses, spawn director
app/game/data.ts     all content: weapons, passives, enemies, bosses, waves, meta shop
app/game/render.ts   canvas renderer (camera, props, FX, lighting)
app/game/sprites.ts  procedural prerendered sprites (glow baked in for speed)
app/game/audio.ts    WebAudio synth SFX + music
app/game/input.ts    keyboard + floating touch joystick
app/game/meta.ts     persistent save (localStorage)
app/components/GameRoot.tsx  React shell: HUD, menus, level-up/chest/pause/end screens
```
