/** Bounded simulation-only diagnostics. No canvas, React, persistence transport or device FPS claims.
 * BENCHMARK_SECONDS=20 node --import tsx scripts/benchmark-simulation.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, BOSSES, ELITE_MINUTES, ENEMIES, META_UPGRADES, SWARM_MINUTES } from "../app/game/data";
import type { WeaponId } from "../app/game/types";

const seconds = Number(process.env.BENCHMARK_SECONDS ?? 20);
if (!Number.isFinite(seconds) || seconds < 1 || seconds > 60) throw new Error("BENCHMARK_SECONDS must be between1 and60");
const hash = createHash("sha256");
for (const path of ["app/game/engine.ts", "app/game/data.ts", "scripts/benchmark-simulation.ts"]) hash.update(path).update(readFileSync(path));
console.log(JSON.stringify({ metadata: true, sourceHash: hash.digest("hex"), node: process.version, seconds,
  note: "Fixed120Hz simulation only.5s warmup; memory sampled each simulated second. Targets/player have enormous HP to sustain pressure. No rendering, input dispatch, bot planning, UI or save transport.20CPU-second budget per scene." }));

for (const scene of [{ name: "early", enemies: 80, pickups: 80, minute: 0, full: false, boss: false },
  { name: "dense", enemies: 300, pickups: 700, minute: 29, full: true, boss: false },
  { name: "final-boss", enemies: 120, pickups: 200, minute: 30, full: true, boss: true }]) {
  const input = new Input();
  const game = new Game(input, { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onRunEnd() {}, onBossWarning() {} }, { seed: 29092026, autoStart: false });
  const stats = { ...BASE_STATS };
  if (scene.full) for (const upgrade of META_UPGRADES) upgrade.apply(stats, upgrade.maxLevel);
  stats.maxHp = 1e9;
  game.startRun("mage", stats); game.setViewport(1000, 600); game.time = scene.minute * 60; game.spawnTimer = 1e9;
  game.bossesSpawned = new Set(BOSSES.map(b => b.id)); game.eliteSpawned = new Set(ELITE_MINUTES); game.swarmSpawned = new Set(SWARM_MINUTES);
  if (scene.full) {
    game.weapons = (["orb", "bow", "lightning", "frost", "fire", "aura"] as WeaponId[]).map(id => ({ id, level: 8, evolved: true, timer: 0, alt: 0 }));
    game.passives = (["might", "tome", "crystal", "eagle", "heart", "magnet"] as const).map(id => ({ id, level: 5 }));
    (game as unknown as { recomputePassives(): void }).recomputePassives();
  }
  const definitions = Object.values(ENEMIES);
  for (let i = 0; i < scene.enemies; i++) {
    const e = game.spawnEnemy(definitions[i % definitions.length], i % 30 === 0)!;
    const angle = i * 2.399, radius = 120 + i % 19 * 13;
    Object.assign(e, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, hp: 1e9, maxHp: 1e9, damage: 0 });
  }
  for (let i = 0; i < scene.pickups; i++) game.dropPickup("gem", 3000 + i * 7, 3000, 1);
  if (scene.boss) {
    game.finalPhase = true; game.spawnBoss(BOSSES[2]);
    Object.assign(game.boss!, { x: 250, y: 0, hp: 4e8, maxHp: 1e9 }); // sustained enraged-finale pressure
  }
  input.getMove = () => ({ x: Math.cos(game.time * .25), y: Math.sin(game.time * .25) });
  for (let i = 0; i < 600; i++) game.step(1 / 120);
  const durations: number[] = [], startCpu = process.cpuUsage(), startWall = performance.now(), startTime = game.time;
  let peakHeap = 0, peakRss = 0, maxEnemies = 0, maxBullets = 0, maxHostileBullets = 0, budgetReached = false;
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    if (game.phase !== "playing") throw new Error(`Unexpected ${game.phase} in ${scene.name}`);
    const start = performance.now(); game.step(1 / 120); durations.push(performance.now() - start);
    if (i % 120 === 0) {
      const memory = process.memoryUsage(), cpu = process.cpuUsage(startCpu);
      peakHeap = Math.max(peakHeap, memory.heapUsed); peakRss = Math.max(peakRss, memory.rss);
      maxEnemies = Math.max(maxEnemies, game.enemies.filter(e => e.active).length);
      maxBullets = Math.max(maxBullets, game.bullets.filter(b => b.active).length);
      maxHostileBullets = Math.max(maxHostileBullets, game.enemyBullets.filter(b => b.active).length);
      if ((cpu.user + cpu.system) / 1e6 >= 20) { budgetReached = true; break; }
    }
  }
  const cpu = process.cpuUsage(startCpu), wall = performance.now() - startWall;
  const snapshotStart = performance.now(), snapshot = JSON.stringify(game.exportSnapshot());
  const snapshotMs = performance.now() - snapshotStart;
  const sorted = [...durations].sort((a, b) => a - b), percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  console.log(JSON.stringify({ scene: scene.name, simulatedSeconds: +(game.time - startTime).toFixed(3), ticks: durations.length, budgetReached,
    cpuSeconds: +((cpu.user + cpu.system) / 1e6).toFixed(3), wallSeconds: +(wall / 1000).toFixed(3),
    meanTickMs: +(durations.reduce((sum, n) => sum + n, 0) / durations.length).toFixed(4), p95TickMs: +percentile(.95).toFixed(4), p99TickMs: +percentile(.99).toFixed(4),
    sampledPeakHeapMiB: +(peakHeap / 1048576).toFixed(2), sampledPeakRssMiB: +(peakRss / 1048576).toFixed(2),
    sampledMaxEnemies: maxEnemies, sampledMaxBullets: maxBullets, sampledMaxHostileBullets: maxHostileBullets,
    snapshotBytes: Buffer.byteLength(snapshot), snapshotMs: +snapshotMs.toFixed(3) }));
  game.dispose();
}
