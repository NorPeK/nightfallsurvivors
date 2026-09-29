import test from "node:test";
import assert from "node:assert/strict";
import { BOSSES, ENEMIES, MINI_BOSSES, WAVES, enemyHpScale } from "../app/game/data";
import { enemySprite } from "../app/game/sprites";

test("all eighteen encounters have exactly four times the pre-feedback health", () => {
  const previousMain = [700, 3400, 7500, 12500, 19500, 26000];
  const previousMini = [150, 300, 1300, 2100, 3200, 4200, 6200, 8000, 10000, 12000, 15500, 18500];
  assert.deepEqual(BOSSES.map(b => b.hp), previousMain.map(hp => hp * 4));
  assert.deepEqual(MINI_BOSSES.map(b => b.hp), previousMini.map(hp => hp * 4));
});

test("a new ordinary enemy joins every two minutes and mixed attacks persist", () => {
  const introduced = new Map<string, number>();
  for (const wave of WAVES) {
    for (const id of wave.enemies) if (!introduced.has(id)) introduced.set(id, wave.minute);
    if (wave.minute >= 4) {
      assert.ok(new Set(wave.enemies).size >= 3, `minute ${wave.minute} mixes familiar enemies`);
      assert.ok(wave.enemies.some(id => ENEMIES[id].attack), `minute ${wave.minute} has ranged pressure`);
      assert.ok(wave.enemies.some(id => !ENEMIES[id].attack), `minute ${wave.minute} also has pursuing enemies`);
    }
  }
  assert.equal(introduced.size, 15);
  assert.deepEqual([...introduced.values()], Array.from({ length: 15 }, (_, i) => i * 2));
  assert.deepEqual([...introduced.keys()].sort(), Object.keys(ENEMIES).sort());
  assert.equal(introduced.get("cultist"), 4);
  assert.ok(ENEMIES.brute.speed >= 60, "the minute-10 tank can close distance");
  assert.equal(ENEMIES.lancer.behavior, "charge");
  assert.equal(ENEMIES.banshee.attack, "fan");
});

test("ordinary enemy health grows continuously through the hunt without minute-boundary jumps", () => {
  assert.equal(enemyHpScale(0), 1, "the opening remains accessible");
  assert.ok(enemyHpScale(5 * 60) >= 2.3);
  assert.ok(enemyHpScale(10 * 60) >= 4);
  assert.ok(enemyHpScale(20 * 60) >= 9);
  assert.ok(enemyHpScale(30 * 60) >= 16);
  for (let time = 1; time <= 1800; time++) {
    const change = enemyHpScale(time) - enemyHpScale(time - 1);
    assert.ok(change > 0 && change < .02, `smooth HP growth at ${time}s`);
  }
  assert.equal(enemyHpScale(-60), 1);
  assert.equal(enemyHpScale(2100), enemyHpScale(1800), "the final duel does not inflate ordinary enemy stats indefinitely");
});

test("new enemies draw distinct silhouettes rather than blank or recolored existing bodies", () => {
  const previousDocument = globalThis.document;
  let commands: unknown[][] = [];
  const drawings: string[] = [];
  Object.assign(globalThis, {
    document: {
      createElement() {
        const context = new Proxy({}, {
          get(_target, name) { return (...args: unknown[]) => commands.push([name, ...args]); },
          set() { return true; },
        });
        return { width: 0, height: 0, getContext() { return context; } };
      },
    },
  });
  try {
    for (const id of ["lancer", "banshee", "scarab"]) {
      commands = [];
      const sprite = enemySprite(ENEMIES[id], false);
      assert.ok(sprite.width > ENEMIES[id].radius * 2);
      assert.ok(commands.some(([name]) => name === "fill"), `${id} has a visible body`);
      assert.ok(commands.some(([name]) => name === "lineTo"), `${id} has a recognizable outline`);
      drawings.push(JSON.stringify(commands));
    }
    assert.equal(new Set(drawings).size, 3);
  } finally {
    Object.assign(globalThis, { document: previousDocument });
  }
});
