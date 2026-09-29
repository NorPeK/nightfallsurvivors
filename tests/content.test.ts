import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_STATS, BOSSES, CHARACTERS, ELITE_MINUTES, ENEMIES, GAME_DURATION, META_UPGRADES, MINI_BOSSES, PASSIVES, SWARM_MINUTES, WAVES, WEAPONS, metaUpgradeCost, resolveWeaponStats, weaponUpgradeDetail } from '../app/game/data';

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


test('Classic has exactly the requested mini-boss and main-boss minutes with usable rising budgets', () => {
  assert.deepEqual(MINI_BOSSES.map(b => b.minute), [1, 3, 7, 9, 11, 13, 17, 19, 21, 23, 27, 29]);
  assert.deepEqual(BOSSES.map(b => b.minute), [5, 10, 15, 20, 25, 30]);
  assert.deepEqual([...new Set(MINI_BOSSES.map(b => b.pattern))].sort(), ['charge', 'slam', 'volley']);
  const encounters = [...MINI_BOSSES, ...BOSSES];
  assert.equal(new Set(encounters.map(b => b.id)).size, encounters.length);
  assert.equal(new Set(encounters.map(b => b.minute)).size, encounters.length);
  for (const schedule of [MINI_BOSSES, BOSSES]) {
    for (const [index, boss] of schedule.entries()) {
      assert.ok(boss.name.trim() && boss.title.trim(), boss.id);
      assert.ok([boss.hp, boss.speed, boss.damage, boss.radius].every(v => Number.isFinite(v) && v > 0), boss.id);
      if (index) {
        assert.ok(boss.hp > schedule[index - 1].hp, `${boss.id} HP increases with progression`);
        assert.ok(boss.damage >= schedule[index - 1].damage, `${boss.id} contact damage does not fall behind`);
      }
    }
  }
  for (const mini of MINI_BOSSES) {
    assert.ok(Object.hasOwn(ENEMIES, mini.enemyId), mini.id);
    assert.ok(Number.isFinite(mini.xp) && mini.xp > 0, mini.id);
    assert.ok(Number.isSafeInteger(mini.gold) && mini.gold > 0, mini.id);
    assert.ok(mini.radius <= 50, `${mini.id} fits validated enemy collision bounds`);
    const nextMain = BOSSES.find(b => b.minute > mini.minute)!;
    assert.ok(mini.hp < nextMain.hp, `${mini.id} stays below the following main boss health budget`);
  }
  assert.equal(BOSSES.at(-1)?.id, 'death');
});
