import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_STATS, BOSSES, CHARACTERS, ELITE_MINUTES, ENEMIES, GAME_DURATION, META_UPGRADES, PASSIVES, SWARM_MINUTES, WAVES, WEAPONS, metaUpgradeCost, resolveWeaponStats, weaponUpgradeDetail } from '../app/game/data';

test('every hunter and evolution references real content and every weapon rank resolves usable numbers', () => {
  assert.equal(new Set(CHARACTERS.map(c => c.id)).size, CHARACTERS.length);
  for (const hunter of CHARACTERS) {
    assert.ok(Object.hasOwn(WEAPONS, hunter.weapon), hunter.id);
    assert.ok(hunter.trait?.trim(), hunter.id);
    assert.ok(Object.values(hunter.stats).every(Number.isFinite), hunter.id);
  }
  for (const [id, weapon] of Object.entries(WEAPONS)) {
    assert.equal(weapon.id, id);
    assert.ok(Object.hasOwn(PASSIVES, weapon.evolvesWith), id);
    assert.equal(weapon.maxLevel, weapon.levels.length, id);
    for (let rank = 1; rank <= weapon.maxLevel; rank++) {
      const resolved = resolveWeaponStats(weapon.id, rank);
      assert.ok(Object.values(resolved).every(v => Number.isFinite(v) && v >= 0), `${id} rank ${rank}`);
      // Daggers orbit continuously; their per-target contact timer replaces a cast cooldown.
      assert.ok((resolved.cooldown > 0 || id === 'daggers') && resolved.area > 0 && resolved.amount >= 1, id);
      assert.ok(Number.isInteger(resolved.amount) && Number.isInteger(resolved.pierce), id);
      assert.ok(weaponUpgradeDetail(weapon.id, rank).trim(), `${id} rank ${rank} needs a meaningful change`);
    }
  }
});

test('authored waves and scheduled encounters cover Classic with valid enemies and bounded counts', () => {
  assert.deepEqual(WAVES.map(w => w.minute), Array.from({ length: GAME_DURATION / 60 }, (_, i) => i));
  for (const wave of WAVES) {
    assert.ok(wave.enemies.length && wave.enemies.every(id => Object.hasOwn(ENEMIES, id)));
    assert.ok(wave.interval > 0 && Number.isInteger(wave.perTick) && wave.perTick > 0);
    assert.ok(Number.isInteger(wave.maxAlive) && wave.maxAlive > 0 && wave.maxAlive <= 400);
  }
  for (const [id, enemy] of Object.entries(ENEMIES)) {
    assert.equal(enemy.id, id);
    assert.ok([enemy.hp, enemy.radius, enemy.speed, enemy.damage, enemy.xp].every(v => Number.isFinite(v) && v > 0), id);
  }
  for (const schedule of [ELITE_MINUTES, SWARM_MINUTES]) {
    assert.equal(new Set(schedule).size, schedule.length);
    assert.ok(schedule.every(m => Number.isInteger(m) && m > 0 && m < GAME_DURATION / 60));
  }
  assert.equal(new Set(BOSSES.map(b => b.id)).size, BOSSES.length);
  assert.equal(BOSSES.at(-1)?.minute, GAME_DURATION / 60);
});

test('all permanent rank combinations remain finite and buyable at their published costs', () => {
  const stats = { ...BASE_STATS };
  assert.equal(new Set(META_UPGRADES.map(u => u.id)).size, META_UPGRADES.length);
  for (const upgrade of META_UPGRADES) {
    assert.ok(Number.isInteger(upgrade.maxLevel) && upgrade.maxLevel > 0);
    for (let rank = 0; rank < upgrade.maxLevel; rank++) {
      const cost = metaUpgradeCost(upgrade, rank);
      assert.ok(Number.isSafeInteger(cost) && cost > 0, `${upgrade.id} rank ${rank}`);
    }
    upgrade.apply(stats, upgrade.maxLevel);
  }
  assert.ok(Object.values(stats).every(v => Number.isFinite(v) && v >= 0));
  assert.ok(stats.maxHp > 0 && stats.moveSpeed > 0 && stats.cooldown > 0 && stats.critChance <= 1);
});
