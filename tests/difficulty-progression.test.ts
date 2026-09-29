import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, type Enemy } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, BOSSES, MINI_BOSSES, ENEMIES, xpForLevel } from "../app/game/data";

type Access = { openChestNow(): void; updateWeapons(dt: number): void; updateScheduled(dt: number): void; updateBullets(dt: number): void; buildGrid(): void };
function fixture() {
  const game = new Game(new Input(), { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onRunEnd() {}, onBossWarning() {}, onEvolutionChoice() {} }, { seed: 1, autoStart: false });
  game.startRun("knight", { ...BASE_STATS, critChance: 0 }); game.weapons = []; game.spawnTimer = 10_000;
  return { game, access: game as unknown as Access };
}
function target(game: Game, x: number): Enemy {
  const enemy = game.spawnEnemy(ENEMIES.brute, false)!;
  Object.assign(enemy, { x, y: 0, hp: 10_000, maxHp: 10_000, speed: 0, radius: 10 }); return enemy;
}

test("the first evolution uses the single run slot and later chests still give upgrades", () => {
  const { game, access } = fixture();
  game.weapons = [{ id: "orb", level: 8, evolved: false, timer: 1, alt: 0 }, { id: "fire", level: 8, evolved: false, timer: 1, alt: 0 }, { id: "bow", level: 1, evolved: false, timer: 1, alt: 0 }];
  game.passives = [{ id: "tome", level: 1 }, { id: "clover", level: 1 }];
  access.openChestNow(); assert.equal(game.phase, "evolution"); assert.equal(game.chooseEvolution("orb"), true);
  game.ackChest(); const before = game.weapons.reduce((sum, weapon) => sum + weapon.level, 0) + game.passives.reduce((sum, passive) => sum + passive.level, 0);
  access.openChestNow(); assert.equal(game.phase, "chest"); assert.equal(game.chooseEvolution("fire"), false);
  assert.equal(game.weapons.filter((weapon) => weapon.evolved).length, 1);
  assert.equal(game.weapons.reduce((sum, weapon) => sum + weapon.level, 0) + game.passives.reduce((sum, passive) => sum + passive.level, 0), before + 1);
  assert.ok(game.runGold > 0); assert.ok(game.hudSnapshot().weapons.every((weapon) => !weapon.evolutionReady));
});

test("high Luck cannot turn one chest into multiple equipment ranks", () => {
  const { game, access } = fixture(); game.stats.luck = 100;
  game.weapons = [{ id: "orb", level: 1, evolved: false, timer: 1, alt: 0 }, { id: "fire", level: 1, evolved: false, timer: 1, alt: 0 }];
  for (let i = 0; i < 10; i++) {
    const before = game.weapons.reduce((sum, weapon) => sum + weapon.level, 0);
    access.openChestNow(); assert.equal(game.weapons.reduce((sum, weapon) => sum + weapon.level, 0), before + 1); game.ackChest();
  }
});

test("Meteor Storm uses compact matching warnings and lower damage", () => {
  const { game, access } = fixture(); game.weapons = [{ id: "fire", level: 8, evolved: true, timer: 0, alt: 0 }];
  access.updateWeapons(.01); access.updateScheduled(.01);
  const meteor = game.bullets.find((bullet) => bullet.active && bullet.kind === "meteor")!;
  const warning = game.fx.find((fx) => fx.kind === "telegraph")!;
  assert.equal(meteor.aoe, 52 * 1.8); assert.equal(warning.radius, meteor.aoe); assert.equal(meteor.damage, 45 * 1.4);
  assert.ok(meteor.aoe < 95 * 1.8 * .56); assert.ok(game.weapons[0].timer > 1.9 * .8);
});

test("Void Sphere is compact and even a legacy AOE field cannot pull or damage distant targets", () => {
  const { game, access } = fixture(); const enemy = target(game, 110); access.buildGrid();
  game.weapons = [{ id: "orb", level: 8, evolved: true, timer: 0, alt: 0 }]; access.updateWeapons(.01);
  const orb = game.bullets.find((bullet) => bullet.active)!;
  assert.equal(orb.radius, 16 * 1.65 * 1.2); assert.equal(orb.aoe, 0); assert.equal(orb.damage, 44 * 1.2);
  for (const bullet of game.bullets) if (bullet.active) { bullet.x = 0; bullet.y = 0; bullet.vx = 0; bullet.vy = 0; bullet.aoe = 150; }
  access.updateBullets(.1); assert.equal(enemy.x, 110); assert.equal(enemy.y, 0); assert.equal(enemy.hp, 10_000);
});

test("current snapshots reject multiple evolutions atomically", () => {
  const { game } = fixture(); const snapshot = game.exportSnapshot()!;
  snapshot.weapons = [{ id: "orb", level: 8, evolved: true, timer: 1, alt: 0 }, { id: "fire", level: 8, evolved: true, timer: 1, alt: 0 }];
  const runId = game.runId; assert.equal(game.importSnapshot(snapshot), false); assert.equal(game.runId, runId);
});

test("older multi-evolution hunts keep their first evolution, XP fraction, and earned credit", () => {
  const { game } = fixture(); const legacy = structuredClone(game.exportSnapshot()!) as unknown as Record<string, unknown>;
  legacy.version = 2; legacy.level = 20; legacy.xp = 99; legacy.xpNext = 198;
  legacy.weapons = [{ id: "orb", level: 8, evolved: true, timer: 1, alt: 0 }, { id: "fire", level: 8, evolved: true, timer: 1, alt: 0 }];
  (legacy.metrics as Record<string, unknown>).evolutions = ["orb", "fire"];
  legacy.covenant = { status: "active", x: 0, y: 0, remaining: 25, progress: 6, target: 12, reward: null };
  const restored = fixture(); assert.equal(restored.game.importSnapshot(legacy), true);
  assert.deepEqual(restored.game.weapons.map((weapon) => [weapon.id, weapon.level, weapon.evolved]), [["orb", 8, true], ["fire", 8, false]]);
  assert.equal(restored.game.xpNext, xpForLevel(20)); assert.equal(restored.game.xp / restored.game.xpNext, .5);
  assert.deepEqual(restored.game.metrics.evolutions, ["orb", "fire"]);
  assert.equal(restored.game.covenant!.target, 60); assert.equal(restored.game.covenant!.progress, 30); assert.equal(restored.game.covenant!.remaining, 25);
  assert.equal(restored.game.exportSnapshot()!.version, 4);
});

test("restoring a pending second evolution preserves the chest as a normal reward", () => {
  const { game, access } = fixture();
  game.weapons = [{ id: "orb", level: 8, evolved: false, timer: 1, alt: 0 }, { id: "fire", level: 8, evolved: false, timer: 1, alt: 0 }];
  game.passives = [{ id: "tome", level: 1 }, { id: "clover", level: 1 }]; access.openChestNow();
  const legacy = structuredClone(game.exportSnapshot()!) as unknown as Record<string, unknown>; legacy.version = 2;
  (legacy.weapons as { evolved: boolean }[])[0].evolved = true;
  const restored = fixture(); assert.equal(restored.game.importSnapshot(legacy), true); assert.equal(restored.game.phase, "chest");
  restored.game.ackChest(); assert.equal(restored.game.phase, "chest"); assert.ok(restored.game.runGold > 0);
  assert.equal(restored.game.weapons.filter((weapon) => weapon.evolved).length, 1);
});

test("the opening XP pace stays intact while later equipment ranks require sustained play", () => {
  for (let level = 1; level <= 12; level++) assert.equal(xpForLevel(level), 5 + (level - 1) * 9);
  for (let level = 13; level <= 100; level++) { assert.ok(xpForLevel(level) > xpForLevel(level - 1)); assert.ok(xpForLevel(level) / xpForLevel(level - 1) < 1.16); }
  // Six delivered equipment chests require about level 72 to fill all 78 ranks.
  // Keep this budget close to the observed late-run income, while above the old curve.
  const toSeventyTwo = Array.from({ length: 71 }, (_, index) => xpForLevel(index + 1)).reduce((sum, xp) => sum + xp, 0);
  assert.ok(toSeventyTwo > 73_000); assert.ok(toSeventyTwo < 75_000);
});


test("legacy active boss and mini health adopt current tuning while preserving damage fraction", () => {
  const { game } = fixture(); game.spawnBoss(BOSSES[0]); const mini = game.spawnMiniBoss(MINI_BOSSES[0])!;
  const ordinary = target(game, 500); ordinary.hp = 100; ordinary.maxHp = 200;
  const legacy = structuredClone(game.exportSnapshot()!) as unknown as Record<string, unknown>; legacy.version = 2;
  const boss = legacy.boss as { hp: number; maxHp: number }; boss.maxHp = BOSSES[0].hp / 4; boss.hp = boss.maxHp * .4;
  const savedMini = (legacy.enemies as { id: number; hp: number; maxHp: number }[]).find((enemy) => enemy.id === mini.id)!;
  savedMini.maxHp = MINI_BOSSES[0].hp / 4; savedMini.hp = savedMini.maxHp * .5;
  const restored = fixture(); assert.equal(restored.game.importSnapshot(legacy), true);
  assert.equal(restored.game.boss!.maxHp, BOSSES[0].hp); assert.equal(restored.game.boss!.hp, BOSSES[0].hp * .4);
  const nextMini = restored.game.enemies.find((enemy) => enemy.active && enemy.miniBossId)!;
  assert.equal(nextMini.maxHp, MINI_BOSSES[0].hp); assert.equal(nextMini.hp, MINI_BOSSES[0].hp * .5);
  const nextOrdinary = restored.game.enemies.find((enemy) => enemy.active && enemy.id === ordinary.id)!;
  assert.equal(nextOrdinary.hp, 100); assert.equal(nextOrdinary.maxHp, 200);
});

test("legacy evolution retention follows earned order instead of inventory position", () => {
  const { game } = fixture(); const legacy = structuredClone(game.exportSnapshot()!) as unknown as Record<string, unknown>; legacy.version = 2;
  legacy.weapons = [{ id: "orb", level: 8, evolved: true, timer: 1, alt: 0 }, { id: "fire", level: 8, evolved: true, timer: 1, alt: 0 }];
  (legacy.metrics as Record<string, unknown>).evolutions = ["fire", "orb"];
  const restored = fixture(); assert.equal(restored.game.importSnapshot(legacy), true);
  assert.deepEqual(restored.game.weapons.map((weapon) => [weapon.id, weapon.evolved]), [["orb", false], ["fire", true]]);
  assert.deepEqual(restored.game.metrics.evolutions, ["fire", "orb"]);
});
