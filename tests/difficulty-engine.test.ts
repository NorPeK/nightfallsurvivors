import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, type Enemy, type Pickup } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, ENEMIES } from "../app/game/data";
import { COVENANT_DURATION, COVENANT_MIN_SURVIVAL, COVENANT_RADIUS, COVENANT_TARGET } from "../app/game/rules";

type Access = {
  updateEnemies(dt: number): void;
  updateScheduled(dt: number): void;
  updateEnemyBullets(dt: number): void;
  updateCovenant(dt: number): void;
  updatePickups(dt: number): void;
  flushPickups(): void;
  warnSlam(owner: number, x: number, y: number, radius: number, damage: number): void;
  warnVolley(owner: number, x: number, y: number, angle: number, count: number, spread: number, speed: number, damage: number): void;
  killEnemy(enemy: Enemy, drops: boolean): void;
  scheduled: { owner?: number; kind: string; args: number[] }[];
  deferredPickups: { kind: Pickup["kind"]; x: number; y: number; value: number }[];
};
function fixture() {
  const game = new Game(new Input(), { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onRunEnd() {}, onBossWarning() {}, onCovenant() {} }, { seed: 27, autoStart: false });
  game.startRun("knight", { ...BASE_STATS, critChance: 0 });
  game.weapons = []; game.spawnTimer = 10_000;
  return { game, access: game as unknown as Access };
}
function amount(game: Game, kind: Pickup["kind"]) {
  const access = game as unknown as Access;
  return [...game.pickups.filter((pickup) => pickup.active), ...access.deferredPickups].filter((pickup) => pickup.kind === kind).reduce((total, pickup) => total + (kind === "gem" || kind === "coin" ? pickup.value : Math.max(1, pickup.value)), 0);
}
function caster(game: Game, id = "cultist") {
  const enemy = game.spawnEnemy(ENEMIES[id], false)!;
  Object.assign(enemy, { x: 220, y: 0, attackTimer: 0, speed: 0, damage: 20 });
  return enemy;
}
function ritual(game: Game) {
  game.covenant = { status: "offered", x: 0, y: 0, remaining: COVENANT_DURATION, progress: 0, target: COVENANT_TARGET, reward: null };
  game.setPhase("covenant"); assert.equal(game.acceptCovenant(), true);
}

test("a saturated XP field preserves every point and creates a visible drop at the new kill", () => {
  const { game, access } = fixture();
  for (let i = 0; i < game.pickups.length; i++) game.dropPickup("gem", 500 + i * 2, 500, 3);
  const before = amount(game, "gem");
  for (let i = 0; i < 150; i++) {
    const x = -500 - i * 3;
    game.dropPickup("gem", x, -500, 7);
    assert.ok(game.pickups.some((pickup) => pickup.active && pickup.kind === "gem" && pickup.x === x && pickup.y === -500 && pickup.value === 7));
  }
  assert.equal(amount(game, "gem"), before + 150 * 7);
  assert.equal(game.pickups.filter((pickup) => pickup.active).length, game.pickups.length);
  assert.equal(access.deferredPickups.length, 0);
});

test("all-coin or all-chest pools still admit XP and conserve non-XP rewards", () => {
  for (const kind of ["coin", "chest"] as const) {
    const { game, access } = fixture();
    for (let i = 0; i < game.pickups.length; i++) game.dropPickup(kind, 600 + i, 600, kind === "coin" ? 5 : 0);
    const before = amount(game, kind);
    for (let i = 0; i < 100; i++) game.dropPickup("gem", -500 - i, -500, 11);
    assert.equal(amount(game, kind), before);
    assert.equal(amount(game, "gem"), 1100);
    assert.ok(game.pickups.some((pickup) => pickup.active && pickup.kind === "gem" && pickup.x === -599));
    assert.equal(access.deferredPickups.length, 0);
    const saved = JSON.parse(JSON.stringify(game.exportSnapshot()));
    const restored = fixture().game;
    assert.equal(restored.importSnapshot(saved), true);
    assert.equal(amount(restored, kind), before); assert.equal(amount(restored, "gem"), 1100);
  }
});

test("deferred rewards stay bounded by kind without losing chest or consumable counts", () => {
  const { game, access } = fixture(); game.pickups = [];
  const kinds: Pickup["kind"][] = ["gem", "coin", "chest", "meat", "magnet", "bomb"];
  for (let i = 0; i < 250; i++) for (const kind of kinds) game.dropPickup(kind, 100, 100, kind === "gem" || kind === "coin" ? 3 : 0);
  access.flushPickups();
  assert.equal(access.deferredPickups.length, 6);
  for (const kind of kinds) assert.equal(amount(game, kind), kind === "gem" || kind === "coin" ? 750 : 250);
});

test("consolidated consumables are collected once each across successive simulation ticks", () => {
  const { game, access } = fixture();
  game.hp = 1; game.stats.maxHp = 200;
  game.dropPickup("meat", 0, 0, 3);
  const meat = game.pickups.find((pickup) => pickup.active)!;
  access.updatePickups(.01); assert.equal(game.hp, 31); assert.equal(meat.value, 2); assert.equal(meat.active, true);
  access.updatePickups(.01); assert.equal(game.hp, 61); assert.equal(meat.value, 1);
  access.updatePickups(.01); assert.equal(game.hp, 91); assert.equal(meat.active, false);
  game.dropPickup("meat", 0, 0, 0); access.updatePickups(.01); assert.equal(game.hp, 121);
});

test("ordinary ranged attacks warn before firing, commit their aim, and can be dodged", () => {
  for (const dodge of [false, true]) {
    const { game, access } = fixture(); const enemy = caster(game);
    access.updateEnemies(.01);
    const action = access.scheduled.find((pending) => pending.owner === enemy.id)!;
    assert.equal(action.kind, "volley"); assert.equal(game.enemyBullets.some((bullet) => bullet.active), false);
    assert.ok(game.fx.some((effect) => effect.owner === enemy.id && effect.kind === "telegraph"));
    const aim = action.args[2]; if (dodge) game.py = 120;
    access.updateScheduled(1); assert.equal(action.args[2], aim);
    const before = game.hp; access.updateEnemyBullets(2);
    assert.equal(game.hp < before, !dodge);
  }
});

test("ordinary hexes lock a warned ground area and their dead or frozen owner cancels damage", () => {
  for (const cancel of ["death", "freeze"] as const) {
    const { game, access } = fixture(); const enemy = caster(game, "wraith");
    access.updateEnemies(.01);
    assert.ok(access.scheduled.some((action) => action.owner === enemy.id && action.kind === "slam"));
    if (cancel === "death") access.killEnemy(enemy, true);
    else { enemy.slowF = 0; enemy.slowT = 2; access.updateEnemies(.01); }
    assert.equal(access.scheduled.some((action) => action.owner === enemy.id), false);
    assert.equal(game.fx.some((effect) => effect.owner === enemy.id), false);
    const before = game.hp; access.updateScheduled(2); assert.equal(game.hp, before);
  }
});

test("dense ordinary ranged enemies cap concurrent warned casts instead of firing invisibly", () => {
  const { game, access } = fixture();
  for (let i = 0; i < 50; i++) caster(game, "banshee");
  access.updateEnemies(.01);
  assert.equal(access.scheduled.length, 12);
  assert.equal(game.fx.filter((effect) => effect.kind === "telegraph").length, 36);
  assert.equal(game.enemyBullets.some((bullet) => bullet.active), false);
});

test("cosmetic saturation never removes a live warning, and exhausted warning capacity defers attacks", () => {
  const { game, access } = fixture(); const enemy = caster(game);
  access.updateEnemies(.01);
  const warning = game.fx.find((effect) => effect.kind === "telegraph")!;
  for (let i = 0; i < 200; i++) game.addFx({ ...warning, kind: "ring", owner: undefined });
  assert.ok(game.fx.includes(warning)); assert.equal(game.fx.length, 120);
  game.fx = Array.from({ length: 120 }, () => ({ ...warning }));
  access.scheduled = [];
  access.warnSlam(enemy.id, 0, 0, 80, 30);
  access.warnVolley(enemy.id, 200, 0, Math.PI, 3, .2, 150, 30);
  assert.equal(access.scheduled.length, 0); assert.equal(game.fx.length, 120);
});

test("the new lancer uses the same committed warned charge as a hellhound", () => {
  const { game, access } = fixture(); const enemy = caster(game, "lancer");
  Object.assign(enemy, { charge: 0, speed: 70 });
  access.updateEnemies(.01); assert.ok(enemy.windup > 0);
  assert.ok(game.fx.some((effect) => effect.owner === enemy.id && effect.shape === "line"));
  const y = enemy.y; game.py = 100;
  access.updateEnemies(.5); access.updateEnemies(.1);
  assert.ok(enemy.x < 220); assert.equal(enemy.y, y);
});

test("ritual credit requires both the player and the defeated enemy inside the shrine", () => {
  const { game, access } = fixture(); ritual(game);
  const kill = (playerX: number, enemyX: number, drops = true) => {
    game.px = playerX; const enemy = game.spawnEnemy(ENEMIES.bat, false)!; enemy.x = enemyX; enemy.y = 0; access.killEnemy(enemy, drops);
  };
  kill(COVENANT_RADIUS + 1, 0); kill(0, COVENANT_RADIUS + 1); kill(0, 0, false);
  assert.equal(game.covenant!.progress, 0);
  kill(COVENANT_RADIUS, COVENANT_RADIUS); assert.equal(game.covenant!.progress, 1);
});

test("rituals sustain mixed waves, require sixty kills and thirty seconds, and reward only once", () => {
  const { game, access } = fixture(); ritual(game);
  assert.equal(game.enemies.filter((enemy) => enemy.active).length, 12);
  assert.equal(new Set(game.enemies.filter((enemy) => enemy.active).map((enemy) => enemy.def.id)).size, 4);
  access.updateCovenant(6); assert.equal(game.enemies.filter((enemy) => enemy.active).length, 18);
  assert.ok(access.scheduled.some((action) => action.kind === "slam"));
  game.covenant!.progress = COVENANT_TARGET;
  access.updateCovenant(COVENANT_MIN_SURVIVAL - 6 - .1); assert.equal(game.covenant!.status, "active");
  game.px = COVENANT_RADIUS + 1; access.updateCovenant(.2); assert.equal(game.covenant!.status, "active");
  game.px = 0; access.updateCovenant(.01); assert.equal(game.covenant!.status, "reward");
  assert.equal(game.chooseCovenant("precision"), true); assert.equal(game.chooseCovenant("frost"), false);
});

test("rituals fail on their deadline when their objective is incomplete", () => {
  const { game, access } = fixture(); ritual(game); game.covenant!.progress = COVENANT_TARGET - 1;
  access.updateCovenant(COVENANT_DURATION); assert.equal(game.covenant!.status, "failed");
  assert.equal(game.chooseCovenant("precision"), false);
});
