import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS } from "../app/game/data";
import type { RunStats, UpgradeOption, WeaponId } from "../app/game/types";

// Opt-in because this advances a complete thirty-minute director at 120 Hz.
// Invulnerability/max equipment isolate scheduling and state. This is not a balance or device benchmark.
test("continuous Classic director reaches victory with every scheduled event", { skip: process.env.RUN_LONG !== "1" }, () => {
  let draft: UpgradeOption[] = [];
  const results: RunStats[] = [];
  const input = new Input(); let move = { x: 0, y: 0 }; input.getMove = () => move;
  const game = new Game(input, { onPhaseChange() {}, onHud() {}, onLevelUp(o) { draft = o; }, onChest() {}, onBossWarning() {}, onRunEnd(s) { results.push(s); } }, { seed: 20260928, autoStart: false });
  game.startRun("mage", { ...BASE_STATS, maxHp: 1e9, regen: 1e6, magnet: 500 });
  game.weapons = (["swordwave", "orb", "lightning", "frost", "fire", "aura"] as WeaponId[]).map((id) => ({ id, level: 8, evolved: true, timer: 0, alt: 0 }));
  let peakSnapshot = 0;
  for (let i = 0; i < 246000 && !results.length; i++) {
    if (game.phase === "levelup") { game.applyUpgrade(draft.find((o) => o.id === "might") ?? draft.find((o) => o.id === "crystal") ?? draft[0]); continue; }
    if (game.phase === "chest") { game.ackChest(); continue; }
    const angle = game.time * .045; move = { x: Math.cos(angle) * .25, y: Math.sin(angle) * .25 };
    game.step(1 / 120);
    if (i % 7200 === 0) {
      const snapshot = game.exportSnapshot(); peakSnapshot = Math.max(peakSnapshot, JSON.stringify(snapshot).length);
      // Validate periodically that production saves can actually restore their own payload.
      const restore = new Game(new Input(), { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onBossWarning() {}, onRunEnd() {} }, { autoStart: false });
      assert.equal(restore.importSnapshot(JSON.parse(JSON.stringify(snapshot))), true); restore.dispose();
    }
  }
  assert.equal(results.length, 1); assert.equal(results[0].won, true);
  assert.deepEqual(game.metrics.bossesDefeated, ["colossus", "lich", "death"]);
  assert.equal(game.eliteSpawned.size, 14); assert.equal(game.swarmSpawned.size, 7);
  assert.ok(peakSnapshot < 900_000); assert.ok(game.time >= 1800);
});
