/** Controlled combat comparison, not a full-run balance or browser-performance test.
 * node --import tsx scripts/diagnose-pressure.ts > qa-output/pressure.jsonl
 * PRESSURE_VARIANTS=meteor,void adds two late-game Void Sphere pairs.
 * The same script can be copied into an older checkout for a source-version comparison.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, BOSSES, ELITE_MINUTES, META_UPGRADES, MINI_BOSSES, SWARM_MINUTES, WEAPONS } from "../app/game/data";
import type { PassiveId, RunStats, UpgradeOption, WeaponId } from "../app/game/types";

function boundedSetting(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0 || value > maximum) throw new Error(`${name} must be between 0 (exclusive) and ${maximum}`);
  return value;
}
const seconds = boundedSetting("PRESSURE_SECONDS", 90, 90);
const cpuBudget = boundedSetting("PRESSURE_CPU_BUDGET", 45, 45);
const wallBudget = boundedSetting("PRESSURE_WALL_BUDGET", 90, 90);
const seed = Number(process.env.PRESSURE_SEED ?? 1903);
if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("PRESSURE_SEED must be an unsigned 32-bit integer");
const profile = process.env.PRESSURE_PROFILE ?? "fresh";
if (profile !== "fresh" && profile !== "partial") throw new Error("PRESSURE_PROFILE must be fresh or partial");
const variants = (process.env.PRESSURE_VARIANTS ?? "meteor").split(",");
if (!variants.length || variants.some(v => v !== "meteor" && v !== "void")) throw new Error("PRESSURE_VARIANTS must list meteor and/or void");
const requestedMinutes = (process.env.PRESSURE_MINUTES ?? "5,10,15,20").split(",").map(Number);
if (!requestedMinutes.length || requestedMinutes.some(m => ![5, 10, 15, 20].includes(m))) throw new Error("PRESSURE_MINUTES must list 5, 10, 15 and/or 20");
const weaponIds: WeaponId[] = ["bow", "orb", "fire", "swordwave", "frost", "daggers"];
const passiveIds: PassiveId[] = ["might", "tome", "eagle", "clover", "heart", "magnet"];
const fixtures = [
  { minute: 5, level: 13, weapons: [4, 2, 2, 1, 1, 1], passives: [1, 1, 1, 0, 1, 0] },
  { minute: 10, level: 25, weapons: [6, 4, 4, 2, 3, 2], passives: [2, 1, 2, 1, 2, 1] },
  { minute: 15, level: 36, weapons: [7, 5, 8, 3, 5, 3], passives: [3, 2, 3, 2, 2, 2] },
  { minute: 20, level: 50, weapons: [8, 7, 8, 6, 7, 5], passives: [4, 4, 3, 3, 3, 3] },
].filter(f => requestedMinutes.includes(f.minute));
type Fixture = typeof fixtures[number];
type Policy = "stationary" | "orbit";
const policies: Policy[] = ["stationary", "orbit"];
const cases = fixtures.flatMap(fixture => (fixture.minute < 15 ? ["none"] : [...new Set(variants)]).flatMap(variant => policies.map(policy => ({ fixture, variant, policy }))));
// Validate every requested fixture before spending time on any combat case.
for (const { fixture, variant } of cases) {
  const evolution = variant === "meteor" ? "fire" : variant === "void" ? "orb" : null;
  if (!evolution) continue;
  const ranks = [...fixture.weapons];
  if (variant === "void") [ranks[1], ranks[2]] = [ranks[2], ranks[1]];
  const partnerIndex = passiveIds.indexOf(WEAPONS[evolution].evolvesWith);
  if (ranks[weaponIds.indexOf(evolution)] !== WEAPONS[evolution].maxLevel || partnerIndex < 0 || fixture.passives[partnerIndex] <= 0) throw new Error(`Illegal ${variant} evolution fixture at minute ${fixture.minute}`);
}
const batchStart = performance.now(), batchCpu = process.cpuUsage();
let resourceBudgetReached = false;
const hash = createHash("sha256");
for (const path of ["app/game/engine.ts", "app/game/data.ts", "app/game/types.ts", "scripts/diagnose-pressure.ts"]) hash.update(path).update(readFileSync(path));
const sourceHash = hash.digest("hex");
const round = (value: number) => +value.toFixed(3);
function budgetReached() {
  const cpu = process.cpuUsage(batchCpu);
  return (cpu.user + cpu.system) / 1e6 >= cpuBudget || (performance.now() - batchStart) / 1000 >= wallBudget;
}

function run(fixture: Fixture, variant: string, policy: Policy) {
  let options: UpgradeOption[] = [], result: RunStats | null = null;
  const input = new Input();
  const game = new Game(input, {
    onPhaseChange() {}, onHud() {}, onLevelUp(draft) { options = draft; },
    onChest() {}, onRunEnd(end) { result = end; }, onBossWarning() {},
    onEvolutionChoice(draft) { options = draft; }, onCovenant() {},
  }, { seed, autoStart: false });
  const meta = { ...BASE_STATS };
  const metaRanks: Record<string, number> = {};
  if (profile === "partial") for (const upgrade of META_UPGRADES) {
    const rank = upgrade.id === "revival" ? 0 : Math.min(1, upgrade.maxLevel);
    metaRanks[upgrade.id] = rank; upgrade.apply(meta, rank);
  }
  game.startRun("ranger", meta);
  game.setViewport(1000, 600);
  game.time = fixture.minute * 60; // This is the only time assignment; the whole measured window runs normally.
  game.level = fixture.level;
  // Explicitly hold progression fixed, retaining real gem drops, collection and XP metrics.
  // This prevents orbit's collection advantage from changing the build being compared.
  game.xpNext = Number.MAX_SAFE_INTEGER;
  game.bossesSpawned = new Set(BOSSES.map(b => b.id));
  game.miniBossesSpawned = new Set(MINI_BOSSES.map(b => b.id));
  game.eliteSpawned = new Set(ELITE_MINUTES);
  game.swarmSpawned = new Set(SWARM_MINUTES);
  const ranks = [...fixture.weapons];
  if (variant === "void") [ranks[1], ranks[2]] = [ranks[2], ranks[1]];
  const evolved: WeaponId | null = variant === "meteor" ? "fire" : variant === "void" ? "orb" : null;
  game.weapons = weaponIds.map((id, i) => ({ id, level: ranks[i], evolved: id === evolved, timer: .4, alt: 0 }));
  game.passives = passiveIds.map((id, i) => ({ id, level: fixture.passives[i] })).filter(p => p.level > 0);
  (game as unknown as { recomputePassives(): void }).recomputePassives();
  if (game.weapons.filter(w => w.evolved).length > 1 || game.weapons.some(w => w.evolved && (w.level !== WEAPONS[w.id].maxLevel || !game.passives.some(p => p.id === WEAPONS[w.id].evolvesWith)))) throw new Error("Illegal fixture evolution");
  const startTime = game.time, startStats = { ...game.stats }, startHp = game.hp;
  const startBuild = game.weapons.map(w => `${w.id}:${w.level}${w.evolved ? "E" : ""}`);
  const startPassives = game.passives.map(p => `${p.id}:${p.level}`);
  const orbitRadius = 180, angularSpeed = 175 * game.stats.moveSpeed / orbitRadius;
  input.getMove = () => policy === "stationary" ? { x: 0, y: 0 } : { x: Math.cos((game.time - startTime) * angularSpeed), y: Math.sin((game.time - startTime) * angularSpeed) };
  let iterations = 0, sampledMaxEnemies = 0, sampledMaxHostileBullets = 0, sampledMaxPickups = 0, firstDamageTime: number | null = null;
  let draftCount = 0, chestCount = 0;
  const encounteredTypes = new Set<string>();
  const samples: { seconds: number; hp: number; damageTaken: number; kills: number; enemies: number; hostileBullets: number }[] = [];
  let nextSample = 0;
  const cpuStart = process.cpuUsage(), wallStart = performance.now();
  console.error(`Pressure ${fixture.minute}m/${variant}/${policy}`);
  while (game.time - startTime < seconds && !result) {
    if (++iterations % 30 === 0 && budgetReached()) { resourceBudgetReached = true; break; }
    if (game.phase === "levelup") {
      // Normally unreachable with fixed progression, but handle actual offered choices legally.
      const choice = options.find(o => o.kind === "heal" && game.hp < game.stats.maxHp * .6) ?? options[0];
      if (!choice) throw new Error("Draft opened without choices");
      game.applyUpgrade(choice); draftCount++; continue;
    }
    if (game.phase === "chest") { game.ackChest(); chestCount++; continue; }
    if (game.phase === "evolution") {
      const choice = options.find(o => o.id === evolved) ?? options[0];
      if (!choice || !game.chooseEvolution(choice.id)) throw new Error("Evolution choice failed");
      continue;
    }
    if (game.phase === "covenant") {
      if (game.covenant?.status === "offered") game.declineCovenant();
      else throw new Error("An unaccepted Covenant became active");
      continue;
    }
    if (game.phase !== "playing") throw new Error(`Unexpected phase ${game.phase}`);
    game.step(1 / 30);
    if (game.metrics.damageTaken > 0) firstDamageTime ??= game.time - startTime;
    const elapsed = game.time - startTime;
    if (elapsed >= nextSample || result) {
      nextSample = elapsed + 1;
      const enemies = game.enemies.filter(e => e.active);
      for (const enemy of enemies) encounteredTypes.add(enemy.def.id);
      const hostileBullets = game.enemyBullets.filter(b => b.active).length;
      sampledMaxEnemies = Math.max(sampledMaxEnemies, enemies.length);
      sampledMaxHostileBullets = Math.max(sampledMaxHostileBullets, hostileBullets);
      sampledMaxPickups = Math.max(sampledMaxPickups, game.pickups.filter(p => p.active).length);
      if (samples.length === 0 || elapsed >= samples.at(-1)!.seconds + 15 || result) samples.push({ seconds: round(elapsed), hp: round(game.hp), damageTaken: round(game.metrics.damageTaken), kills: game.kills, enemies: enemies.length, hostileBullets });
    }
  }
  const end = result as RunStats | null;
  const cpu = process.cpuUsage(cpuStart);
  const row = {
    minute: fixture.minute, variant, policy, seed, profile, hunter: "ranger", level: fixture.level,
    startBuild, startPassives, stats: startStats, metaRanks, startHp, orbitRadius: policy === "orbit" ? orbitRadius : null,
    outcome: end ? "defeat" : resourceBudgetReached ? "resource-budget" : "horizon", simulatedSeconds: round(game.time - startTime),
    hp: round(game.hp), damageTaken: round(game.metrics.damageTaken), healing: round(game.metrics.healing), firstDamageTime: firstDamageTime === null ? null : round(firstDamageTime),
    kills: game.kills, damageDealt: round(game.damageDealt), damageByWeapon: game.metrics.damageByWeapon, xpCollected: round(game.metrics.xpCollected),
    cause: end?.cause ?? null, encounteredTypes: [...encounteredTypes].sort(), sampledMaxEnemies, sampledMaxHostileBullets, sampledMaxPickups,
    draftCount, chestCount, endBuild: game.weapons.map(w => `${w.id}:${w.level}${w.evolved ? "E" : ""}`),
    samples, cpuSeconds: round((cpu.user + cpu.system) / 1e6), wallSeconds: round((performance.now() - wallStart) / 1000),
  };
  game.dispose();
  return row;
}

console.log(JSON.stringify({ metadata: true, label: process.env.PRESSURE_LABEL ?? "current", sourceHash, node: process.version, seconds, cpuBudget, wallBudget, requestedRuns: cases.length,
  fixture: "Fresh Ranger by default; six legal weapons with graded ranks and passives; no evolution before minute15, exactly one thereafter. Empty initial field, normal ordinary spawning and normal combat stats/HP. A single starting time assignment; no time jumps inside each window.",
  controls: "Same seed, starting equipment/stats and viewport for stationary/orbit pairs. XP threshold is explicitly MAX_SAFE_INTEGER to freeze leveling while preserving pickup collection. All authored bosses/minis/elites/swarms marked delivered to isolate ordinary horde. Covenants declined. No invulnerability, manual heals or injected pickups. Natural meat/magnet/bomb drops and hunter movement trait remain active; report damageByWeapon/healing and XP collection.",
  limitations: "Controlled fixtures do not establish what equipment a human earns at each minute. Orbit is a fixed radius180 path, not reactive dodging. Movement changes targeting, collection and spawn geometry. Simulation only; no visual, input or device-performance claims." }));
const rows: ReturnType<typeof run>[] = [];
for (const trial of cases) {
  if (budgetReached()) { resourceBudgetReached = true; break; }
  const row = run(trial.fixture, trial.variant, trial.policy);
  rows.push(row); console.log(JSON.stringify(row));
  if (resourceBudgetReached) break;
}
const cpu = process.cpuUsage(batchCpu);
console.log(JSON.stringify({ summary: true, runs: rows.length, requestedRuns: cases.length, defeats: rows.filter(r => r.outcome === "defeat").length, horizons: rows.filter(r => r.outcome === "horizon").length, resourceBudgetReached, cpuSeconds: round((cpu.user + cpu.system) / 1e6), wallSeconds: round((performance.now() - batchStart) / 1000),
  pairs: fixtures.flatMap(f => ["none", "meteor", "void"].flatMap(variant => {
    const stationary = rows.find(r => r.minute === f.minute && r.variant === variant && r.policy === "stationary");
    const orbit = rows.find(r => r.minute === f.minute && r.variant === variant && r.policy === "orbit");
    if (!stationary || !orbit) return [];
    return [{ minute: f.minute, variant, stationarySeconds: stationary.simulatedSeconds, orbitSeconds: orbit.simulatedSeconds, stationaryDamage: stationary.damageTaken, orbitDamage: orbit.damageTaken, stationaryOutcome: stationary.outcome, orbitOutcome: orbit.outcome }];
  })) }));
