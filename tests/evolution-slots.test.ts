import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, BOSSES, META_UPGRADES, WEAPONS } from "../app/game/data";
import type { PlayerStats, UpgradeOption, WeaponId } from "../app/game/types";

type Access = { openChestNow(): void; recomputePassives(): void; schedule(delay: number, kind: "slash", args: number[]): void };
const equipment: WeaponId[] = ["bow", "orb", "lightning", "frost", "fire", "aura"];
function fixture(rank = 0) {
  let choices: UpgradeOption[] = [];
  const meta: PlayerStats = { ...BASE_STATS };
  META_UPGRADES.find((upgrade) => upgrade.id === "evolutions")!.apply(meta, rank);
  const game = new Game(new Input(), { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onRunEnd() {}, onBossWarning() {}, onEvolutionChoice(options) { choices = options; } }, { autoStart: false, seed: 17 });
  game.startRun("knight", meta); game.spawnTimer = 10_000;
  game.weapons = equipment.map((id) => ({ id, level: 8, evolved: false, timer: 1, alt: 0 }));
  game.passives = equipment.map((id) => ({ id: WEAPONS[id].evolvesWith, level: 1 }));
  const access = game as unknown as Access;
  return { game, access, meta, open() { access.openChestNow(); if (game.phase === "evolution") assert.equal(game.chooseEvolution(choices[0].id), true); } };
}

for (const rank of [0, 1, 4, 5]) {
  test(`Evolutions rank ${rank} permits exactly ${rank + 1} evolved weapons through sequential chests`, () => {
    const { game, open } = fixture(rank);
    assert.equal(game.stats.evolutionSlots, rank + 1);
    for (let chest = 1; chest <= 7; chest++) {
      const beforeRanks = game.weapons.reduce((sum, weapon) => sum + weapon.level, 0) + game.passives.reduce((sum, passive) => sum + passive.level, 0);
      const beforeGold = game.runGold;
      open(); assert.equal(game.phase, "chest");
      assert.equal(game.weapons.filter((weapon) => weapon.evolved).length, Math.min(chest, rank + 1));
      assert.ok(game.runGold > beforeGold);
      if (chest > rank + 1) assert.equal(game.weapons.reduce((sum, weapon) => sum + weapon.level, 0) + game.passives.reduce((sum, passive) => sum + passive.level, 0), beforeRanks + 1);
      game.ackChest();
    }
  });
}

test("HUD readiness follows remaining purchased evolution capacity", () => {
  const { game, open } = fixture(1);
  assert.equal(game.hudSnapshot().weapons.filter((weapon) => weapon.evolutionReady).length, 6);
  open(); game.ackChest();
  assert.equal(game.hudSnapshot().weapons.filter((weapon) => weapon.evolutionReady).length, 5);
  open(); game.ackChest();
  assert.equal(game.hudSnapshot().weapons.filter((weapon) => weapon.evolutionReady).length, 0);
});

test("six evolved weapons restore with their captured capacity and keep it through passive updates", () => {
  const original = fixture(5); for (let i = 0; i < 6; i++) { original.open(); original.game.ackChest(); }
  const snapshot = original.game.exportSnapshot()!; assert.equal(snapshot.version, 4);
  const restored = fixture(); assert.equal(restored.game.importSnapshot(snapshot), true);
  assert.equal(restored.game.stats.evolutionSlots, 6);
  assert.equal(restored.game.weapons.filter((weapon) => weapon.evolved).length, 6);
  restored.access.recomputePassives(); assert.equal(restored.game.stats.evolutionSlots, 6);
});

test("saved evolution choices accept a remaining slot and reject exhausted capacity", () => {
  const original = fixture(1); original.open(); original.game.ackChest(); original.access.openChestNow();
  assert.equal(original.game.phase, "evolution");
  const snapshot = original.game.exportSnapshot()!;
  const restored = fixture(); assert.equal(restored.game.importSnapshot(snapshot), true);
  assert.equal(restored.game.chooseEvolution(snapshot.currentDraft[0].id), true);
  assert.equal(restored.game.weapons.filter((weapon) => weapon.evolved).length, 2);
  snapshot.stats.evolutionSlots = 1; snapshot.passiveBase!.evolutionSlots = 1;
  assert.equal(fixture().game.importSnapshot(snapshot), false);
});

test("current snapshots reject invalid, mismatched, or exceeded evolution capacities atomically", () => {
  const original = fixture(5); for (let i = 0; i < 6; i++) { original.open(); original.game.ackChest(); }
  const destination = fixture(), runId = destination.game.runId;
  for (const capacity of [0, -1, 1.5, 7, Infinity, NaN]) {
    const snapshot = original.game.exportSnapshot()!;
    snapshot.stats.evolutionSlots = capacity; snapshot.passiveBase!.evolutionSlots = capacity;
    assert.equal(destination.game.importSnapshot(snapshot), false); assert.equal(destination.game.runId, runId);
  }
  const mismatched = original.game.exportSnapshot()!; mismatched.passiveBase!.evolutionSlots = 5;
  assert.equal(destination.game.importSnapshot(mismatched), false);
  const exceeded = original.game.exportSnapshot()!; exceeded.stats.evolutionSlots = exceeded.passiveBase!.evolutionSlots = 5;
  assert.equal(destination.game.importSnapshot(exceeded), false);
});

test("a shop change affects the next hunt without changing a hunt already underway", () => {
  const { game, meta, access } = fixture();
  META_UPGRADES.find((upgrade) => upgrade.id === "evolutions")!.apply(meta, 5);
  access.recomputePassives(); assert.equal(game.stats.evolutionSlots, 1);
  const resumed = fixture(5); assert.equal(resumed.game.importSnapshot(game.exportSnapshot()), true); assert.equal(resumed.game.stats.evolutionSlots, 1);
  game.startRun("knight", meta); assert.equal(game.stats.evolutionSlots, 6);
});

test("legacy v3 adds one slot without resetting projectiles, scheduled casts, health, or XP", () => {
  const { game, access, open } = fixture(); open(); game.ackChest();
  game.spawnBoss(BOSSES[0]); Object.assign(game.boss!, { hp: 50, maxHp: 100 });
  game.level = 20; game.xp = 99; game.xpNext = 207;
  game.spawnBullet("arrow", 50, 0, 100, 0, 10, 5, 1, 1, false, 0);
  access.schedule(.3, "slash", [0, 100, 10]);
  const snapshot = game.exportSnapshot()!;
  const legacy = structuredClone(snapshot) as unknown as Record<string, unknown>; legacy.version = 3;
  delete (legacy.stats as Record<string, unknown>).evolutionSlots;
  delete (legacy.passiveBase as Record<string, unknown>).evolutionSlots;
  const restored = fixture(5); assert.equal(restored.game.importSnapshot(legacy), true);
  const current = restored.game.exportSnapshot()!;
  assert.equal(current.stats.evolutionSlots, 1); assert.equal(current.passiveBase!.evolutionSlots, 1);
  assert.deepEqual(current.bullets, snapshot.bullets); assert.deepEqual(current.scheduled, snapshot.scheduled);
  assert.equal(current.boss!.hp, 50); assert.equal(current.boss!.maxHp, 100);
  assert.equal(current.xp, 99); assert.equal(current.xpNext, 207);
});

test("malformed v3 cannot gain free slots or legalize multiple evolutions", () => {
  const { game } = fixture(5); game.weapons[0].evolved = game.weapons[1].evolved = true;
  const legacy = structuredClone(game.exportSnapshot()!) as unknown as Record<string, unknown>; legacy.version = 3;
  assert.equal(fixture().game.importSnapshot(legacy), false);
});
