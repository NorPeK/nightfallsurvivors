import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, BOSSES, MINI_BOSSES, ENEMIES } from "../app/game/data";

type Access = {
  updateSpawning(dt: number, time: number): void;
  updateEnemies(dt: number): void;
  updateScheduled(dt: number): void;
  updateBoss(dt: number): void;
  updateEnemyBullets(dt: number): void;
  updateCovenant(dt: number): void;
  scheduled: { owner?: number; kind: string; args: number[] }[];
  encounterCooldown: number;
};
function fixture() {
  const warnings: string[] = [], causes: string[] = [];
  const game = new Game(new Input(), { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onRunEnd(stats) { causes.push(stats.cause); }, onBossWarning(name) { warnings.push(name); }, onCovenant() {} }, { seed: 42, autoStart: false });
  game.startRun("knight", { ...BASE_STATS, critChance: 0 });
  game.weapons = []; game.spawnTimer = 10_000;
  return { game, warnings, causes, access: game as unknown as Access };
}
function markEarlier(game: Game, minute: number) {
  game.miniBossesSpawned = new Set(MINI_BOSSES.filter((mini) => mini.minute < minute).map((mini) => mini.id));
  game.bossesSpawned = new Set(BOSSES.filter((boss) => boss.minute < minute).map((boss) => boss.id));
}

test("each requested mini-boss arrives once at its minute boundary", () => {
  for (const mini of MINI_BOSSES) {
    const { game, access, warnings } = fixture(); markEarlier(game, mini.minute);
    game.time = mini.minute * 60 - .01; access.updateSpawning(.001, game.time);
    assert.equal(game.enemies.some((enemy) => enemy.active && enemy.miniBossId === mini.id), false);
    game.time = mini.minute * 60; access.updateSpawning(.001, game.time); access.updateSpawning(.001, game.time);
    const live = game.enemies.filter((enemy) => enemy.active && enemy.miniBossId === mini.id);
    assert.equal(live.length, 1); assert.equal(live[0].hp, mini.hp); assert.equal(live[0].damage, mini.damage);
    assert.equal(warnings.filter((name) => name === mini.name).length, 1);
  }
});

test("six main bosses keep the requested schedule and Death owns the finale", () => {
  for (const def of BOSSES) {
    const { game, access } = fixture(); markEarlier(game, def.minute);
    game.time = def.minute * 60 - .01; access.updateSpawning(.001, game.time); assert.equal(game.boss, null);
    if (def.minute === 30) game.step(.02);
    else { game.time = def.minute * 60; access.updateSpawning(.001, game.time); }
    assert.equal(game.boss!.def.id, def.id);
    assert.equal(game.finalPhase, def.id === "death");
  }
});

test("mini-bosses can arrive during a main fight while the next main fight queues", () => {
  const { game, access } = fixture(); markEarlier(game, 7); game.spawnBoss(BOSSES[0]);
  const firstId = game.boss!.id; game.time = 420; access.updateSpawning(.01, 420);
  assert.ok(game.enemies.some((enemy) => enemy.active && enemy.miniBossId === MINI_BOSSES.find((mini) => mini.minute === 7)!.id));
  game.time = 600; access.updateSpawning(.01, 600); assert.equal(game.boss!.id, firstId);
  assert.equal(game.bossesSpawned.has("bloodwarden"), false);
  game.hitBoss(1e9, false); access.updateSpawning(.01, 600); assert.equal(game.boss!.def.id, "bloodwarden");
});

test("full pools defer a mini-boss without marking it delivered", () => {
  const { game, access } = fixture();
  for (let i = 0; i < 400; i++) game.spawnEnemy(ENEMIES.bat, false);
  game.time = 60; access.updateSpawning(.01, 60);
  assert.equal(game.miniBossesSpawned.has(MINI_BOSSES[0].id), false);
  game.enemies[0].active = false; access.updateSpawning(.01, 60);
  assert.equal(game.miniBossesSpawned.has(MINI_BOSSES[0].id), true);
  assert.equal(game.enemies.filter((enemy) => enemy.active).length, 400);
});

test("mini-boss rewards use explicit XP and gold once, without adding a chest", () => {
  const { game } = fixture(); game.stats.xpGain = 1.5;
  const def = MINI_BOSSES[0], enemy = game.spawnMiniBoss(def)!;
  game.hitEnemy(enemy, 1e9, false, 0, 0); game.hitEnemy(enemy, 1e9, false, 0, 0);
  assert.deepEqual(game.metrics.miniBossesDefeated, [def.id]);
  assert.equal(game.pickups.filter((pickup) => pickup.active && pickup.kind === "gem").reduce((sum, pickup) => sum + pickup.value, 0), def.xp * 1.5);
  assert.equal(game.pickups.filter((pickup) => pickup.active && pickup.kind === "coin").reduce((sum, pickup) => sum + pickup.value, 0), def.gold);
  assert.equal(game.pickups.some((pickup) => pickup.active && pickup.kind === "chest"), false);
});

test("mini-boss volley is warned, fixed in direction, and canceled if its owner dies", () => {
  const { game, access } = fixture(); const def = MINI_BOSSES.find((mini) => mini.pattern === "volley")!;
  const enemy = game.spawnMiniBoss(def)!; Object.assign(enemy, { x: 200, y: 0, attackTimer: 0 });
  access.updateEnemies(.01);
  assert.equal(game.enemyBullets.some((bullet) => bullet.active), false);
  const action = access.scheduled.find((pending) => pending.kind === "volley")!;
  assert.equal(action.owner, enemy.id); assert.equal(action.args[2], Math.PI);
  assert.equal(game.fx.filter((fx) => fx.kind === "telegraph" && fx.owner === enemy.id).length, action.args[3]);
  game.hitEnemy(enemy, 1e9, false, 0, 0); game.px = 400;
  access.updateScheduled(2);
  assert.equal(game.enemyBullets.some((bullet) => bullet.active), false);
  assert.equal(game.fx.some((fx) => fx.owner === enemy.id), false);
});

test("all added main bosses announce a delayed attack that dies with its owner", () => {
  for (const id of ["bloodwarden", "dreadknight", "voidseer"]) {
    const { game, access } = fixture(); game.spawnBoss(BOSSES.find((boss) => boss.id === id)!);
    Object.assign(game.boss!, { x: 300, y: 0, t2: 0 }); access.updateBoss(.01);
    assert.ok(access.scheduled.length > 0, id);
    assert.ok(game.fx.some((fx) => fx.kind === "telegraph" && fx.owner === game.boss!.id), id);
    game.hitBoss(1e9, false); access.updateScheduled(2);
    assert.equal(game.enemyBullets.some((bullet) => bullet.active), false); assert.equal(game.hp, game.stats.maxHp);
  }
});

test("version 2 checkpoints retain a live mini-boss and its warned attack", () => {
  const { game, access } = fixture(); const enemy = game.spawnMiniBoss(MINI_BOSSES.find((mini) => mini.pattern === "volley")!)!;
  Object.assign(enemy, { x: 220, y: 0, attackTimer: 0 }); access.updateEnemies(.01);
  const snapshot = game.exportSnapshot()!; assert.equal(snapshot.version, 2);
  const restored = fixture(); assert.equal(restored.game.importSnapshot(snapshot), true);
  assert.deepEqual([...restored.game.miniBossesSpawned], [...game.miniBossesSpawned]);
  assert.equal(restored.game.enemies.find((other) => other.active)!.miniBossId, enemy.miniBossId);
  restored.access.updateScheduled(2); assert.ok(restored.game.enemyBullets.some((bullet) => bullet.active));
});

test("legacy checkpoints skip historical added encounters without inventing defeated bosses", () => {
  const { game } = fixture(); game.time = 725; game.bossesSpawned.add("colossus");
  game.spawnEnemy(ENEMIES.brute, false);
  const legacy = structuredClone(game.exportSnapshot()!) as unknown as Record<string, unknown>;
  legacy.version = 1; delete legacy.miniBossesSpawned;
  for (const enemy of legacy.enemies as Record<string, unknown>[]) { delete enemy.miniBossId; delete enemy.attackTimer; }
  delete (legacy.metrics as Record<string, unknown>).miniBossesDefeated;
  const restored = fixture(); assert.equal(restored.game.importSnapshot(legacy), true);
  assert.deepEqual([...restored.game.miniBossesSpawned], MINI_BOSSES.filter((mini) => mini.minute <= 12).map((mini) => mini.id));
  assert.deepEqual([...restored.game.bossesSpawned], ["colossus", "bloodwarden"]);
  assert.deepEqual(restored.game.metrics.bossesDefeated, []); assert.deepEqual(restored.game.metrics.miniBossesDefeated, []);
  assert.equal(restored.game.enemies.find((enemy) => enemy.active)!.miniBossId, null);
  assert.equal(restored.game.exportSnapshot()!.version, 2);
});

test("restored mini identities and projectile counts are bounded", () => {
  const { game, access } = fixture(); const enemy = game.spawnMiniBoss(MINI_BOSSES.find((mini) => mini.pattern === "volley")!)!;
  Object.assign(enemy, { x: 220, y: 0, attackTimer: 0 }); access.updateEnemies(.01);
  const wrongId = game.exportSnapshot()!; wrongId.enemies[0].miniBossId = "unknown";
  assert.equal(fixture().game.importSnapshot(wrongId), false);
  const tooMany = game.exportSnapshot()!; tooMany.scheduled[0].args[3] = 10_000;
  assert.equal(fixture().game.importSnapshot(tooMany), false);
});

test("Covenant offers leave enough time for the ritual before the next scheduled fight", () => {
  for (const [time, offered] of [[615, false], [690, true]] as const) {
    const { game, access } = fixture(); game.time = time; markEarlier(game, Math.floor(time / 60) + .5);
    access.encounterCooldown = 0; access.updateCovenant(.01);
    assert.equal(game.covenant?.status === "offered", offered);
  }
});


test("mini-bosses resist freeze without ignoring the slowing effect", () => {
  const { game, access } = fixture(); const enemy = game.spawnMiniBoss(MINI_BOSSES[0])!;
  Object.assign(enemy, { x: 300, y: 0, attackTimer: 10 });
  game.hitEnemy(enemy, 1, false, 0, 0, { slow: 1, slowF: 0 });
  assert.equal(enemy.slowF, .35); assert.equal(enemy.slowT, 1);
  access.updateEnemies(.1);
  assert.ok(enemy.x < 300); assert.ok(enemy.x > 300 - enemy.speed * .1);
});


test("overlapping mini projectiles retain their shooter through a checkpoint", () => {
  const { game, access } = fixture();
  game.spawnBoss(BOSSES.find((boss) => boss.id === "bloodwarden")!);
  const def = MINI_BOSSES.find((mini) => mini.pattern === "volley")!;
  const enemy = game.spawnMiniBoss(def)!;
  Object.assign(enemy, { x: 220, y: 0, attackTimer: 0 }); access.updateEnemies(.01); access.updateScheduled(2);
  const snapshot = game.exportSnapshot()!;
  assert.ok(snapshot.enemyBullets.length > 0);
  assert.ok(snapshot.enemyBullets.every((bullet) => bullet.cause === `${def.name} projectile`));
  const restored = fixture(); assert.equal(restored.game.importSnapshot(snapshot), true);
  restored.game.hp = 1;
  Object.assign(restored.game.enemyBullets.find((bullet) => bullet.active)!, { x: restored.game.px, y: restored.game.py, damage: 999 });
  restored.access.updateEnemyBullets(.01);
  assert.deepEqual(restored.causes, [`${def.name} projectile`]);
  const legacyBullet = structuredClone(snapshot); delete legacyBullet.enemyBullets[0].cause;
  assert.equal(fixture().game.importSnapshot(legacyBullet), true);
  const bad = structuredClone(snapshot); bad.enemyBullets[0].cause = "x".repeat(161);
  assert.equal(fixture().game.importSnapshot(bad), false);
});
