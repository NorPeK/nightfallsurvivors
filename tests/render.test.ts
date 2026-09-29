import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, BOSSES, ENEMIES } from "../app/game/data";
import { DEFAULT_SETTINGS } from "../app/game/settings";
import { combatViewport, offscreenMarkers, renderGame } from "../app/game/render";
import { enemySprite, enemyFrozenSprite, enemyFlashSprite } from "../app/game/sprites";

type Command = { name: string; args: unknown[] };
function canvasContext(commands: Command[] = []): CanvasRenderingContext2D {
  const values: Record<string, unknown> = {};
  return new Proxy(values, {
    get(target, name: string) {
      if (name in target) return target[name];
      if (name === "createLinearGradient" || name === "createRadialGradient") return (...args: unknown[]) => { commands.push({ name, args }); return { addColorStop(...stop: unknown[]) { commands.push({ name: "addColorStop", args: stop }); } }; };
      return (...args: unknown[]) => { commands.push({ name, args }); };
    },
    set(target, name: string, value) { target[name] = value; commands.push({ name: `set:${name}`, args: [value] }); return true; },
  }) as unknown as CanvasRenderingContext2D;
}
function fixture() {
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { document: { createElement() { const context = canvasContext(); return { width: 0, height: 0, getContext() { return context; } }; } } });
  const game = new Game(new Input(), { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onRunEnd() {}, onBossWarning() {} }, { seed: 1234, autoStart: false });
  game.startRun("mage", { ...BASE_STATS });
  return { game, cleanup() { game.dispose(); Object.assign(globalThis, { document: previousDocument }); } };
}

test("rendering arbitrary frame counts and viewports cannot mutate gameplay or damage-number timing", () => {
  const f = fixture(); try {
    const { game } = f;
    const enemy = game.spawnEnemy(ENEMIES.ghoul, true)!;
    Object.assign(enemy, { x: 5000, y: 90, hitFlash: .15 });
    game.spawnBoss(BOSSES[0]); Object.assign(game.boss!, { x: -5000, y: 0 });
    game.covenant = { status: "active", x: 0, y: 5000, remaining: 25, progress: 6, target: 12, reward: null };
    game.dropPickup("chest", 0, -5000, 0);
    Object.assign(game.dmgNums[0], { active: true, x: 60, y: 75, vy: -30, life: .8, value: 42, crit: true });
    game.pause();
    const before = JSON.stringify({ snapshot: game.exportSnapshot(), numbers: game.dmgNums, particles: game.particles, shake: game.shake });
    const context = canvasContext();
    for (let frame = 0; frame < 24; frame++) {
      const [width, height] = [[390, 844], [844, 390], [1379, 731], [320, 568]][frame % 4];
      renderGame(game, context, width, height, { ...DEFAULT_SETTINGS, reducedMotion: frame % 2 === 0 });
    }
    assert.equal(JSON.stringify({ snapshot: game.exportSnapshot(), numbers: game.dmgNums, particles: game.particles, shake: game.shake }), before);
  } finally { f.cleanup(); }
});

test("offscreen guidance prioritizes live threats and ritual, without duplicating visible or dead targets", () => {
  const f = fixture(); try {
    const { game } = f;
    game.spawnBoss(BOSSES[0]); Object.assign(game.boss!, { x: 5000, y: 0 });
    game.covenant = { status: "active", x: 0, y: -5000, remaining: 25, progress: 6, target: 12, reward: null };
    const elite = game.spawnEnemy(ENEMIES.ghoul, true)!; Object.assign(elite, { x: -5000, y: 0 });
    game.dropPickup("chest", 0, 5000, 0);
    const settings = { ...DEFAULT_SETTINGS, onboardingComplete: true };
    for (const [width, height] of [[320, 568], [844, 390], [1280, 720]]) {
      const markers = offscreenMarkers(game, width, height, settings);
      assert.deepEqual(markers.map(m => m.kind), ["boss", "covenant", "elite"]);
      assert.ok(Math.cos(markers[0].angle) > .9, "boss arrow points right");
      assert.ok(Math.sin(markers[1].angle) < -.9, "ritual arrow points up");
      assert.ok(Math.cos(markers[2].angle) < -.9, "elite arrow points left");
      assert.ok(markers.every(m => m.x - 44 >= 12 && m.x + 44 <= width - 12 && m.y - 16 >= 150 && m.y + 16 <= height - 64));
    }
    Object.assign(game.boss!, { x: game.camX, y: game.camY });
    elite.hp = 0; game.covenant.status = "complete";
    assert.deepEqual(offscreenMarkers(game, 390, 844, settings).map(m => m.kind), ["chest"]);
  } finally { f.cleanup(); }
});

test("edge badges locate the nearest chest and avoid touch controls and each other", () => {
  const f = fixture(); try {
    const { game } = f;
    game.dropPickup("chest", -9000, 0, 0); game.dropPickup("chest", 5000, 0, 0);
    assert.ok(Math.cos(offscreenMarkers(game, 390, 844, { ...DEFAULT_SETTINGS, onboardingComplete: true })[0].angle) > .9);
    game.spawnBoss(BOSSES[0]); Object.assign(game.boss!, { x: 5000, y: 2000 });
    const elite = game.spawnEnemy(ENEMIES.ghoul, true)!; Object.assign(elite, { x: 5000, y: 2100 });
    for (const [width, height] of [[320, 568], [844, 390], [1280, 720]]) {
      for (const joystickSide of ["left", "right"] as const) {
        const settings = { ...DEFAULT_SETTINGS, joystickMode: "fixed" as const, joystickSide, onboardingComplete: true };
        const markers = offscreenMarkers(game, width, height, settings);
        assert.ok(markers.length >= 1 && markers.length <= 3);
        const jx = joystickSide === "left" ? 86 : width - 86, jy = height - 100;
        for (const marker of markers) {
          assert.ok(Math.abs(marker.x - jx) >= 126 || Math.abs(marker.y - jy) >= 98, "badge stays outside the joystick and knob footprint");
          for (const other of markers) if (other !== marker) assert.ok(Math.abs(marker.x - other.x) >= 88 || Math.abs(marker.y - other.y) >= 32, "badges do not overlap");
        }
      }
    }
  } finally { f.cleanup(); }
});
test("camera maps CSS viewport to consistent logical geometry independent of raster pixel ratio", () => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 720], [1920, 1080]]) {
    const view = combatViewport(width, height);
    assert.ok(Math.abs(view.width * view.scale - width) < 1e-9);
    assert.ok(Math.abs(view.height * view.scale - height) < 1e-9);
    assert.ok(Math.min(view.width, view.height) >= 600 - 1e-9);
    assert.ok(view.scale >= .5 && view.scale <= 1.5);
  }
  const portrait = combatViewport(390, 844), landscape = combatViewport(844, 390);
  assert.equal(portrait.scale, landscape.scale);
  assert.equal(portrait.width, landscape.height);
});
test("a line telegraph ending at world origin remains a line and uses its locked endpoint", () => {
  const f = fixture(); try {
    const { game } = f;
    game.fx = [{ kind: "telegraph", shape: "line", x: -140, y: 60, x2: 0, y2: 0, angle: 2, radius: 40, t: .1, dur: .7, color: "#f00", arc: 0 }];
    const commands: Command[] = [];
    const view = combatViewport(390, 844);
    renderGame(game, canvasContext(commands), 390, 844, { ...DEFAULT_SETTINGS, screenShake: false });
    const expectedX = view.width / 2 - game.camX, expectedY = view.height / 2 - game.camY;
    const endpointCommands = commands.filter(c => c.name === "lineTo" && c.args[0] === expectedX && c.args[1] === expectedY);
    assert.equal(endpointCommands.length, 2, "danger fill and foreground marker both use the locked endpoint even when it is zero");
    const warningWidth = commands.find(c => c.name === "set:lineWidth" && c.args[0] === 80);
    assert.ok(warningWidth, "corridor width represents twice the attack radius");
  } finally { f.cleanup(); }
});

test("comfort settings steady danger rims while retaining the countdown boundary", () => {
  const f = fixture(); try {
    const { game } = f;
    game.time = 17.3;
    game.fx = [{ kind: "telegraph", shape: "circle", x: 0, y: 0, x2: 0, y2: 0, angle: 0, radius: 120, t: .35, dur: .7, color: "#f00", arc: 0 }];
    for (const preferences of [{ screenFlash: false, reducedMotion: false }, { screenFlash: true, reducedMotion: true }]) {
      const commands: Command[] = [];
      renderGame(game, canvasContext(commands), 390, 844, { ...DEFAULT_SETTINGS, ...preferences });
      assert.ok(commands.some(c => c.name === "set:strokeStyle" && c.args[0] === "rgba(255,140,60,0.8)"));
      assert.ok(commands.some(c => c.name === "arc" && c.args[2] === 60), "half-time countdown remains readable");
      if (preferences.reducedMotion) assert.ok(commands.every(c => c.name !== "set:lineDashOffset" || c.args[0] === 0));
    }
  } finally { f.cleanup(); }
});

test("comfort controls replace bright impact fills with geometry and stop decorative aura rotation", () => {
  const f = fixture(); try {
    const { game } = f;
    game.time = 20;
    game.weapons.push({ id: "aura", level: 1, evolved: false, timer: 0, alt: 0 });
    game.fx = [{ kind: "explosion", shape: "circle", x: 0, y: 0, x2: 0, y2: 0, angle: 0, radius: 123, t: .1, dur: .7, color: "#ff8f50", arc: 0 }];
    for (const preferences of [{ screenFlash: false, reducedMotion: false }, { screenFlash: true, reducedMotion: true }]) {
      const commands: Command[] = [];
      renderGame(game, canvasContext(commands), 390, 844, { ...DEFAULT_SETTINGS, ...preferences });
      assert.ok(commands.some(c => c.name === "arc" && c.args[2] === 123), "impact boundary still communicates its full radius");
      assert.ok(!commands.some(c => c.name === "addColorStop" && c.args[1] === "rgba(255,243,201,0.9)"), "bright explosion fill is absent");
      if (preferences.reducedMotion) assert.ok(commands.every(c => c.name !== "set:lineDashOffset" || c.args[0] === 0));
    }
  } finally { f.cleanup(); }
});

test("enemy hits retain normal or frozen artwork under a restrained flash without mutating gameplay", () => {
  const f = fixture(); try {
    const { game } = f;
    const enemy = game.spawnEnemy(ENEMIES.ghoul, false)!;
    Object.assign(enemy, { x: 0, y: 0, hitFlash: .15 });
    for (const frozen of [false, true]) {
      Object.assign(enemy, { slowT: frozen ? 2 : 0, slowF: frozen ? 0 : 1 });
      const base = frozen ? enemyFrozenSprite(enemy.def, false) : enemySprite(enemy.def, false);
      const flash = enemyFlashSprite(enemy.def, false);
      const before = JSON.stringify(game.exportSnapshot());
      for (const preferences of [{ screenFlash: true, reducedMotion: false }, { screenFlash: false, reducedMotion: false }, { screenFlash: true, reducedMotion: true }]) {
        const commands: Command[] = [];
        renderGame(game, canvasContext(commands), 390, 844, { ...DEFAULT_SETTINGS, ...preferences });
        const basePaint = commands.findIndex(c => c.name === "drawImage" && c.args[0] === base);
        const flashPaint = commands.findIndex(c => c.name === "drawImage" && c.args[0] === flash);
        assert.ok(basePaint >= 0, "readable enemy artwork is always painted");
        if (preferences.screenFlash && !preferences.reducedMotion) {
          assert.ok(flashPaint > basePaint, "hit feedback overlays, rather than replaces, the enemy");
          const alpha = commands.slice(0, flashPaint).findLast(c => c.name === "set:globalAlpha")?.args[0];
          assert.ok(typeof alpha === "number" && alpha > 0 && alpha <= .3, "the flash cannot obscure most of the underlying artwork");
          assert.deepEqual(commands[flashPaint + 1], { name: "set:globalAlpha", args: [1] }, "subsequent world rendering returns to opaque");
        } else assert.equal(flashPaint, -1, "comfort preferences suppress the flash overlay");
        assert.equal(JSON.stringify(game.exportSnapshot()), before);
      }
    }
  } finally { f.cleanup(); }
});
