import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, BOSSES, MINI_BOSSES, ELITE_MINUTES, SWARM_MINUTES } from "../app/game/data";
import type { RunStats, UpgradeOption, WeaponId } from "../app/game/types";

// Opt-in because this advances a complete thirty-minute director at 120 Hz.
// Huge HP/damage and max ranks isolate scheduling/state with one legal evolution.
// This is not a balance or device benchmark.
test("continuous Classic director reaches victory with every scheduled event", { skip: process.env.RUN_LONG !== "1" }, (t) => {
  let draft: UpgradeOption[] = [];
  const results: RunStats[] = [];
  const input = new Input(); let move = { x: 0, y: 0 }; input.getMove = () => move;
  const game = new Game(input, { onPhaseChange() {}, onHud() {}, onLevelUp(o) { draft = o; }, onChest() {}, onBossWarning() {}, onRunEnd(s) { results.push(s); } }, { seed: 20260928, autoStart: false });
  game.startRun("mage", { ...BASE_STATS, maxHp: 1e9, regen: 1e6, magnet: 500, might: 12 });
  game.weapons = (["swordwave", "orb", "lightning", "frost", "fire", "aura"] as WeaponId[]).map((id) => ({ id, level: 8, evolved: id === "fire", timer: 0, alt: 0 }));
  let peakSnapshot = 0;
  for (let i = 0; i < 246000 && !results.length; i++) {
    if (game.phase === "levelup") { game.applyUpgrade(draft.find((o) => o.id === "might") ?? draft.find((o) => o.id === "crystal") ?? draft[0]); continue; }
    if (game.phase === "chest") { game.ackChest(); continue; }
    const angle = game.time * .045; move = { x: Math.cos(angle) * .25, y: Math.sin(angle) * .25 };
    game.step(1 / 120);
    if (i % 7200 === 0) {
      const snapshot = game.exportSnapshot(); peakSnapshot = Math.max(peakSnapshot, Buffer.byteLength(JSON.stringify(snapshot)));
      // Validate periodically that production saves can actually restore their own payload.
      const restore = new Game(new Input(), { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onBossWarning() {}, onRunEnd() {} }, { autoStart: false });
      assert.equal(restore.importSnapshot(JSON.parse(JSON.stringify(snapshot))), true); restore.dispose();
    }
  }
  t.diagnostic(JSON.stringify({ simulatedSeconds: +game.time.toFixed(3), mainBosses: game.metrics.bossesDefeated, miniBosses: game.metrics.miniBossesDefeated, miniBossesSpawned: [...game.miniBossesSpawned], elites: game.eliteSpawned.size, swarms: game.swarmSpawned.size, sampledPeakSnapshotBytes: peakSnapshot }));
  assert.equal(results.length, 1); assert.equal(results[0].won, true);
  assert.deepEqual(game.metrics.bossesDefeated, BOSSES.map(b => b.id));
  assert.equal(new Set(game.metrics.miniBossesDefeated).size, game.metrics.miniBossesDefeated!.length);
  assert.ok(game.metrics.miniBossesDefeated!.every(id => MINI_BOSSES.some(b => b.id === id)));
  assert.deepEqual([...game.bossesSpawned], BOSSES.map(b => b.id));
  assert.deepEqual([...game.miniBossesSpawned], MINI_BOSSES.map(b => b.id));
  assert.deepEqual([...game.eliteSpawned].sort((a,b) => a-b), ELITE_MINUTES);
  assert.deepEqual([...game.swarmSpawned].sort((a,b) => a-b), SWARM_MINUTES);
  assert.ok(peakSnapshot < 900_000); assert.ok(game.time >= 1800);
  game.dispose();
});
