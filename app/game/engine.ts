// =====================================================================
// NORPEK: Nightfall Survivors — core engine
// Vampire Survivors-style horde survival: auto weapons, XP gems,
// level-up drafts, chest evolutions, elites, swarm events and three
// bosses (5 / 15 / 30 min). Beat the 30-minute boss to win.
// =====================================================================

import {
  WEAPONS,
  PASSIVES,
  ENEMIES,
  BOSSES,
  WAVES,
  SWARM_MINUTES,
  ELITE_MINUTES,
  ENCOUNTER_SPACING,
  CHARACTERS,
  GAME_DURATION,
  MAX_WEAPONS,
  MAX_PASSIVES,
  enemyHpScale,
  enemyDmgScale,
  enemyXpScale,
  xpForLevel,
  resolveWeaponStats,
  weaponUpgradeDetail,
  COVENANT_REWARDS,
  FROST_NOVA_FREEZE,
} from "./data";
import type {
  CharacterId,
  EnemyDef,
  BossDef,
  PlayerStats,
  UpgradeOption,
  ChestReward,
  HudState,
  RunStats,
  WeaponId,
  PassiveId,
  RunPhase,
  RunMetrics,
  DraftTools,
  CovenantState,
  CovenantOption,
  CovenantId,
} from "./types";
import { Input } from "./input";
import { audio } from "./audio";

// ---------------------------------------------------------------- entities

export interface Enemy {
  id: number;
  hitCooldowns: Record<string, number>;
  chargeX: number;
  chargeY: number;
  windup: number;
  active: boolean;
  def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  elite: boolean;
  hitFlash: number;
  slowT: number; // remaining slow time
  slowF: number; // speed factor while slowed (0 = frozen)
  kx: number; // knockback velocity
  ky: number;
  orbCd: number; // per-enemy cooldown vs orbitals / void / aura ticks
  wobble: number; // personal phase for animation
  charge: number; // hellhound charge state timer
  charging: boolean;
  faceX: number;
}

export interface Boss {
  id: number;
  hitCooldowns: Record<string, number>;
  def: BossDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  t1: number; // attack timers
  t2: number;
  t3: number;
  enraged: boolean;
  faceX: number;
  windup: number; // dash windup
  dashT: number;
  dashX: number;
  dashY: number;
  spiralA: number;
  spiralN: number;
  spiralT: number;
}

export interface Bullet {
  hitIds: Set<number>;
  source: WeaponId;
  slowDuration: number;
  active: boolean;
  kind: "arrow" | "orb" | "shard" | "fireball" | "meteor";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  damage: number;
  radius: number;
  pierce: number;
  angle: number;
  evolved: boolean;
  // meteor target
  tx: number;
  ty: number;
  aoe: number;
}

export interface EnemyBullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
  color: string;
  spin: number;
}

export interface Pickup {
  active: boolean;
  kind: "gem" | "coin" | "meat" | "magnet" | "bomb" | "chest";
  x: number;
  y: number;
  value: number;
  tier: number;
  vx: number;
  vy: number;
  attracted: boolean;
  bob: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: "puff" | "spark" | "ember" | "soul";
}

export interface DamageNumber {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  value: number;
  crit: boolean;
  heal: boolean;
}

export interface Fx {
  kind: "slash" | "ring" | "bolt" | "explosion" | "telegraph" | "nova" | "summon";
  x: number;
  y: number;
  x2: number;
  y2: number;
  t: number;
  dur: number;
  radius: number;
  color: string;
  angle: number;
  arc: number;
  shape?: "circle" | "line";
}

interface ScheduledAction { remaining: number; runId: string; owner?: number; kind: "slash" | "lightning" | "meteor" | "slam" | "teleport"; args: number[]; evolved: boolean }

interface WeaponState {
  id: WeaponId;
  level: number;
  evolved: boolean;
  timer: number;
  alt: number; // alternation counter (sword directions etc.)
}

interface PassiveState {
  id: PassiveId;
  level: number;
}

export interface Callbacks {
  onPhaseChange: (phase: RunPhase) => void;
  onHud: (hud: HudState) => void;
  onLevelUp: (options: UpgradeOption[]) => void;
  onChest: (rewards: ChestReward[]) => void;
  onRunEnd: (stats: RunStats) => void;
  onBossWarning: (name: string, title: string) => void;
  onRunStart?: (runId: string, hunter: CharacterId) => void;
  onProgress?: (stats: RunStats) => void;
  onEvolutionChoice?: (options: UpgradeOption[]) => void;
  onCovenant?: (options: CovenantOption[]) => void;
  onError?: (message: string) => void;
}

const TAU = Math.PI * 2;
const AUTHORED_ENCOUNTERS = [
  ...ELITE_MINUTES.map((minute) => ({ kind: "elite" as const, minute, at: minute * 60 + 25 })),
  ...SWARM_MINUTES.map((minute) => ({ kind: "swarm" as const, minute, at: minute * 60 + 28 })),
].sort((a, b) => a.at - b.at);

// ---------------------------------------------------------------- engine

export class Game {
  // world
  time = 0;
  running = false;
  phase: RunPhase = "playing";
  camX = 0;
  camY = 0;
  shake = 0;
  finalPhase = false; // 30:00 reached, final boss active

  // player
  px = 0;
  py = 0;
  hp = 100;
  stats: PlayerStats;
  charId: CharacterId = "knight";
  level = 1;
  xp = 0;
  xpNext = xpForLevel(1);
  kills = 0;
  runGold = 0;
  damageDealt = 0;
  iframes = 0;
  faceX = 1;
  moving = false;
  walkT = 0;
  hurtFlash = 0;
  healFlash = 0;
  reviveFx = 0;

  weapons: WeaponState[] = [];
  passives: PassiveState[] = [];

  // pools
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  enemyBullets: EnemyBullet[] = [];
  pickups: Pickup[] = [];
  particles: Particle[] = [];
  dmgNums: DamageNumber[] = [];
  fx: Fx[] = [];
  boss: Boss | null = null;
  bossesSpawned = new Set<string>();

  // orbital daggers state
  orbAngle = 0;

  // spawn director
  spawnTimer = 0;
  private encounterCooldown = 0;
  eliteSpawned = new Set<number>();
  swarmSpawned = new Set<number>();

  // misc
  debug = false;
  input: Input;
  cb: Callbacks;
  private raf = 0;
  private lastT = 0;
  private hudTimer = 0;
  private grid = new Map<number | string, number[]>(); // spatial hash -> enemy indices
  private gridDisplacement = 0; // maximum possible displacement since indexing, from persistent pulls
  private pendingChest = 0;
  levelUpsQueued = 0;
  victoryT = 0;

  runId = "";
  private runSerial = 0;
  private entitySerial = 0;
  private randomState: number;
  private visualState = 0x9e3779b9;
  private autoStart: boolean;
  private disposed = false;
  private terminal = false;
  private accumulator = 0;
  private suspensionReasons = new Set<string>();
  private scheduled: ScheduledAction[] = [];
  private currentChest: ChestReward[] = [];
  private deferredPickups: { kind: Pickup["kind"]; x: number; y: number; value: number }[] = [];
  private viewport = { width: 1000, height: 600 };
  private currentDraft: UpgradeOption[] = [];
  private banished = new Set<string>();
  draftTools: DraftTools = { rerolls: 3, skips: 2, banishes: 1 };
  covenant: CovenantState | null = null;
  private traitCharge = 0;
  private traitCooldown = 0;
  private traitCasts = 0;
  private lastAim = 0;
  private source = "other";
  private progressTimer = 0;
  private progressDirty = false;
  private qaInvulnerable = false;
  private damageCause = "The horde";
  metrics: RunMetrics = this.blankMetrics();

  constructor(input: Input, cb: Callbacks, options: { seed?: number; autoStart?: boolean; debug?: boolean } = {}) {
    this.randomState = (options.seed ?? Date.now()) >>> 0 || 1;
    this.autoStart = options.autoStart ?? true;
    this.debug = options.debug === true && process.env.NODE_ENV !== "production";
    this.input = input;
    this.cb = cb;
    this.stats = { ...({} as PlayerStats) };
    for (let i = 0; i < 400; i++) this.enemies.push(this.blankEnemy());
    for (let i = 0; i < 300; i++) this.bullets.push(this.blankBullet());
    for (let i = 0; i < 120; i++) this.enemyBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0, radius: 7, color: "#fff", spin: 0 });
    for (let i = 0; i < 700; i++) this.pickups.push({ active: false, kind: "gem", x: 0, y: 0, value: 0, tier: 0, vx: 0, vy: 0, attracted: false, bob: this.visualRandom() * TAU });
    for (let i = 0; i < 500; i++) this.particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: "#fff", kind: "puff" });
    for (let i = 0; i < 90; i++) this.dmgNums.push({ active: false, x: 0, y: 0, vy: 0, life: 0, value: 0, crit: false, heal: false });
  }

  private blankEnemy(): Enemy {
    return {
      id: 0, hitCooldowns: {}, chargeX: 0, chargeY: 0, windup: 0,
      active: false, def: ENEMIES.bat, x: 0, y: 0, hp: 1, maxHp: 1, speed: 0, damage: 0,
      radius: 10, xp: 1, elite: false, hitFlash: 0, slowT: 0, slowF: 1, kx: 0, ky: 0,
      orbCd: 0, wobble: this.random() * TAU, charge: 0, charging: false, faceX: 1,
    };
  }
  private blankBullet(): Bullet {
    return {
      hitIds: new Set(), source: "bow", slowDuration: 1.6,
      active: false, kind: "arrow", x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
      damage: 0, radius: 5, pierce: 0, angle: 0, evolved: false, tx: 0, ty: 0, aoe: 0,
    };
  }

  // ------------------------------------------------------------- run setup

  startRun(charId: CharacterId, metaStats: PlayerStats) {
    if (this.disposed) return;
    this.stop();
    const char = CHARACTERS.find((c) => c.id === charId);
    if (!char) throw new Error("Unknown hunter");
    this.runId = `${Date.now().toString(36)}-${this.randomState.toString(36)}-${++this.runSerial}`;
    this.terminal = false;
    this.accumulator = 0;
    this.passiveBase = null;
    this.deferredPickups = [];
    this.currentDraft = []; this.currentChest = [];
    this.suspensionReasons.delete("error");
    this.banished.clear();
    this.draftTools = { rerolls: 3, skips: 2, banishes: 1 };
    this.covenant = null;
    this.encounterCooldown = 0;
    this.traitCharge = this.traitCooldown = this.traitCasts = 0;
    this.lastAim = 0;
    this.metrics = this.blankMetrics();
    this.progressTimer = 0; this.progressDirty = false; this.qaInvulnerable = false;
    this.damageCause = "The horde";
    this.charId = charId;
    this.stats = { ...metaStats };
    // apply character modifiers
    const cs = char.stats;
    if (cs.maxHp !== undefined) this.stats.maxHp = Math.round(this.stats.maxHp * (cs.maxHp / 100));
    if (cs.moveSpeed !== undefined) this.stats.moveSpeed *= cs.moveSpeed;
    if (cs.might !== undefined) this.stats.might *= cs.might;
    if (cs.area !== undefined) this.stats.area *= cs.area;
    if (cs.critChance !== undefined) this.stats.critChance += cs.critChance - 0.05;
    if (cs.armor !== undefined) this.stats.armor += cs.armor;

    this.passiveBase = { ...this.stats };
    this.time = 0;
    this.px = 0;
    this.py = 0;
    this.camX = 0;
    this.camY = 0;
    this.hp = this.stats.maxHp;
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpForLevel(1);
    this.kills = 0;
    this.runGold = 0;
    this.damageDealt = 0;
    this.iframes = 0;
    this.faceX = 1; this.moving = false; this.walkT = this.hurtFlash = this.healFlash = this.reviveFx = 0; this.hudTimer = 0;
    this.shake = 0;
    this.finalPhase = false;
    this.weapons = [{ id: char.weapon, level: 1, evolved: false, timer: 0.4, alt: 0 }];
    this.passives = [];
    this.enemies.forEach((e) => (e.active = false));
    this.bullets.forEach((b) => (b.active = false));
    this.enemyBullets.forEach((b) => (b.active = false));
    this.pickups.forEach((p) => (p.active = false));
    this.particles.forEach((p) => (p.active = false));
    this.dmgNums.forEach((d) => (d.active = false));
    this.fx = [];
    this.boss = null;
    this.bossesSpawned.clear();
    this.eliteSpawned.clear();
    this.swarmSpawned.clear();
    this.spawnTimer = 0;
    this.orbAngle = 0;
    this.pendingChest = 0;
    this.levelUpsQueued = 0;
    this.victoryT = 0;
    this.cb.onRunStart?.(this.runId, charId);
    this.setPhase("playing");
    this.start();
    this.cb.onHud(this.hudSnapshot());
  }

  private blankMetrics(): RunMetrics {
    return { damageByWeapon: {}, overkill: 0, damageTaken: 0, healing: 0, xpCollected: 0, goldBySource: {}, bossesDefeated: [], evolutions: [] };
  }
  private random() {
    // Xorshift32: all gameplay decisions use this stream, never renderer/audio randomness.
    let n = this.randomState;
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    this.randomState = n >>> 0;
    return this.randomState / 0x100000000;
  }
  private rand(a: number, b: number) { return a + this.random() * (b - a); }
  private visualRandom() {
    this.visualState = (Math.imul(1664525, this.visualState) + 1013904223) >>> 0;
    return this.visualState / 0x100000000;
  }
  private visualRand(a: number, b: number) { return a + this.visualRandom() * (b - a); }
  get suspended() { return this.suspensionReasons.size > 0; }
  setViewport(width: number, height: number) {
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) this.viewport = { width, height };
  }
  private outsideView(padding = 100) {
    const angle = this.random() * TAU;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const distance = Math.min((this.viewport.width / 2 + padding) / Math.max(.001, Math.abs(dx)), (this.viewport.height / 2 + padding) / Math.max(.001, Math.abs(dy)));
    return { x: this.camX + dx * distance, y: this.camY + dy * distance };
  }
  private frame = (now: number) => {
    this.raf = 0;
    if (!this.running || this.suspended || this.phase !== "playing") return;
    const dt = Math.max(0, Math.min(.25, (now - this.lastT) / 1000));
    this.lastT = now;
    try { this.step(dt); }
    catch (error) {
      this.setSuspended("error", true);
      this.cb.onError?.(error instanceof Error ? error.message : "The run stopped safely.");
    }
    this.queueFrame();
  };
  private queueFrame() {
    if (this.autoStart && this.running && !this.suspended && this.phase === "playing" && !this.raf && typeof requestAnimationFrame !== "undefined") this.raf = requestAnimationFrame(this.frame);
  }
  start() { this.running = true; this.lastT = performance.now(); this.queueFrame(); }
  stop() {
    this.running = false;
    if (this.raf && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.scheduled = [];
    this.accumulator = 0;
  }
  dispose() { this.stop(); this.disposed = true; this.cb = { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onRunEnd() {}, onBossWarning() {} }; }
  setSuspended(reason: string, suspended: boolean) {
    if (suspended) this.suspensionReasons.add(reason); else this.suspensionReasons.delete(reason);
    if (this.raf && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(this.raf);
    this.raf = 0; this.accumulator = 0; this.lastT = performance.now();
    this.input.keys.clear(); this.input.joystick.active = false;
    this.queueFrame();
  }
  /** Feed wall-clock elapsed time; fixed 120 Hz steps make collision and seeded runs render-independent. */
  step(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0 || this.suspended || this.terminal || this.phase !== "playing" || this.disposed) return;
    this.accumulator += Math.min(.25, dt);
    const tick = 1 / 120;
    while (this.accumulator + 1e-10 >= tick && this.phase === "playing" && !this.terminal && !this.suspended) {
      this.accumulator = Math.max(0, this.accumulator - tick);
      this.update(tick);
    }
    if (this.phase !== "playing" || this.terminal) this.accumulator = 0;
  }
  setPhase(p: RunPhase) {
    if (this.terminal && p !== "gameover" && p !== "victory") return;
    this.phase = p;
    if (p !== "playing" && this.raf && typeof cancelAnimationFrame !== "undefined") { cancelAnimationFrame(this.raf); this.raf = 0; }
    this.cb.onPhaseChange(p);
    this.lastT = performance.now();
    this.queueFrame();
  }
  pause() { if (this.phase === "playing" && !this.terminal) this.setPhase("paused"); }
  resume() { if (this.phase === "paused" && !this.terminal) this.setPhase("playing"); }
  abandonRun() { if (this.runId && !this.terminal) this.endRun(false, true); }
  private schedule(delay: number, kind: ScheduledAction["kind"], args: number[], evolved = false, owner?: number) {
    if (this.terminal || this.disposed) return;
    this.scheduled.push({ remaining: delay, runId: this.runId, owner, kind, args, evolved });
  }
  private updateScheduled(dt: number) {
    const pending = this.scheduled; this.scheduled = [];
    for (const action of pending) {
      if (this.terminal) return;
      if (action.runId !== this.runId || (action.owner !== undefined && this.boss?.id !== action.owner)) continue;
      action.remaining -= dt;
      if (action.remaining > 0) { this.scheduled.push(action); continue; }
      const a = action.args;
      if (action.kind === "slash") this.slash(a[0], a[1], a[2], action.evolved);
      if (action.kind === "lightning") this.lightningStrike(a[0], a[1], a[2], a[3], action.evolved);
      if (action.kind === "slam") this.bossSlam(a[0], a[1], a[2], a[3]);
      if (action.kind === "teleport" && this.boss) {
        const b = this.boss;
        this.burst(b.x, b.y, 16, b.def.glow, 130);
        b.x = a[0]; b.y = a[1];
        for (let i = 0; i < 3; i++) {
          const e = this.spawnEnemy(ENEMIES.wraith, false);
          if (e) { e.x = b.x + this.rand(-80, 80); e.y = b.y + this.rand(-80, 80); e.windup = .8; }
        }
        this.buildGrid();
      }
      if (action.kind === "meteor") {
        this.source = "fire";
        this.addFx({ kind: "telegraph", shape: "circle", x: a[0], y: a[1], x2: 0, y2: 0, t: 0, dur: .65, radius: a[3], color: "#ff9f5b", angle: 0, arc: 0 });
        const b = this.spawnBullet("meteor", a[0] - 180, a[1] - 420, 180 / .65, 420 / .65, a[2], 13, 0, .65, true, a[3]);
        if (b) { b.tx = a[0]; b.ty = a[1]; }
      }
    }
  }

  // ------------------------------------------------------------- main update

  private update(dt: number) {
    this.time += dt;
    this.traitCooldown = Math.max(0, this.traitCooldown - dt);
    this.updatePlayer(dt);
    this.updateSpawning(dt, Math.min(this.time, GAME_DURATION));
    this.buildGrid();
    this.updateEnemies(dt);
    if (this.terminal) return;
    this.updateBoss(dt);
    if (this.terminal) return;
    this.buildGrid();
    this.updateScheduled(dt);
    if (this.terminal) return;
    this.updateWeapons(dt);
    if (this.terminal) return;
    this.updateBullets(dt);
    if (this.terminal) return;
    this.updateEnemyBullets(dt);
    if (this.terminal) return;
    this.flushPickups();
    this.updatePickups(dt);
    if (this.terminal) return;
    this.updateCovenant(dt);
    this.updateParticles(dt);
    this.updateFx(dt);
    this.updateDmgNums(dt);
    this.shake = Math.max(0, this.shake - dt * 18);
    this.camX += (this.px - this.camX) * Math.min(1, dt * 6);
    this.camY += (this.py - this.camY) * Math.min(1, dt * 6);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.hudTimer = .1; this.cb.onHud(this.hudSnapshot()); }
    this.progressTimer -= dt;
    if (this.progressTimer <= 0 || this.progressDirty) { this.progressTimer = 5; this.emitProgress(true); }
    if (!this.finalPhase && this.time >= GAME_DURATION) this.enterFinalPhase();
  }

  private updatePlayer(dt: number) {
    const mv = this.input.getMove();
    const speed = 175 * this.stats.moveSpeed;
    this.px += mv.x * speed * dt;
    this.py += mv.y * speed * dt;
    this.moving = Math.abs(mv.x) + Math.abs(mv.y) > 0.01;
    if (Math.abs(mv.x) > 0.01) this.faceX = Math.sign(mv.x);
    if (this.moving) this.lastAim = Math.atan2(mv.y, mv.x);
    this.traitCharge = Math.min(4, this.traitCharge + ((this.charId !== "ranger" || this.moving) ? dt : -this.traitCharge));
    if (this.moving) this.walkT += dt * 9;
    this.iframes = Math.max(0, this.iframes - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.healFlash = Math.max(0, this.healFlash - dt);
    this.reviveFx = Math.max(0, this.reviveFx - dt);
    if (this.stats.regen > 0 && this.hp < this.stats.maxHp) {
      this.metrics.healing += Math.min(this.stats.regen * dt, this.stats.maxHp - this.hp);
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);
    }
    // Sanctuary heal
    const aura = this.weapons.find((w) => w.id === "aura");
    if (aura?.evolved && this.hp < this.stats.maxHp) {
      this.metrics.healing += Math.min(1.2 * dt, this.stats.maxHp - this.hp);
      this.hp = Math.min(this.stats.maxHp, this.hp + 1.2 * dt);
    }
  }

  // ------------------------------------------------------------- spawning

  private waveFor(t: number) {
    const minute = Math.min(29, Math.floor(t / 60));
    return WAVES[minute];
  }

  private updateSpawning(dt: number, t: number) {
    if (this.finalPhase || t >= GAME_DURATION) return; // dawn never admits an earlier backlog

    const wave = this.waveFor(t);
    const bossAlive = this.boss !== null;
    this.encounterCooldown = Math.max(0, this.encounterCooldown - dt);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      // during boss fights the horde thins dramatically so the boss takes
      // the spotlight (and your auto-aim) — VS-style
      this.spawnTimer = wave.interval * (bossAlive ? 2.6 : 1);
      const alive = this.countEnemies();
      const cap = bossAlive ? Math.floor(wave.maxAlive * 0.35) : wave.maxAlive;
      if (alive < cap) {
        const n = Math.min(wave.perTick, cap - alive);
        for (let i = 0; i < n; i++) {
          const id = wave.enemies[Math.floor(this.random() * wave.enemies.length)];
          this.spawnEnemy(ENEMIES[id], false);
        }
      }
    }

    // One authored event can enter at a time. Due events remain pending in the
    // schedule until admitted; a long boss/Covenant never loses an elite chest.
    if (bossAlive || this.covenant?.status === "active") {
      this.encounterCooldown = ENCOUNTER_SPACING;
      return;
    }
    // Bosses keep priority at their authored minute, even during routine recovery.
    const dueBoss = BOSSES.find((b) => b.minute < 30 && t >= b.minute * 60 && !this.bossesSpawned.has(b.id));
    if (dueBoss) { this.spawnBoss(dueBoss); return; }
    if (this.encounterCooldown > 0) return;
    const event = AUTHORED_ENCOUNTERS.find((event) => t >= event.at && !(event.kind === "elite" ? this.eliteSpawned : this.swarmSpawned).has(event.minute));
    if (!event) return;

    if (event.kind === "swarm") {
      // Reserve the whole ring before marking delivery; pool pressure only defers it.
      if (this.enemies.length - this.countEnemies() < 40) return;
      const id = event.minute < 10 ? "bat" : event.minute < 20 ? "spider" : "hound";
      const count = 40;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU;
        const e = this.spawnEnemy(ENEMIES[id], false);
        if (e) {
          const ring = Math.hypot(this.viewport.width / 2, this.viewport.height / 2) + 90;
          e.x = this.camX + Math.cos(a) * ring;
          e.y = this.camY + Math.sin(a) * ring;
          e.hp *= 0.6;
          e.maxHp *= 0.6;
        }
      }
      this.swarmSpawned.add(event.minute);
    } else {
      const pool = this.waveFor(event.at).enemies;
      const def = ENEMIES[pool[pool.length - 1]];
      if (!this.spawnEnemy(def, true)) return;
      this.eliteSpawned.add(event.minute);
    }
    this.encounterCooldown = ENCOUNTER_SPACING;
  }

  private countEnemies() {
    let n = 0;
    for (const e of this.enemies) if (e.active) n++;
    return n;
  }

  spawnEnemy(def: EnemyDef, elite: boolean): Enemy | null {
    let slot: Enemy | null = null;
    for (const e of this.enemies) {
      if (!e.active) {
        slot = e;
        break;
      }
    }
    if (!slot) return null;
    const point = this.outsideView(80 + def.radius * (elite ? 1.9 : 1));
    const scalingTime = Math.min(this.time, GAME_DURATION);
    const hpMul = enemyHpScale(scalingTime) * (elite ? 14 : 1);
    slot.id = ++this.entitySerial;
    slot.hitCooldowns = {};
    slot.windup = 0; slot.chargeX = slot.chargeY = 0;
    slot.active = true;
    slot.def = def;
    slot.x = point.x;
    slot.y = point.y;
    slot.maxHp = def.hp * hpMul;
    slot.hp = slot.maxHp;
    slot.speed = def.speed * (elite ? 0.85 : this.rand(0.92, 1.08));
    slot.damage = def.damage * enemyDmgScale(scalingTime) * (elite ? 1.6 : 1);
    slot.radius = def.radius * (elite ? 1.9 : 1);
    slot.xp = def.xp * enemyXpScale(scalingTime) * (elite ? 10 : 1);
    slot.elite = elite;
    slot.hitFlash = 0;
    slot.slowT = 0;
    slot.slowF = 1;
    slot.kx = 0;
    slot.ky = 0;
    slot.orbCd = 0;
    slot.charge = this.rand(0, 2);
    slot.charging = false;
    if (elite) {
      this.addFx({ kind: "summon", x: slot.x, y: slot.y, x2: 0, y2: 0, t: 0, dur: 0.8, radius: slot.radius * 2.4, color: "#ffd166", angle: 0, arc: 0 });
    }
    return slot;
  }

  spawnBoss(def: BossDef) {
    this.encounterCooldown = ENCOUNTER_SPACING;
    this.bossesSpawned.add(def.id);
    const point = this.outsideView(def.radius + 50);
    this.boss = {
      id: ++this.entitySerial, hitCooldowns: {},
      def,
      x: point.x,
      y: point.y,
      hp: def.hp,
      maxHp: def.hp,
      hitFlash: 0,
      t1: 3,
      t2: 6,
      t3: 9,
      enraged: false,
      faceX: 1,
      windup: 0,
      dashT: 0,
      dashX: 0,
      dashY: 0,
      spiralA: 0,
      spiralN: 0,
      spiralT: 0,
    };
    this.addFx({ kind: "summon", x: this.boss.x, y: this.boss.y, x2: 0, y2: 0, t: 0, dur: 1.2, radius: def.radius * 3, color: def.glow, angle: 0, arc: 0 });
    this.shake = Math.max(this.shake, 1.2);
    audio.sfx("bossSpawn");
    this.cb.onBossWarning(def.name, def.title);
  }

  private enterFinalPhase() {
    this.finalPhase = true;
    // Death's arrival sweeps the field — all lesser creatures perish
    for (const e of this.enemies) {
      if (e.active) {
        this.killEnemy(e, false);
      }
    }
    this.enemyBullets.forEach((b) => (b.active = false));
    // Dawn claims a lingering earlier boss; resolve its earned encounter rewards exactly once.
    if (this.boss) this.killBoss();
    this.scheduled = [];
    const final = BOSSES[2];
    this.spawnBoss(final);
  }

  // ------------------------------------------------------------- spatial hash

  private gridKey(cx: number, cy: number) {
    // Normal gameplay stays in this exact-integer range. Avoid allocating a string for
    // every collision query while retaining collision-free keys for distant worlds.
    if (Math.abs(cx) < 1_000_000 && Math.abs(cy) < 1_000_000) return (cx + 1_000_000) * 2_000_000 + cy + 1_000_000;
    return `${cx},${cy}`;
  }

  private buildGrid() {
    this.grid.clear();
    this.gridDisplacement = 0;
    const cs = 72;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.active) continue;
      const k = this.gridKey(Math.floor(e.x / cs), Math.floor(e.y / cs));
      let arr = this.grid.get(k);
      if (!arr) {
        arr = [];
        this.grid.set(k, arr);
      }
      arr.push(i);
    }
  }

  /** Visit enemies near (x, y) within radius r. Return true from fn to stop. */
  private nearEnemies(x: number, y: number, r: number, fn: (e: Enemy) => boolean | void) {
    const cs = 72;
    const padding = 50 + this.gridDisplacement; // target extent plus movement since the last index build
    const x0 = Math.floor((x - r - padding) / cs);
    const x1 = Math.floor((x + r + padding) / cs);
    const y0 = Math.floor((y - r - padding) / cs);
    const y1 = Math.floor((y + r + padding) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.grid.get(this.gridKey(cx, cy));
        if (!arr) continue;
        for (const i of arr) {
          const e = this.enemies[i];
          if (!e.active) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= (r + e.radius) * (r + e.radius)) {
            if (fn(e) === true) return;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------- enemies

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (this.terminal) return;
      if (!e.active) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.orbCd = Math.max(0, e.orbCd - dt);
      for (const key of Object.keys(e.hitCooldowns)) e.hitCooldowns[key] = Math.max(0, e.hitCooldowns[key] - dt);
      e.wobble += dt * 6;

      let speedF = 1;
      if (e.windup > 0 && e.def.shape !== "hound") { e.windup = Math.max(0, e.windup - dt); speedF = 0; }
      if (e.slowT > 0) {
        e.slowT -= dt;
        speedF *= e.slowF;
      }

      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.faceX = Math.sign(dx) || 1;

      // teleport far-behind enemies back to the front (VS-style)
      if (dist > Math.hypot(this.viewport.width, this.viewport.height) + 700) {
        const point = this.outsideView(100 + e.radius);
        e.x = point.x;
        e.y = point.y;
        continue;
      }

      let vx = (dx / dist) * e.speed * speedF;
      let vy = (dy / dist) * e.speed * speedF;

      // Chargers announce and commit to a direction; freezing stops all voluntary movement.
      if (e.def.shape === "hound" && speedF > 0) {
        e.charge -= dt;
        if (e.windup > 0) {
          e.windup -= dt; vx = vy = 0;
          if (e.windup <= 0) { e.charging = true; e.charge = .65; }
        } else if (e.charging) {
          vx = e.chargeX * e.speed * 2.6 * speedF;
          vy = e.chargeY * e.speed * 2.6 * speedF;
          if (e.charge <= 0) { e.charging = false; e.charge = this.rand(2.5, 4); }
        } else if (e.charge <= 0 && dist < 320 && dist > 110) {
          e.windup = .45; e.chargeX = dx / dist; e.chargeY = dy / dist;
          this.addFx({ kind: "telegraph", shape: "line", x: e.x, y: e.y, x2: e.x + e.chargeX * 190, y2: e.y + e.chargeY * 190, t: 0, dur: .45, radius: e.radius, color: "#ff9f5b", angle: Math.atan2(dy, dx), arc: 0 });
        }
      }
      // wraith drift
      if (e.def.shape === "wraith" || e.def.shape === "shadow") {
        const s = Math.sin(e.wobble * 0.9) * 40 * speedF;
        vx += (-dy / dist) * s;
        vy += (dx / dist) * s;
      }

      // separation from neighbors (keeps the horde spread out, VS-style)
      let sepX = 0;
      let sepY = 0;
      let sepN = 0;
      this.nearEnemies(e.x, e.y, e.radius * 1.1, (o) => {
        if (o === e || sepN >= 6) return sepN >= 6;
        const ox = e.x - o.x;
        const oy = e.y - o.y;
        const d = Math.hypot(ox, oy) || 1;
        if (d < (e.radius + o.radius) * 0.9) {
          const push = 55 * (1 - d / ((e.radius + o.radius) * 0.9));
          sepX += (ox / d) * (30 + push);
          sepY += (oy / d) * (30 + push);
          sepN++;
        }
      });

      e.x += (vx + sepX + e.kx) * dt;
      e.y += (vy + sepY + e.ky) * dt;
      e.kx *= Math.pow(0.0009, dt);
      e.ky *= Math.pow(0.0009, dt);

      // contact damage
      if (!(e.windup > 0 && e.def.shape !== "hound") && Math.hypot(this.px - e.x, this.py - e.y) < e.radius + 14 && this.iframes <= 0) {
        this.damagePlayer(e.damage, e.def.name);
      }
    }
  }

  damagePlayer(raw: number, cause = "The horde") {
    if (this.terminal || this.suspended || this.qaInvulnerable || this.iframes > 0 || this.phase !== "playing") return;
    const guarded = this.charId === "knight" && this.traitCharge >= 4;
    const dmg = Math.max(1, raw * (guarded ? .6 : 1) - this.stats.armor);
    this.traitCharge = 0;
    this.damageCause = cause;
    this.metrics.damageTaken += Math.min(this.hp, dmg);
    if (guarded) {
      this.nearEnemies(this.px, this.py, 100, (e) => { const a = Math.atan2(e.y - this.py, e.x - this.px); e.kx += Math.cos(a) * 220; e.ky += Math.sin(a) * 220; });
      this.addFx({ kind: "ring", x: this.px, y: this.py, x2: 0, y2: 0, t: 0, dur: .35, radius: 100, color: "#ffe9a8", angle: 0, arc: 0 });
    }
    this.hp -= dmg;
    this.iframes = 0.65;
    this.hurtFlash = 0.35;
    this.shake = Math.max(this.shake, 0.45);
    audio.sfx("hurt");
    this.spawnDmgNum(this.px, this.py - 24, dmg, false, false);
    if (this.hp <= 0) {
      if (this.stats.revives > 0) {
        this.stats.revives--;
        this.hp = this.stats.maxHp * 0.5;
        this.iframes = 2.5;
        this.reviveFx = 1.2;
        audio.sfx("heal");
        // revival shockwave clears nearby foes
        this.source = "revival";
        this.nearEnemies(this.px, this.py, 240, (e) => {
          this.hitEnemy(e, 200, false, 0, 0);
        });
        this.addFx({ kind: "nova", x: this.px, y: this.py, x2: 0, y2: 0, t: 0, dur: 0.6, radius: 260, color: "#ffe9a8", angle: 0, arc: 0 });
      } else {
        this.hp = 0;
        this.endRun(false);
      }
    }
  }

  /** Apply effective damage and return whether this hit crits. */
  hitEnemy(e: Enemy, dmg: number, canCrit: boolean, kbX: number, kbY: number, opts?: { slow?: number; slowF?: number; quiet?: boolean }) {
    if (this.terminal || !e.active) return false;
    let final = dmg * this.stats.might;
    if (this.covenant?.reward === "frost" && e.slowT > 0 && e.slowF === 0) final *= 1.2;
    if (this.covenant?.reward === "precision" && e.hp === e.maxHp) final *= 1.2;
    let crit = false;
    if (canCrit && this.random() < this.stats.critChance) {
      crit = true;
      final *= this.stats.critDamage;
    }
    final = Math.max(1, Math.round(final));
    const effective = Math.min(Math.max(0, e.hp), final);
    e.hp -= final;
    this.recordDamage(effective, final - effective);
    e.hitFlash = 0.12;
    const kr = 1 - (e.def.knockResist ?? 0);
    e.kx += kbX * kr;
    e.ky += kbY * kr;
    if (opts?.slow) this.applySlow(e, opts.slow, opts.slowF ?? .55);
    if (!opts?.quiet) audio.sfx("hit");
    this.spawnDmgNum(e.x + this.visualRand(-8, 8), e.y - e.radius - 4, final, crit, false);
    if (e.hp <= 0) this.killEnemy(e, true);
    return crit;
  }

  /** Stronger control replaces weaker control; weaker casts never thaw or prolong a freeze. */
  private applySlow(e: Enemy, duration: number, factor: number) {
    if (e.slowT <= 0 || factor < e.slowF) { e.slowF = factor; e.slowT = duration; }
    else if (factor === e.slowF) e.slowT = Math.max(e.slowT, duration);
  }

  private killEnemy(e: Enemy, drops: boolean) {
    if (!e.active || this.terminal) return;
    e.active = false;
    if (this.charId === "reaper" && this.source === "daggers" && this.traitCooldown <= 0) { this.heal(2); this.traitCooldown = 2; }
    if (this.covenant?.status === "active" && Math.hypot(e.x - this.covenant.x, e.y - this.covenant.y) < 300) this.covenant.progress++;
    this.kills++;
    this.burst(e.x, e.y, e.elite ? 18 : 7, e.def.color, e.elite ? 160 : 90);
    if (!drops) return;

    // gem
    const xpVal = e.xp * this.stats.xpGain;
    this.dropPickup("gem", e.x + this.rand(-6, 6), e.y + this.rand(-6, 6), xpVal);
    // gold / extras
    const luck = this.stats.luck;
    if (e.elite) {
      this.dropPickup("chest", e.x, e.y, 0);
      for (let i = 0; i < 6; i++) this.dropPickup("coin", e.x + this.rand(-30, 30), e.y + this.rand(-30, 30), 5);
    } else {
      const r = this.random();
      if (r < 0.035 * luck) this.dropPickup("coin", e.x, e.y, 5);
      else if (r < 0.035 * luck + 0.012 * luck) this.dropPickup("meat", e.x, e.y, 0);
      else if (r < 0.035 * luck + 0.012 * luck + 0.0022) {
        this.dropPickup(this.random() < 0.5 ? "magnet" : "bomb", e.x, e.y, 0);
      }
    }
  }

  // ------------------------------------------------------------- boss logic

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b || this.terminal) return;
    for (const key of Object.keys(b.hitCooldowns)) b.hitCooldowns[key] = Math.max(0, b.hitCooldowns[key] - dt);
    b.hitFlash = Math.max(0, b.hitFlash - dt);
    const dx = this.px - b.x;
    const dy = this.py - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    b.faceX = Math.sign(dx) || 1;
    const enrageMul = b.enraged ? 0.7 : 1;

    if (!b.enraged && b.hp < b.maxHp * 0.5 && b.def.id === "death") {
      b.enraged = true;
      this.addFx({ kind: "nova", x: b.x, y: b.y, x2: 0, y2: 0, t: 0, dur: 0.8, radius: 300, color: "#ff2222", angle: 0, arc: 0 });
      this.shake = Math.max(this.shake, 1);
      audio.sfx("bossSpawn");
    }

    // movement
    const speed = b.def.speed * (b.enraged ? 1.35 : 1);
    if (b.dashT > 0) {
      b.dashT -= dt;
      b.x += b.dashX * dt;
      b.y += b.dashY * dt;
    } else if (b.windup > 0) {
      b.windup -= dt;
      if (b.windup <= 0) {
        b.dashT = 1.0;
        // Direction was committed when the warning began.
        audio.sfx("slash");
      }
    } else {
      b.x += (dx / dist) * speed * dt;
      b.y += (dy / dist) * speed * dt;
    }

    // contact damage
    if (Math.hypot(this.px - b.x, this.py - b.y) < b.def.radius + 14 && this.iframes <= 0) {
      this.damagePlayer(b.def.damage, b.def.name);
    }

    if (this.terminal) return;
    // ---- attacks per boss
    b.t1 -= dt;
    b.t2 -= dt;
    b.t3 -= dt;

    if (b.def.id === "colossus") {
      if (b.t1 <= 0) {
        b.t1 = 7 * enrageMul;
        // slam telegraph at player position (generous 1.2s warning)
        const tx = this.px;
        const ty = this.py;
        this.addFx({ kind: "telegraph", x: tx, y: ty, x2: 0, y2: 0, t: 0, dur: 1.2, radius: 120, color: "#ff9f5b", angle: 0, arc: 0 });
        this.schedule(1.2, "slam", [tx, ty, 120, b.def.damage * 1.2], false, b.id);
      }
      if (b.t2 <= 0) {
        b.t2 = 13;
        for (let i = 0; i < 4; i++) {
          const e = this.spawnEnemy(ENEMIES.skeleton, false);
          if (e) {
            const a = (i / 4) * TAU;
            e.x = b.x + Math.cos(a) * 70;
            e.y = b.y + Math.sin(a) * 70;
            e.windup = .7;
          }
        }
        this.addFx({ kind: "summon", x: b.x, y: b.y, x2: 0, y2: 0, t: 0, dur: 0.7, radius: 100, color: b.def.glow, angle: 0, arc: 0 });
      }
    } else if (b.def.id === "lich") {
      if (b.t1 <= 0) {
        b.t1 = 5 * enrageMul;
        // radial volley
        const n = 14;
        const off = this.random() * TAU;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * TAU;
          this.spawnEnemyBullet(b.x, b.y, Math.cos(a) * 170, Math.sin(a) * 170, b.def.damage * 0.55, "#5dffd8");
        }
        audio.sfx("zap");
      }
      if (b.t2 <= 0) {
        b.t2 = 8 * enrageMul;
        // aimed spread
        const base = Math.atan2(dy, dx);
        for (let i = -2; i <= 2; i++) {
          const a = base + i * 0.16;
          this.spawnEnemyBullet(b.x, b.y, Math.cos(a) * 240, Math.sin(a) * 240, b.def.damage * 0.6, "#9fe8d8");
        }
      }
      if (b.t3 <= 0) {
        b.t3 = 12;
        // Show the destination before teleporting; owner-bound action vanishes if the Lich dies.
        const a = this.random() * TAU;
        const x = this.px + Math.cos(a) * this.rand(240, 330);
        const y = this.py + Math.sin(a) * this.rand(240, 330);
        this.addFx({ kind: "telegraph", shape: "circle", x, y, x2: 0, y2: 0, t: 0, dur: .8, radius: b.def.radius + 35, color: b.def.glow, angle: 0, arc: 0 });
        this.schedule(.8, "teleport", [x, y, 0, 0], false, b.id);
      }
    } else if (b.def.id === "death") {
      // spiral scythe barrage
      if (b.spiralN > 0) {
        b.spiralT -= dt;
        if (b.spiralT <= 0) {
          b.spiralT = 0.11;
          b.spiralN--;
          for (let k = 0; k < 2; k++) {
            const a = b.spiralA + k * Math.PI;
            this.spawnEnemyBullet(b.x, b.y, Math.cos(a) * 200, Math.sin(a) * 200, b.def.damage * 0.5, "#ff5a5a");
          }
          b.spiralA += 0.45;
        }
      }
      if (b.t1 <= 0) {
        b.t1 = 7 * enrageMul;
        b.spiralN = 14;
        b.spiralA = this.random() * TAU;
        b.spiralT = 0;
        audio.sfx("zap");
      }
      if (b.t2 <= 0 && b.dashT <= 0 && b.windup <= 0) {
        b.t2 = 10 * enrageMul;
        b.windup = 0.7;
        b.dashX = dx / dist * speed * 3.2; b.dashY = dy / dist * speed * 3.2;
        this.addFx({ kind: "telegraph", shape: "line", x: b.x, y: b.y, x2: b.x + b.dashX, y2: b.y + b.dashY, t: 0, dur: 0.7, radius: 40, color: "#ff2222", angle: Math.atan2(dy, dx), arc: 0 });
      }
      if (b.t3 <= 0) {
        b.t3 = 13 * enrageMul;
        for (let i = 0; i < (b.enraged ? 7 : 5); i++) {
          const e = this.spawnEnemy(ENEMIES.shadow, false);
          if (e) {
            const a = this.random() * TAU;
            e.x = b.x + Math.cos(a) * this.rand(60, 140);
            e.y = b.y + Math.sin(a) * this.rand(60, 140);
            e.windup = .8;
            e.hp *= 0.5;
            e.maxHp *= 0.5;
          }
        }
        this.addFx({ kind: "summon", x: b.x, y: b.y, x2: 0, y2: 0, t: 0, dur: 0.8, radius: 130, color: "#8c1010", angle: 0, arc: 0 });
      }
    }

    if (b.hp <= 0) this.killBoss();
  }

  private bossSlam(x: number, y: number, r: number, dmg: number) {
    if (this.terminal || this.phase !== "playing") return;
    this.addFx({ kind: "ring", x, y, x2: 0, y2: 0, t: 0, dur: 0.5, radius: r * 1.4, color: "#ffb84d", angle: 0, arc: 0 });
    this.burst(x, y, 20, "#d8c9a0", 170);
    this.shake = Math.max(this.shake, 0.9);
    audio.sfx("explosion");
    const ddx = this.px - x;
    const ddy = this.py - y;
    if (Math.hypot(ddx, ddy) < r + 12) this.damagePlayer(dmg, "Colossus slam");
  }

  hitBoss(dmg: number, canCrit: boolean) {
    const b = this.boss;
    if (!b || this.terminal) return false;
    let final = dmg * this.stats.might;
    if (this.covenant?.reward === "precision" && b.hp === b.maxHp) final *= 1.2;
    let crit = false;
    if (canCrit && this.random() < this.stats.critChance) {
      crit = true;
      final *= this.stats.critDamage;
    }
    final = Math.max(1, Math.round(final));
    const effective = Math.min(Math.max(0, b.hp), final);
    b.hp -= final;
    this.recordDamage(effective, final - effective);
    b.hitFlash = 0.1;
    this.spawnDmgNum(b.x + this.visualRand(-14, 14), b.y - b.def.radius - 8, final, crit, false);
    if (b.hp <= 0) this.killBoss();
    return crit;
  }

  private killBoss() {
    const b = this.boss;
    if (!b) return;
    this.boss = null;
    this.encounterCooldown = ENCOUNTER_SPACING;
    this.metrics.bossesDefeated.push(b.def.id);
    this.kills++;
    audio.sfx("bossDie");
    this.shake = Math.max(this.shake, 1.4);
    this.burst(b.x, b.y, 50, b.def.color, 240);
    this.burst(b.x, b.y, 30, "#ffd166", 200);
    this.addFx({ kind: "nova", x: b.x, y: b.y, x2: 0, y2: 0, t: 0, dur: 1.0, radius: 380, color: b.def.glow, angle: 0, arc: 0 });

    if (b.def.id === "death") {
      // VICTORY!
      this.addGold(250, "victory");
      this.endRun(true);
      return;
    }
    // rewards: chest + gem shower + magnet
    this.dropPickup("chest", b.x, b.y, 0);
    for (let i = 0; i < 14; i++) {
      this.dropPickup("gem", b.x + this.rand(-90, 90), b.y + this.rand(-90, 90), 12 * enemyXpScale(this.time) * this.stats.xpGain);
    }
    for (let i = 0; i < 10; i++) this.dropPickup("coin", b.x + this.rand(-70, 70), b.y + this.rand(-70, 70), 8);
    this.dropPickup("magnet", b.x + this.rand(-40, 40), b.y + this.rand(-40, 40), 0);
  }

  // ------------------------------------------------------------- weapons

  private updateWeapons(dt: number) {
    this.orbAngle += dt * 2.4;
    for (const w of this.weapons) {
      if (this.terminal) return;
      this.source = w.id;
      const def = WEAPONS[w.id];
      const L = this.levelStats(w);
      if (w.id === "daggers") {
        this.updateDaggers(w, L, dt);
        continue;
      }
      w.timer -= dt;
      if (w.timer <= 0) {
        const cd = L.cooldown * this.stats.cooldown * (w.evolved ? 0.8 : 1);
        w.timer = Math.max(0.12, cd);
        this.fireWeapon(w, def, L);
      }
    }
  }

  /** Resolve cumulative level stats for a weapon. */
  levelStats(w: WeaponState) {
    return resolveWeaponStats(w.id, w.level);
  }

  private nearestEnemyAngle(maxDist = 900): number | null {
    let best: number | null = null;
    let bestD = maxDist * maxDist;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const dx = e.x - this.px;
      const dy = e.y - this.py;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = Math.atan2(dy, dx);
      }
    }
    if (this.boss) {
      // bosses draw your aim — weighted as if 55% closer than they are
      const dx = this.boss.x - this.px;
      const dy = this.boss.y - this.py;
      const d = (dx * dx + dy * dy) * 0.2;
      if (d < bestD) best = Math.atan2(dy, dx);
    }
    return best;
  }

  private randomTarget(): { x: number; y: number } | null {
    const candidates: { x: number; y: number }[] = [];
    let n = 0;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const dx = e.x - this.px;
      const dy = e.y - this.py;
      if (dx * dx + dy * dy < 520 * 520) {
        n++;
        if (candidates.length < 24) candidates.push({ x: e.x, y: e.y });
        else if (this.random() < 24 / n) candidates[Math.floor(this.random() * 24)] = { x: e.x, y: e.y };
      }
    }
    if (this.boss) {
      // bosses soak a third of random-target attacks (lightning / fireballs)
      if (this.random() < 0.33) return { x: this.boss.x, y: this.boss.y };
      candidates.push({ x: this.boss.x, y: this.boss.y });
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(this.random() * candidates.length)];
  }

  private fireWeapon(w: WeaponState, def: (typeof WEAPONS)[string], L: ReturnType<Game["levelStats"]>) {
    const area = this.stats.area * L.area;
    const evolved = w.evolved;

    switch (w.id) {
      case "swordwave": {
        const baseA = this.lastAim;
        const dmg = L.damage * (evolved ? 1.7 : 1);
        const reach = 95 * area * (evolved ? 1.45 : 1);
        const dirs = evolved ? 3 : L.amount;
        for (let i = 0; i < dirs; i++) {
          let a = baseA;
          if (i === 1) a = baseA + Math.PI;
          if (i === 2) a = baseA + (w.alt % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
          const delay = i * 0.09;
          this.schedule(delay, "slash", [a, reach, dmg], evolved);
        }
        w.alt++;
        audio.sfx("slash");
        break;
      }
      case "bow": {
        const target = this.nearestEnemyAngle();
        if (target === null) break;
        const n = evolved ? L.amount + 3 : L.amount;
        const prepared = this.charId === "ranger" && this.traitCharge >= 3;
        const dmg = L.damage * (evolved ? 1.4 : 1) * (prepared ? 1.25 : 1);
        if (prepared) this.traitCharge = 0;
        const spd = L.speed * this.stats.projSpeed * (evolved ? 1.25 : 1);
        for (let i = 0; i < n; i++) {
          const a = target + (i - (n - 1) / 2) * 0.11;
          this.spawnBullet("arrow", this.px, this.py, Math.cos(a) * spd, Math.sin(a) * spd, dmg, 5, L.pierce + (evolved ? 2 : 0), 1.4, evolved, 0);
        }
        audio.sfx("shoot");
        break;
      }
      case "orb": {
        if (this.charId === "mage" && ++this.traitCasts % 4 === 0) this.nearEnemies(this.px, this.py, 170 * this.stats.area, (e) => { this.applySlow(e, 1, .5); });
        const n = L.amount;
        const base = this.nearestEnemyAngle() ?? this.random() * TAU;
        for (let i = 0; i < n; i++) {
          const a = base + (i * TAU) / n + this.rand(-0.2, 0.2);
          const spd = L.speed * this.stats.projSpeed * (evolved ? 0.75 : 1);
          const r = 16 * area * (evolved ? 2.1 : 1);
          this.spawnBullet(evolved ? "orb" : "orb", this.px, this.py, Math.cos(a) * spd, Math.sin(a) * spd, L.damage * (evolved ? 1.5 : 1), r, 9999, L.duration * (evolved ? 1.4 : 1), evolved, evolved ? 150 : 0);
        }
        audio.sfx("shoot");
        break;
      }
      case "lightning": {
        const strikes = evolved ? L.amount + 2 : L.amount;
        const dmg = L.damage * (evolved ? 1.5 : 1);
        const r = 46 * area;
        for (let i = 0; i < strikes; i++) {
          const t = this.randomTarget();
          if (!t) break;
          this.schedule(i * .09, "lightning", [t.x, t.y, r, dmg], evolved);
        }
        break;
      }
      case "frost": {
        if (evolved) {
          // Absolute Zero — freezing nova
          const r = 190 * area;
          this.addFx({ kind: "nova", x: this.px, y: this.py, x2: 0, y2: 0, t: 0, dur: 0.55, radius: r, color: "#a8ecff", angle: 0, arc: 0 });
          this.nearEnemies(this.px, this.py, r, (e) => {
            this.hitEnemy(e, L.damage * 2.2, true, 0, 0, { slow: FROST_NOVA_FREEZE, slowF: 0, quiet: true });
          });
          if (this.boss) {
            const d = Math.hypot(this.boss.x - this.px, this.boss.y - this.py);
            if (d < r + this.boss.def.radius) this.hitBoss(L.damage * 2.2, true);
          }
          audio.sfx("frost");
        } else {
          const target = this.nearestEnemyAngle();
          if (target === null) break;
          const n = L.amount;
          const spd = L.speed * this.stats.projSpeed;
          for (let i = 0; i < n; i++) {
            const a = target + (i - (n - 1) / 2) * 0.13;
            const shard = this.spawnBullet("shard", this.px, this.py, Math.cos(a) * spd, Math.sin(a) * spd, L.damage, 5, 0, 1.1, false, 0);
            if (shard) shard.slowDuration = L.duration;
          }
          audio.sfx("frost");
        }
        break;
      }
      case "fire": {
        if (evolved) {
          // Meteor Storm
          const n = L.amount + 2;
          for (let i = 0; i < n; i++) {
            const t = this.randomTarget();
            const tx = t ? t.x + this.rand(-40, 40) : this.px + this.rand(-260, 260);
            const ty = t ? t.y + this.rand(-40, 40) : this.py + this.rand(-260, 260);
            const delay = i * 0.16;
            this.schedule(delay, "meteor", [tx, ty, L.damage * 1.9, 95 * area], true);
          }
          audio.sfx("fire");
        } else {
          const n = L.amount;
          for (let i = 0; i < n; i++) {
            const t = this.randomTarget();
            const a = t ? Math.atan2(t.y - this.py, t.x - this.px) : this.random() * TAU;
            const spd = L.speed * this.stats.projSpeed;
            this.spawnBullet("fireball", this.px, this.py, Math.cos(a) * spd, Math.sin(a) * spd, L.damage, 8, 0, 2.2, false, 62 * area);
          }
          audio.sfx("fire");
        }
        break;
      }
      case "aura": {
        const r = 92 * area * (evolved ? 1.6 : 1);
        const dmg = L.damage * (evolved ? 1.4 : 1);
        this.nearEnemies(this.px, this.py, r, (e) => {
          const kb = evolved ? 90 : 18;
          const dx = e.x - this.px;
          const dy = e.y - this.py;
          const d = Math.hypot(dx, dy) || 1;
          this.hitEnemy(e, dmg, false, (dx / d) * kb, (dy / d) * kb, { quiet: true });
        });
        if (this.boss) {
          const d = Math.hypot(this.boss.x - this.px, this.boss.y - this.py);
          if (d < r + this.boss.def.radius) this.hitBoss(dmg, false);
        }
        break;
      }
    }
  }

  /** crescent melee slash */
  private slash(angle: number, reach: number, dmg: number, evolved: boolean) {
    this.source = "swordwave";
    this.addFx({ kind: "slash", x: this.px, y: this.py, x2: 0, y2: 0, t: 0, dur: 0.22, radius: reach, color: evolved ? "#ff6b6b" : "#e8e3d4", angle, arc: 1.5 });
    let killsHealed = 0;
    this.nearEnemies(this.px, this.py, reach, (e) => {
      const a = Math.atan2(e.y - this.py, e.x - this.px);
      const diff = Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
      if (diff < 0.85) {
        const hpBefore = e.hp;
        this.hitEnemy(e, dmg, true, Math.cos(a) * 140, Math.sin(a) * 140, { quiet: true });
        if (evolved && hpBefore > 0 && e.hp <= 0 && killsHealed < 3) {
          killsHealed++;
          this.heal(1);
        }
      }
    });
    if (this.boss) {
      const dx = this.boss.x - this.px;
      const dy = this.boss.y - this.py;
      const d = Math.hypot(dx, dy);
      if (d < reach + this.boss.def.radius) {
        const a = Math.atan2(dy, dx);
        const diff = Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
        if (diff < 0.95) this.hitBoss(dmg, true);
      }
    }
  }

  private lightningStrike(x: number, y: number, r: number, dmg: number, chain: boolean) {
    this.source = "lightning";
    this.addFx({ kind: "bolt", x, y: y, x2: x + this.visualRand(-30, 30), y2: y - 400, t: 0, dur: 0.18, radius: r, color: "#7dd9ff", angle: 0, arc: 0 });
    this.burst(x, y, 6, "#7dd9ff", 110);
    audio.sfx("zap");
    const hit: Enemy[] = [];
    this.nearEnemies(x, y, r, (e) => {
      this.hitEnemy(e, dmg, true, 0, 0, { quiet: true });
      hit.push(e);
    });
    if (this.boss) {
      const d = Math.hypot(this.boss.x - x, this.boss.y - y);
      if (d < r + this.boss.def.radius) this.hitBoss(dmg, true);
    }
    if (chain && hit.length) {
      // chain to up to 3 nearby untouched enemies
      const src = hit[0];
      let chained = 0;
      this.nearEnemies(src.x, src.y, 150, (e) => {
        if (chained >= 3 || hit.includes(e) || !e.active) return;
        chained++;
        this.addFx({ kind: "bolt", x: e.x, y: e.y, x2: src.x, y2: src.y, t: 0, dur: 0.15, radius: 0, color: "#aef1ff", angle: 0, arc: 0 });
        this.hitEnemy(e, dmg * 0.6, true, 0, 0, { quiet: true });
      });
    }
  }

  private updateDaggers(w: WeaponState, L: ReturnType<Game["levelStats"]>, dt: number) {
    const evolved = w.evolved;
    const n = evolved ? 8 : L.amount;
    const orbitR = (62 + 10 * L.area) * this.stats.area * (evolved ? 1.5 : 1);
    const spin = L.speed * (evolved ? 1.5 : 1);
    const dmg = L.damage * (evolved ? 1.5 : 1);
    this.orbAngle += dt * (spin - 2.4); // extra spin beyond base
    for (let i = 0; i < n; i++) {
      const a = this.orbAngle + (i * TAU) / n;
      const bx = this.px + Math.cos(a) * orbitR;
      const by = this.py + Math.sin(a) * orbitR;
      this.nearEnemies(bx, by, 16, (e) => {
        if (e.hitCooldowns.daggers > 0) return;
        e.hitCooldowns.daggers = 0.45;
        const dx = e.x - this.px;
        const dy = e.y - this.py;
        const d = Math.hypot(dx, dy) || 1;
        this.hitEnemy(e, dmg, true, (dx / d) * 120, (dy / d) * 120);
      });
      if (this.boss) {
        const d = Math.hypot(this.boss.x - bx, this.boss.y - by);
        if (d < 16 + this.boss.def.radius && !(this.boss.hitCooldowns.daggers > 0)) {
          this.boss.hitCooldowns.daggers = .45;
          this.hitBoss(dmg, true);
        }
      }
    }
    // Blade Cyclone vacuums gems in orbit
    if (evolved) {
      for (const p of this.pickups) {
        if (p.active && p.kind === "gem") {
          const d = Math.hypot(p.x - this.px, p.y - this.py);
          if (d < orbitR + 20) p.attracted = true;
        }
      }
    }
  }

  // ------------------------------------------------------------- bullets

  spawnBullet(kind: Bullet["kind"], x: number, y: number, vx: number, vy: number, dmg: number, radius: number, pierce: number, life: number, evolved: boolean, aoe: number): Bullet | null {
    for (const b of this.bullets) {
      if (b.active) continue;
      b.active = true;
      b.hitIds.clear();
      b.source = (this.source in WEAPONS ? this.source : kind === "shard" ? "frost" : kind === "orb" ? "orb" : kind === "fireball" || kind === "meteor" ? "fire" : "bow") as WeaponId;
      b.slowDuration = 1.6;
      b.kind = kind;
      b.x = x;
      b.y = y;
      b.vx = vx;
      b.vy = vy;
      b.damage = dmg;
      b.radius = radius;
      b.pierce = pierce;
      b.life = life;
      b.maxLife = life;
      b.evolved = evolved;
      b.angle = Math.atan2(vy, vx);
      b.aoe = aoe;
      b.tx = 0;
      b.ty = 0;
      return b;
    }
    return null;
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (this.terminal) return;
      if (!b.active) continue;
      this.source = b.source;
      const oldX = b.x, oldY = b.y;
      b.life -= dt;
      if (b.life <= 0) {
        if (b.kind === "meteor") this.explode(b.tx, b.ty, b.aoe, b.damage);
        b.active = false;
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.kind === "orb") b.angle += dt * 4;

      // Void Sphere pull
      if (b.kind === "orb" && b.evolved && b.aoe > 0) {
        let pulled = false;
        this.nearEnemies(b.x, b.y, b.aoe, (e) => {
          const dx = b.x - e.x, dy = b.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          e.x += (dx / d) * 95 * dt;
          e.y += (dy / d) * 95 * dt;
          pulled = true;
        });
        if (pulled) this.gridDisplacement += 95 * dt;
      }
      if (b.kind === "meteor") continue; // damages on impact only
      const travel = Math.hypot(b.x - oldX, b.y - oldY);
      const query = (visit: (e: Enemy) => void) => this.nearEnemies((b.x + oldX) / 2, (b.y + oldY) / 2, b.radius + travel / 2, visit);
      if (b.kind === "orb") {
        // Persistent fields affect every intersecting target; they do not consume pierce.
        query((e) => {
          if (e.hitCooldowns.orb > 0 || !segmentHits(oldX, oldY, b.x, b.y, e.x, e.y, b.radius + e.radius)) return;
          e.hitCooldowns.orb = .3;
          this.hitEnemy(e, b.damage, true, b.vx * .06, b.vy * .06, { quiet: true });
        });
        const boss = this.boss;
        if (boss && !(boss.hitCooldowns.orb > 0) && segmentHits(oldX, oldY, b.x, b.y, boss.x, boss.y, b.radius + boss.def.radius)) {
          boss.hitCooldowns.orb = .3;
          this.hitBoss(b.damage, true);
        }
        continue;
      }

      // Resolve the first surface met along the sweep, independent of grid traversal,
      // projectile direction or whether the target is a boss. Stable IDs break ties.
      const contacts: { target: Enemy | null; id: number; t: number }[] = [];
      query((e) => {
        if (b.hitIds.has(e.id)) return;
        const t = segmentHitFraction(oldX, oldY, b.x, b.y, e.x, e.y, b.radius + e.radius);
        if (t !== null) contacts.push({ target: e, id: e.id, t });
      });
      const boss = this.boss;
      if (boss && !b.hitIds.has(boss.id)) {
        const t = segmentHitFraction(oldX, oldY, b.x, b.y, boss.x, boss.y, b.radius + boss.def.radius);
        if (t !== null) contacts.push({ target: null, id: boss.id, t });
      }
      contacts.sort((a, other) => a.t - other.t || a.id - other.id);
      for (const contact of contacts) {
        if (this.terminal || !b.active) break;
        const e = contact.target;
        if (e ? !e.active : this.boss?.id !== contact.id) continue;
        b.hitIds.add(contact.id);
        if (b.kind === "fireball") {
          this.explode(oldX + (b.x - oldX) * contact.t, oldY + (b.y - oldY) * contact.t, b.aoe, b.damage);
          b.active = false;
          break;
        }
        const tx = e ? e.x : this.boss!.x, ty = e ? e.y : this.boss!.y;
        const crit = e
          ? this.hitEnemy(e, b.damage, true, b.vx * (b.kind === "shard" ? .04 : .05), b.vy * (b.kind === "shard" ? .04 : .05), b.kind === "shard" ? { slow: b.slowDuration, slowF: .55, quiet: true } : { quiet: true })
          : this.hitBoss(b.damage, true);
        if (!this.terminal && b.kind === "arrow" && b.evolved && crit) {
          this.addFx({ kind: "ring", x: tx, y: ty, x2: 0, y2: 0, t: 0, dur: .25, radius: 52, color: "#ffd166", angle: 0, arc: 0 });
          this.nearEnemies(tx, ty, 52, (other) => { if (other !== e) this.hitEnemy(other, b.damage * .5, false, 0, 0, { quiet: true }); });
        }
        if (b.kind !== "shard" && b.pierce > 0) b.pierce--;
        else b.active = false;
      }
    }
  }

  explode(x: number, y: number, r: number, dmg: number) {
    this.addFx({ kind: "explosion", x, y, x2: 0, y2: 0, t: 0, dur: 0.4, radius: r, color: "#ff9f5b", angle: 0, arc: 0 });
    this.burst(x, y, 14, "#ffb84d", 150);
    this.shake = Math.max(this.shake, 0.25);
    audio.sfx("explosion");
    this.nearEnemies(x, y, r, (e) => {
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      this.hitEnemy(e, dmg, true, (dx / d) * 130, (dy / d) * 130, { quiet: true });
    });
    if (this.boss) {
      const d = Math.hypot(this.boss.x - x, this.boss.y - y);
      if (d < r + this.boss.def.radius) this.hitBoss(dmg, true);
    }
  }

  private spawnEnemyBullet(x: number, y: number, vx: number, vy: number, dmg: number, color: string) {
    for (const b of this.enemyBullets) {
      if (b.active) continue;
      b.active = true;
      b.x = x;
      b.y = y;
      b.vx = vx;
      b.vy = vy;
      b.damage = dmg;
      b.life = 6;
      b.color = color;
      b.spin = this.visualRandom() * TAU;
      return;
    }
  }

  private updateEnemyBullets(dt: number) {
    for (const b of this.enemyBullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.spin += dt * 8;
      if (b.life <= 0) {
        b.active = false;
        continue;
      }
      const oldX = b.x, oldY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (segmentHits(oldX, oldY, b.x, b.y, this.px, this.py, b.radius + 13)) {
        b.active = false;
        this.damagePlayer(b.damage, this.boss ? `${this.boss.def.name} projectile` : "Hostile projectile");
      }
    }
  }

  // ------------------------------------------------------------- pickups

  dropPickup(kind: Pickup["kind"], x: number, y: number, value: number) {
    if (this.terminal) return;
    let slot: Pickup | null = null;
    for (const p of this.pickups) {
      if (!p.active) {
        slot = p;
        break;
      }
    }
    if (!slot) {
      if (kind === "gem") {
        // merge into a random live gem (VS-style consolidation)
        const live = this.pickups.filter((p) => p.active && p.kind === "gem");
        if (live.length) {
          const g = live[Math.floor(this.random() * live.length)];
          g.value += value;
          g.tier = gemTier(g.value);
        }
      }
      if (kind !== "gem" || !this.pickups.some((p) => p.active && p.kind === "gem")) {
        // Critical rewards never disappear when visual pickup capacity is full.
        const existing = this.deferredPickups.find((p) => p.kind === kind && kind !== "chest");
        if (existing && (kind === "coin" || kind === "gem")) existing.value += value;
        else this.deferredPickups.push({ kind, x, y, value });
      }
      return;
    }
    slot.active = true;
    slot.kind = kind;
    slot.x = x;
    slot.y = y;
    slot.value = value;
    slot.tier = kind === "gem" ? gemTier(value) : 0;
    slot.vx = 0;
    slot.vy = 0;
    slot.attracted = false;
    slot.bob = this.visualRandom() * TAU;
  }

  private flushPickups() {
    while (this.deferredPickups.length && this.pickups.some((p) => !p.active)) {
      const reward = this.deferredPickups.shift()!;
      this.dropPickup(reward.kind, reward.x, reward.y, reward.value);
    }
    // If all slots remain occupied, trade one gem sprite for a required chest while conserving XP.
    if (this.deferredPickups.some((p) => p.kind === "chest")) {
      const gems = this.pickups.filter((p) => p.active && p.kind === "gem");
      if (gems.length >= 2) {
        gems[1].value += gems[0].value; gems[1].tier = gemTier(gems[1].value); gems[0].active = false;
        const idx = this.deferredPickups.findIndex((p) => p.kind === "chest");
        const chest = this.deferredPickups.splice(idx, 1)[0]; this.dropPickup(chest.kind, chest.x, chest.y, chest.value);
      }
    }
  }
  private updatePickups(dt: number) {
    const magnetR = this.stats.magnet;
    for (const p of this.pickups) {
      if (this.terminal) return;
      if (!p.active) continue;
      p.bob += dt * 3;
      const dx = this.px - p.x;
      const dy = this.py - p.y;
      const d = Math.hypot(dx, dy) || 1;

      const attractable = p.kind === "gem" || p.kind === "coin" || p.kind === "meat";
      if (attractable && (p.attracted || d < magnetR)) {
        p.attracted = true;
        const sp = Math.min(700, 260 + (1 - Math.min(1, d / 300)) * 520);
        p.vx = (dx / d) * sp;
        p.vy = (dy / d) * sp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      if (d < 26) {
        p.active = false;
        switch (p.kind) {
          case "gem": {
            this.gainXp(p.value);
            audio.sfx("pickup");
            break;
          }
          case "coin": {
            this.addGold(p.value * this.stats.goldGain, "coin");
            audio.sfx("gold");
            break;
          }
          case "meat": {
            this.heal(30);
            if (this.covenant?.reward === "sanctuary") this.iframes = Math.max(this.iframes, 1);
            audio.sfx("heal");
            break;
          }
          case "magnet": {
            for (const g of this.pickups) {
              if (g.active && (g.kind === "gem" || g.kind === "coin")) g.attracted = true;
            }
            audio.sfx("pickup");
            break;
          }
          case "bomb": {
            this.source = "bomb";
            this.shake = Math.max(this.shake, 1.2);
            audio.sfx("explosion");
            this.addFx({ kind: "nova", x: this.px, y: this.py, x2: 0, y2: 0, t: 0, dur: 0.8, radius: 600, color: "#ffb84d", angle: 0, arc: 0 });
            for (const e of this.enemies) {
              if (!e.active) continue;
              const dd = Math.hypot(e.x - this.px, e.y - this.py);
              if (dd < 620) this.hitEnemy(e, 250, false, 0, 0, { quiet: true });
            }
            if (this.boss) this.hitBoss(180, false);
            break;
          }
          case "chest": {
            this.openChest();
            break;
          }
        }
      }
    }
  }

  heal(v: number) {
    if (this.terminal || this.hp <= 0 || this.hp >= this.stats.maxHp) return;
    this.metrics.healing += Math.min(v, this.stats.maxHp - this.hp);
    this.hp = Math.min(this.stats.maxHp, this.hp + v);
    this.healFlash = 0.4;
    this.spawnDmgNum(this.px, this.py - 28, Math.round(v), false, true);
  }

  gainXp(v: number) {
    if (this.terminal || !Number.isFinite(v) || v < 0) return;
    this.metrics.xpCollected += v;
    this.xp += v;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level);
      this.levelUpsQueued++;
    }
    if (this.levelUpsQueued > 0 && this.phase === "playing") {
      this.levelUpsQueued--;
      this.offerLevelUp();
    }
  }

  // ------------------------------------------------------------- level ups

  private offerLevelUp() {
    const options = this.rollUpgradeOptions();
    audio.sfx("levelup");
    this.currentDraft = options;
    this.setPhase("levelup");
    this.cb.onHud(this.hudSnapshot());
    this.cb.onLevelUp(options);
  }

  private rollUpgradeOptions(): UpgradeOption[] {
    type Cand = { opt: UpgradeOption; weight: number };
    const cands: Cand[] = [];

    for (const w of this.weapons) {
      const def = WEAPONS[w.id];
      if (!w.evolved && w.level < def.maxLevel) {
        cands.push({
          weight: 3,
          opt: {
            kind: "weapon",
            id: w.id,
            name: def.name,
            icon: def.icon,
            color: def.color,
            level: w.level + 1,
            maxLevel: def.maxLevel,
            isNew: false,
            desc: def.levels[w.level].desc,
          },
        });
      }
    }
    for (const p of this.passives) {
      const def = PASSIVES[p.id];
      if (p.level < def.maxLevel) {
        cands.push({
          weight: 3,
          opt: {
            kind: "passive",
            id: p.id,
            name: def.name,
            icon: def.icon,
            color: def.color,
            level: p.level + 1,
            maxLevel: def.maxLevel,
            isNew: false,
            desc: def.perLevelDesc,
          },
        });
      }
    }
    if (this.weapons.length < MAX_WEAPONS) {
      for (const id of Object.keys(WEAPONS)) {
        if (this.weapons.some((w) => w.id === id)) continue;
        const def = WEAPONS[id];
        cands.push({
          weight: 2,
          opt: { kind: "weapon", id, name: def.name, icon: def.icon, color: def.color, level: 1, maxLevel: def.maxLevel, isNew: true, desc: def.desc },
        });
      }
    }
    if (this.passives.length < MAX_PASSIVES) {
      for (const id of Object.keys(PASSIVES)) {
        if (this.passives.some((p) => p.id === id)) continue;
        const def = PASSIVES[id];
        // pairing hint (VS-style): mark passives that evolve an owned weapon
        const pairsWith = this.weapons.find((w) => WEAPONS[w.id].evolvesWith === id);
        cands.push({
          weight: pairsWith ? 2.6 : 1.8,
          opt: { kind: "passive", id, name: def.name, icon: def.icon, color: def.color, level: 1, maxLevel: def.maxLevel, isNew: true, desc: def.desc + (pairsWith ? ` Evolves ${WEAPONS[pairsWith.id].name}.` : "") },
        });
      }
    }

    for (let i = cands.length - 1; i >= 0; i--) if (this.banished.has(cands[i].opt.id)) cands.splice(i, 1);
    const picks: UpgradeOption[] = [];
    const count = this.stats.luck >= 1.5 ? 4 : 3;
    for (let i = 0; i < count && cands.length; i++) {
      let total = 0;
      for (const c of cands) total += c.weight;
      let r = this.random() * total;
      let idx = 0;
      for (let j = 0; j < cands.length; j++) {
        r -= cands[j].weight;
        if (r <= 0) {
          idx = j;
          break;
        }
      }
      picks.push(cands[idx].opt);
      cands.splice(idx, 1);
    }
    if (!picks.length) {
      picks.push(
        { kind: "gold", id: "gold", name: "Bag of Gold", icon: "💰", color: "#f0c75e", level: 0, maxLevel: 0, isNew: false, desc: "+50 gold" },
        { kind: "heal", id: "heal", name: "Hearty Feast", icon: "🍗", color: "#ff6b6b", level: 0, maxLevel: 0, isNew: false, desc: "Restore 40 HP" },
      );
    }
    return picks.map((option) => {
      if (option.kind !== "weapon") return option;
      const def = WEAPONS[option.id];
      return { ...option, detail: weaponUpgradeDetail(def.id, option.level), partner: PASSIVES[def.evolvesWith].name, evolutionReady: option.level === def.maxLevel && this.passives.some((p) => p.id === def.evolvesWith) };
    });
  }
  rerollDraft() {
    if (this.phase !== "levelup" || this.terminal || this.suspended || this.draftTools.rerolls <= 0) return false;
    this.draftTools.rerolls--; this.currentDraft = this.rollUpgradeOptions();
    this.cb.onLevelUp(this.currentDraft); this.cb.onHud(this.hudSnapshot()); return true;
  }
  skipDraft() {
    if (this.phase !== "levelup" || this.terminal || this.suspended || this.draftTools.skips <= 0) return false;
    this.draftTools.skips--; this.finishDraft(); return true;
  }
  banishOption(id: string) {
    if (this.phase !== "levelup" || this.terminal || this.suspended || this.draftTools.banishes <= 0 || !this.currentDraft.some((o) => o.id === id && (o.kind === "weapon" || o.kind === "passive"))) return false;
    this.draftTools.banishes--; this.banished.add(id); this.currentDraft = this.rollUpgradeOptions();
    this.cb.onLevelUp(this.currentDraft); this.cb.onHud(this.hudSnapshot()); return true;
  }

  applyUpgrade(opt: UpgradeOption) {
    if (this.phase !== "levelup" || this.terminal || this.suspended || !opt) return;
    const offered = this.currentDraft.find((o) => o.id === opt.id && o.kind === opt.kind && o.level === opt.level);
    if (!offered || !validUpgradeForBuild(offered, this.weapons, this.passives, this.banished)) return;
    opt = offered;
    audio.sfx("click");
    switch (opt.kind) {
      case "weapon": {
        const w = this.weapons.find((x) => x.id === opt.id);
        if (w) w.level = Math.min(WEAPONS[w.id].maxLevel, w.level + 1);
        else this.weapons.push({ id: opt.id as WeaponId, level: 1, evolved: false, timer: 0.3, alt: 0 });
        break;
      }
      case "passive": {
        const p = this.passives.find((x) => x.id === opt.id);
        if (p) p.level = Math.min(PASSIVES[p.id].maxLevel, p.level + 1);
        else this.passives.push({ id: opt.id as PassiveId, level: 1 });
        this.recomputePassives();
        break;
      }
      case "gold":
        this.addGold(50 * this.stats.goldGain, "draft");
        break;
      case "heal":
        this.heal(40);
        break;
    }
    this.finishDraft();
  }
  private finishDraft() {
    this.currentDraft = [];
    // chain queued level-ups
    if (this.levelUpsQueued > 0) {
      this.levelUpsQueued--;
      this.currentDraft = this.rollUpgradeOptions();
      this.cb.onLevelUp(this.currentDraft);
      this.cb.onHud(this.hudSnapshot()); this.emitProgress(true);
      return;
    }
    if (this.pendingChest > 0) {
      this.pendingChest--;
      this.openChestNow();
      return;
    }
    this.lastT = performance.now();
    this.setPhase("playing");
    this.cb.onHud(this.hudSnapshot()); this.emitProgress(true);
  }

  /** Recompute stat contributions of passive items (idempotent). */
  private passiveBase: PlayerStats | null = null;
  private recomputePassives() {
    if (!this.passiveBase) this.passiveBase = { ...this.stats };
    // restore base (keep current revives — consumed independently)
    const revives = this.stats.revives;
    const hpRatio = this.hp / this.stats.maxHp;
    this.stats = { ...this.passiveBase };
    this.stats.revives = revives;
    for (const p of this.passives) {
      switch (p.id) {
        case "might": this.stats.might *= 1 + 0.08 * p.level; break;
        case "tome": this.stats.area *= 1 + 0.08 * p.level; break;
        case "boots": this.stats.moveSpeed *= 1 + 0.05 * p.level; break;
        case "eagle": this.stats.critChance += 0.04 * p.level; break;
        case "crystal": this.stats.cooldown *= 1 - 0.04 * p.level; break;
        case "heart":
          this.stats.maxHp = Math.round(this.stats.maxHp * (1 + 0.12 * p.level));
          this.stats.regen += 0.3 * p.level;
          break;
        case "magnet": this.stats.magnet *= 1 + 0.2 * p.level; break;
        case "clover": this.stats.luck *= 1 + 0.1 * p.level; break;
      }
    }
    this.hp = Math.min(this.stats.maxHp, Math.max(1, this.stats.maxHp * hpRatio));
  }

  // ------------------------------------------------------------- chests

  /** External entry (chest pickup): defers if a modal is already open. */
  private openChest() {
    if (this.terminal) return;
    if (this.phase !== "playing") {
      this.pendingChest++;
      return;
    }
    this.openChestNow();
  }

  /** Opens the chest immediately, regardless of current modal phase. */
  private openChestNow(chosenEvolution?: WeaponId) {
    if (this.terminal) return;
    const choices = this.weapons.filter((w) => !w.evolved && w.level === WEAPONS[w.id].maxLevel && this.passives.some((p) => p.id === WEAPONS[w.id].evolvesWith));
    if (choices.length > 1 && !chosenEvolution && this.cb.onEvolutionChoice) {
      this.setPhase("evolution");
      this.currentDraft = choices.map((w) => ({ kind: "evolution", id: w.id, name: WEAPONS[w.id].evolvedName, icon: WEAPONS[w.id].evolvedIcon, color: WEAPONS[w.id].color, level: w.level, maxLevel: w.level, isNew: true, desc: WEAPONS[w.id].evolvedDesc }));
      this.cb.onEvolutionChoice(this.currentDraft); return;
    }
    const rewards: ChestReward[] = [];
    // evolution check (VS rule: max-level weapon + its paired passive)
    const evolvable = this.weapons.find(
      (w) => (!chosenEvolution || w.id === chosenEvolution) && !w.evolved && w.level >= WEAPONS[w.id].maxLevel && this.passives.some((p) => p.id === WEAPONS[w.id].evolvesWith),
    );
    if (evolvable) {
      evolvable.evolved = true;
      this.metrics.evolutions.push(evolvable.id);
      const def = WEAPONS[evolvable.id];
      rewards.push({ icon: def.evolvedIcon, name: def.evolvedName, desc: def.evolvedDesc, isEvolution: true });
      audio.sfx("evolve");
    } else {
      // weighted level-ups
      const luck = this.stats.luck;
      const roll = this.random();
      const n = roll < 0.06 * luck ? 5 : roll < 0.22 * luck ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const ups: { kind: "weapon" | "passive"; id: string }[] = [];
        for (const w of this.weapons) if (!w.evolved && w.level < WEAPONS[w.id].maxLevel) ups.push({ kind: "weapon", id: w.id });
        for (const p of this.passives) if (p.level < PASSIVES[p.id].maxLevel) ups.push({ kind: "passive", id: p.id });
        if (!ups.length) break;
        const pick = ups[Math.floor(this.random() * ups.length)];
        if (pick.kind === "weapon") {
          const w = this.weapons.find((x) => x.id === pick.id)!;
          w.level++;
          const def = WEAPONS[w.id];
          rewards.push({ icon: def.icon, name: `${def.name} Lv.${w.level}`, desc: def.levels[w.level - 1].desc, isEvolution: false });
        } else {
          const p = this.passives.find((x) => x.id === pick.id)!;
          p.level++;
          const def = PASSIVES[p.id];
          rewards.push({ icon: def.icon, name: `${def.name} Lv.${p.level}`, desc: def.perLevelDesc, isEvolution: false });
        }
      }
      this.recomputePassives();
      audio.sfx("chest");
    }
    const gold = this.rand(25, 70) * this.stats.goldGain * this.stats.luck;
    this.addGold(gold, "chest");
    rewards.push({ icon: "💰", name: `${gold.toFixed(1)} Gold`, desc: "Earned this run; permanent progress saves automatically.", isEvolution: false });

    this.currentChest = rewards;
    this.setPhase("chest");
    this.cb.onHud(this.hudSnapshot());
    this.cb.onChest(rewards);
    this.emitProgress(true);
  }

  chooseEvolution(id: string) {
    if (this.phase !== "evolution" || this.terminal || this.suspended) return false;
    const offered = this.currentDraft.find((o) => o.kind === "evolution" && o.id === id);
    if (!offered || !validUpgradeForBuild(offered, this.weapons, this.passives, this.banished)) return false;
    this.currentDraft = []; this.openChestNow(id as WeaponId); return true;
  }
  ackChest() {
    if (this.phase !== "chest" || this.terminal || this.suspended) return;
    if (this.pendingChest > 0) {
      this.pendingChest--;
      this.openChestNow();
      return;
    }
    if (this.levelUpsQueued > 0) {
      this.levelUpsQueued--;
      this.setPhase("levelup");
      this.currentDraft = this.rollUpgradeOptions();
      this.cb.onLevelUp(this.currentDraft);
      this.cb.onHud(this.hudSnapshot()); this.emitProgress(true);
      return;
    }
    this.lastT = performance.now();
    this.setPhase("playing");
  }

  /** Serializable checkpoint of an active run. Cosmetic particles/audio are rebuilt on restore. */
  exportSnapshot() {
    if (!this.runId || this.terminal || this.disposed || this.debug) return null;
    return structuredClone({
      version: 1 as const, runId: this.runId, charId: this.charId, phase: this.phase,
      randomState: this.randomState, entitySerial: this.entitySerial, accumulator: this.accumulator,
      time: this.time, finalPhase: this.finalPhase, px: this.px, py: this.py, camX: this.camX, camY: this.camY,
      hp: this.hp, stats: this.stats, passiveBase: this.passiveBase, level: this.level, xp: this.xp, xpNext: this.xpNext,
      kills: this.kills, runGold: this.runGold, damageDealt: this.damageDealt, iframes: this.iframes, faceX: this.faceX,
      weapons: this.weapons, passives: this.passives, boss: this.boss,
      enemies: this.enemies.flatMap((e, slot) => e.active ? [{ ...e, slot }] : []),
      bullets: this.bullets.flatMap((b, slot) => b.active ? [{ ...b, slot, hitIds: [...b.hitIds] }] : []),
      enemyBullets: this.enemyBullets.flatMap((b, slot) => b.active ? [{ ...b, slot }] : []),
      pickups: this.pickups.flatMap((p, slot) => p.active ? [{ ...p, slot }] : []),
      scheduled: this.scheduled, deferredPickups: this.deferredPickups, fx: this.fx,
      bossesSpawned: [...this.bossesSpawned], eliteSpawned: [...this.eliteSpawned], swarmSpawned: [...this.swarmSpawned],
      spawnTimer: this.spawnTimer, encounterCooldown: this.encounterCooldown, orbAngle: this.orbAngle, pendingChest: this.pendingChest, levelUpsQueued: this.levelUpsQueued,
      currentDraft: this.currentDraft, currentChest: this.currentChest, banished: [...this.banished], draftTools: this.draftTools,
      covenant: this.covenant, traitCharge: this.traitCharge, traitCooldown: this.traitCooldown, traitCasts: this.traitCasts,
      lastAim: this.lastAim, source: this.source, metrics: this.metrics, damageCause: this.damageCause,
    });
  }
  importSnapshot(value: unknown): boolean {
    if (this.disposed || !validSnapshot(value)) return false;
    const snapshot = structuredClone(value);
    this.stop();
    // Restore only the declared schema: snapshots cannot replace methods, callbacks or platform state.
    const { version: _version, bullets, enemies, enemyBullets, pickups, bossesSpawned, eliteSpawned, swarmSpawned, banished, ...state } = snapshot;
    void _version;
    Object.assign(this, state);
    this.bossesSpawned = new Set(bossesSpawned); this.eliteSpawned = new Set(eliteSpawned); this.swarmSpawned = new Set(swarmSpawned); this.banished = new Set(banished);
    this.enemies.forEach((e) => e.active = false); enemies.forEach(({ slot, ...e }) => this.enemies[slot] = { ...e, def: ENEMIES[e.def.id] });
    this.bullets.forEach((b) => b.active = false); bullets.forEach(({ slot, ...b }) => this.bullets[slot] = { ...b, hitIds: new Set(b.hitIds) });
    this.enemyBullets.forEach((b) => b.active = false); enemyBullets.forEach(({ slot, ...b }) => this.enemyBullets[slot] = b);
    this.pickups.forEach((p) => p.active = false); pickups.forEach(({ slot, ...p }) => this.pickups[slot] = p);
    this.particles.forEach((p) => p.active = false); this.dmgNums.forEach((d) => d.active = false);
    if (this.boss) this.boss.def = BOSSES.find((b) => b.id === this.boss!.def.id)!;
    this.terminal = false; this.qaInvulnerable = false; this.progressDirty = false; this.buildGrid(); this.input.keys.clear(); this.input.joystick.active = false;
    this.cb.onPhaseChange(this.phase); this.cb.onHud(this.hudSnapshot());
    if (this.phase === "levelup") this.cb.onLevelUp(this.currentDraft);
    if (this.phase === "chest") this.cb.onChest(this.currentChest);
    if (this.phase === "evolution") this.cb.onEvolutionChoice?.(this.currentDraft);
    if (this.phase === "covenant") this.cb.onCovenant?.(this.covenant?.status === "reward" ? COVENANT_REWARDS : []);
    // The UI presents restore explicitly. Platform/manual suspension remains authoritative.
    this.start(); return true;
  }

  private recordDamage(effective: number, overkill: number) {
    this.damageDealt += effective;
    this.metrics.overkill += overkill;
    this.metrics.damageByWeapon[this.source] = (this.metrics.damageByWeapon[this.source] ?? 0) + effective;
  }
  private addGold(value: number, source: string) {
    if (!Number.isFinite(value) || value <= 0 || this.terminal) return;
    this.runGold += value;
    this.metrics.goldBySource[source] = (this.metrics.goldBySource[source] ?? 0) + value;
    this.progressDirty = true;
  }
  private emitProgress(force = false) {
    if (this.terminal || !this.runId || !force && !this.progressDirty) return;
    this.progressDirty = false;
    this.cb.onProgress?.(this.runStats(false));
  }
  private updateCovenant(dt: number) {
    if (!this.cb.onCovenant) return;
    if (!this.covenant && this.time >= 10 * 60 && this.time < 14 * 60 && !this.boss && this.encounterCooldown <= 0 && this.phase === "playing") {
      this.covenant = { status: "offered", x: this.px, y: this.py, remaining: 45, progress: 0, target: 12, reward: null };
      this.setPhase("covenant"); this.cb.onCovenant([]); return;
    }
    const c = this.covenant;
    if (c?.status !== "active" || this.phase !== "playing") return;
    c.remaining = Math.max(0, c.remaining - dt);
    if (c.progress >= c.target) {
      this.encounterCooldown = ENCOUNTER_SPACING;
      c.status = "reward"; this.setPhase("covenant"); this.cb.onCovenant(COVENANT_REWARDS);
    } else if (c.remaining <= 0) { c.status = "failed"; this.encounterCooldown = ENCOUNTER_SPACING; }
  }
  acceptCovenant() {
    if (this.phase !== "covenant" || this.covenant?.status !== "offered" || this.suspended) return false;
    this.covenant.status = "active";
    this.encounterCooldown = ENCOUNTER_SPACING;
    for (let i = 0; i < 12; i++) {
      const e = this.spawnEnemy(ENEMIES.cultist, false);
      if (e) { const a = i / 12 * TAU; e.x = this.covenant.x + Math.cos(a) * 260; e.y = this.covenant.y + Math.sin(a) * 260; e.windup = .8; }
    }
    this.addFx({ kind: "summon", x: this.covenant.x, y: this.covenant.y, x2: 0, y2: 0, t: 0, dur: 1, radius: 300, color: "#b78cff", angle: 0, arc: 0 });
    this.setPhase("playing"); return true;
  }
  declineCovenant() {
    if (this.phase !== "covenant" || this.covenant?.status !== "offered" || this.suspended) return false;
    this.covenant.status = "declined"; this.setPhase("playing"); return true;
  }
  chooseCovenantReward(id: CovenantId) { return this.chooseCovenant(id); }
  chooseCovenant(id: CovenantId) {
    if (this.phase !== "covenant" || this.covenant?.status !== "reward" || !COVENANT_REWARDS.some((o) => o.id === id) || this.suspended) return false;
    this.covenant.reward = id; this.covenant.status = "complete";
    this.setPhase("playing"); this.cb.onHud(this.hudSnapshot()); return true;
  }

  // ------------------------------------------------------------- fx helpers

  addFx(f: Fx) {
    if (this.fx.length > 120) this.fx.shift();
    this.fx.push(f);
  }

  private updateFx(dt: number) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t >= f.dur) this.fx.splice(i, 1);
    }
  }

  burst(x: number, y: number, n: number, color: string, speed: number) {
    let spawned = 0;
    for (const p of this.particles) {
      if (spawned >= n) break;
      if (p.active) continue;
      spawned++;
      p.active = true;
      p.x = x;
      p.y = y;
      const a = this.visualRandom() * TAU;
      const s = this.visualRand(speed * 0.3, speed);
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = this.visualRand(0.3, 0.7);
      p.life = p.maxLife;
      p.size = this.visualRand(1.5, 4);
      p.color = color;
      p.kind = this.visualRandom() < 0.4 ? "spark" : "puff";
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.05, dt);
      p.vy *= Math.pow(0.05, dt);
    }
  }

  spawnDmgNum(x: number, y: number, v: number, crit: boolean, heal: boolean) {
    for (const d of this.dmgNums) {
      if (d.active) continue;
      d.active = true;
      d.x = x;
      d.y = y;
      d.vy = -55;
      d.life = crit ? 0.8 : 0.6;
      d.value = Math.round(v);
      d.crit = crit;
      d.heal = heal;
      return;
    }
  }

  updateDmgNums(dt: number) {
    for (const d of this.dmgNums) {
      if (!d.active) continue;
      d.life -= dt;
      d.y += d.vy * dt;
      d.vy *= Math.pow(0.2, dt);
      if (d.life <= 0) d.active = false;
    }
  }

  // ------------------------------------------------------------- end of run

  private runStats(won: boolean, abandoned = false): RunStats {
    return {
      time: Math.min(this.time, GAME_DURATION), kills: this.kills, gold: this.runGold,
      level: this.level, damageDealt: this.damageDealt, won, runId: this.runId,
      character: this.charId, abandoned, cause: won ? "Death defeated" : abandoned ? "Run ended deliberately" : this.damageCause,
      finaleTime: Math.max(0, this.time - GAME_DURATION),
      build: [...this.weapons.map((w) => w.evolved ? WEAPONS[w.id].evolvedName : `${WEAPONS[w.id].name} ${w.level}`), ...this.passives.map((p) => `${PASSIVES[p.id].name} ${p.level}`)],
      weaponIds: this.weapons.map((w) => w.id),
      metrics: structuredClone(this.metrics),
    };
  }
  private endRun(won: boolean, abandoned = false) {
    if (this.terminal || !this.runId) return;
    this.terminal = true;
    this.stop();
    this.input.keys.clear(); this.input.joystick.active = false;
    const stats = this.runStats(won, abandoned);
    audio.sfx(won ? "victory" : "death");
    this.setPhase(won ? "victory" : "gameover");
    this.cb.onRunEnd(stats);
  }
  quitToMenu() { this.abandonRun(); }

  /** Developer-only, isolated QA scenarios. Never accept these controls in production. */
  debugScenario(options: { minute: number; density: number; fullBuild: boolean; boss?: "none" | "colossus" | "lich" | "death"; phase?: RunPhase; invulnerable: boolean; seed?: number }) {
    if (!this.debug || process.env.NODE_ENV === "production" || this.terminal) return false;
    this.scheduled = []; this.currentDraft = []; this.currentChest = []; this.pendingChest = this.levelUpsQueued = 0;
    this.time = Math.max(0, Math.min(30, options.minute)) * 60;
    this.encounterCooldown = 0;
    this.eliteSpawned = new Set(ELITE_MINUTES.filter((minute) => minute * 60 + 25 <= this.time));
    this.swarmSpawned = new Set(SWARM_MINUTES.filter((minute) => minute * 60 + 28 <= this.time));
    if (options.seed !== undefined && Number.isFinite(options.seed)) this.randomState = options.seed >>> 0 || 1;
    this.qaInvulnerable = options.invulnerable;
    this.finalPhase = this.time >= GAME_DURATION;
    this.boss = null; this.bossesSpawned = new Set(BOSSES.filter((b) => b.minute <= options.minute).map((b) => b.id));
    this.enemies.forEach((e) => e.active = false); this.enemyBullets.forEach((b) => b.active = false);
    this.bullets.forEach((b) => b.active = false); this.pickups.forEach((p) => p.active = false);
    if (options.fullBuild) {
      this.level = 80; this.xp = 0; this.xpNext = xpForLevel(this.level);
      const ids = [...new Set<WeaponId>([CHARACTERS.find((c) => c.id === this.charId)!.weapon, "aura", "frost", "orb", "lightning", "fire", "swordwave"])].slice(0, 6);
      this.weapons = ids.map((id) => ({ id, level: 8, evolved: false, timer: 0, alt: 0 }));
      this.passives = ids.map((id) => ({ id: WEAPONS[id].evolvesWith, level: 5 })); this.recomputePassives();
    }
    for (let i = 0; i < Math.max(0, Math.min(350, options.density)); i++) {
      const e = this.spawnEnemy(ENEMIES[Object.keys(ENEMIES)[i % Object.keys(ENEMIES).length]], false);
      if (e) { const a = i * 2.399; const radius = 110 + i % 17 * 20; e.x = this.px + Math.cos(a) * radius; e.y = this.py + Math.sin(a) * radius; }
    }
    if (options.boss && options.boss !== "none") this.spawnBoss(BOSSES.find((b) => b.id === options.boss)!);
    this.setPhase("playing"); this.buildGrid();
    if (options.phase === "levelup") this.gainXp(this.xpNext);
    if (options.phase === "chest" || options.phase === "evolution") this.openChestNow();
    if (options.phase === "covenant") { this.covenant = { status: "offered", x: this.px, y: this.py, remaining: 45, progress: 0, target: 12, reward: null }; this.setPhase("covenant"); this.cb.onCovenant?.([]); }
    if (options.phase === "paused") this.pause();
    if (options.phase === "gameover") this.endRun(false);
    if (options.phase === "victory") this.endRun(true);
    this.cb.onHud(this.hudSnapshot()); return true;
  }

  /** Debug helpers (only wired up when ?debug=1). */
  debugSkip(seconds: number) {
    if (!this.debug || process.env.NODE_ENV === "production") return;
    this.time = Math.min(this.time + seconds, GAME_DURATION - 0.5);
  }
  debugKillAll() {
    if (!this.debug || process.env.NODE_ENV === "production") return;
    for (const e of this.enemies) if (e.active) this.killEnemy(e, true);
  }
  debugMeltBoss() {
    if (!this.debug || process.env.NODE_ENV === "production" || !this.boss) return;
    this.boss.hp = Math.min(this.boss.hp, this.boss.maxHp * 0.02);
  }

  // ------------------------------------------------------------- hud

  hudSnapshot(): HudState {
    return {
      time: this.finalPhase ? GAME_DURATION : this.time,
      level: this.level,
      xp: this.xp,
      xpNext: this.xpNext,
      hp: Math.max(0, Math.ceil(this.hp)),
      maxHp: this.stats.maxHp,
      kills: this.kills,
      gold: this.runGold,
      stats: { ...this.stats }, draftTools: { ...this.draftTools }, runId: this.runId,
      finaleTime: Math.max(0, this.time - GAME_DURATION), trait: CHARACTERS.find((c) => c.id === this.charId)?.trait ?? "", covenant: this.covenant ? { ...this.covenant } : null,
      weapons: this.weapons.map((w) => ({
        id: w.id, name: w.evolved ? WEAPONS[w.id].evolvedName : WEAPONS[w.id].name, desc: w.evolved ? WEAPONS[w.id].evolvedDesc : weaponUpgradeDetail(w.id, w.level), partner: PASSIVES[WEAPONS[w.id].evolvesWith].name, evolutionReady: !w.evolved && w.level === WEAPONS[w.id].maxLevel && this.passives.some((p) => p.id === WEAPONS[w.id].evolvesWith),
        icon: w.evolved ? WEAPONS[w.id].evolvedIcon : WEAPONS[w.id].icon,
        level: w.level,
        maxLevel: WEAPONS[w.id].maxLevel,
        evolved: w.evolved,
      })),
      passives: this.passives.map((p) => ({
        id: p.id, name: PASSIVES[p.id].name, desc: PASSIVES[p.id].perLevelDesc,
        icon: PASSIVES[p.id].icon,
        level: p.level,
        maxLevel: PASSIVES[p.id].maxLevel,
      })),
      boss: this.boss
        ? { name: `${this.boss.def.name} — ${this.boss.def.title}`, hp: Math.max(0, this.boss.hp), maxHp: this.boss.maxHp }
        : null,
    };
  }
}

function gemTier(v: number): number {
  if (v >= 100) return 3;
  if (v >= 25) return 2;
  if (v >= 6) return 1;
  return 0;
}

/** Earliest segment/circle contact, including starts already inside the target. */
function segmentHitFraction(ax: number, ay: number, bx: number, by: number, x: number, y: number, radius: number): number | null {
  const ox = ax - x, oy = ay - y, c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const dx = bx - ax, dy = by - ay, a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = ox * dx + oy * dy, discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

function segmentHits(ax: number, ay: number, bx: number, by: number, x: number, y: number, radius: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return (x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2 <= radius * radius;
}

export type GameSnapshot = NonNullable<ReturnType<Game["exportSnapshot"]>>;
function validUpgradeForBuild(option: UpgradeOption, weapons: WeaponState[], passives: PassiveState[], banished: Set<string>): boolean {
  if (option.kind === "gold" || option.kind === "heal") return option.id === option.kind && option.level === 0 && option.maxLevel === 0 && !option.isNew;
  if (option.kind === "weapon" || option.kind === "evolution") {
    if (!Object.hasOwn(WEAPONS, option.id)) return false;
    const def = WEAPONS[option.id], owned = weapons.find((w) => w.id === option.id);
    if (option.maxLevel !== def.maxLevel) return false;
    if (option.kind === "evolution") return !!owned && !owned.evolved && owned.level === def.maxLevel && option.level === def.maxLevel && option.isNew && passives.some((p) => p.id === def.evolvesWith);
    if (banished.has(option.id)) return false;
    return owned ? !option.isNew && !owned.evolved && owned.level < def.maxLevel && option.level === owned.level + 1 : option.isNew && option.level === 1 && weapons.length < MAX_WEAPONS;
  }
  if (option.kind === "passive") {
    if (!Object.hasOwn(PASSIVES, option.id) || banished.has(option.id)) return false;
    const def = PASSIVES[option.id], owned = passives.find((p) => p.id === option.id);
    return option.maxLevel === def.maxLevel && (owned ? !option.isNew && owned.level < def.maxLevel && option.level === owned.level + 1 : option.isNew && option.level === 1 && passives.length < MAX_PASSIVES);
  }
  return false;
}
function validSnapshot(value: unknown): value is GameSnapshot {
  if (!value || typeof value !== "object") return false;
  const s = value as GameSnapshot;
  try {
    if (JSON.stringify(s).length > 900_000 || s.version !== 1 || typeof s.runId !== "string" || s.runId.length > 100 || !s.runId || !CHARACTERS.some((c) => c.id === s.charId)) return false;
    const own = (catalog: object, id: unknown): id is string => typeof id === "string" && Object.hasOwn(catalog, id);
    const text = (v: unknown, max = 2048) => typeof v === "string" && v.length <= max;
    const keys = "version runId charId phase randomState entitySerial accumulator time finalPhase px py camX camY hp stats passiveBase level xp xpNext kills runGold damageDealt iframes faceX weapons passives boss enemies bullets enemyBullets pickups scheduled deferredPickups fx bossesSpawned eliteSpawned swarmSpawned spawnTimer encounterCooldown orbAngle pendingChest levelUpsQueued currentDraft currentChest banished draftTools covenant traitCharge traitCooldown traitCasts lastAim source metrics damageCause".split(" ");
    if (Object.keys(s).length !== keys.length || Object.keys(s).some((key) => !keys.includes(key))) return false;
    const finiteTree = (v: unknown, depth = 0): boolean => depth <= 15 && (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v) || typeof v === "object" && Object.values(v).every((x) => finiteTree(x, depth + 1)));
    if (!finiteTree(s) || !["playing", "paused", "levelup", "chest", "evolution", "covenant"].includes(s.phase) || s.hp <= 0 || s.stats.maxHp <= 0 || s.hp > s.stats.maxHp || s.time < 0 || s.time > 86400 || s.level < 1 || s.runGold < 0 || s.randomState < 1) return false;
    const numeric = (v: unknown, fields: string) => !!v && typeof v === "object" && fields.split(" ").every((key) => typeof (v as Record<string, unknown>)[key] === "number" && Number.isFinite((v as Record<string, number>)[key]));
    const nonnegativeRecord = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every((n) => typeof n === "number" && n >= 0 && Number.isFinite(n));
    if (!numeric(s, "randomState entitySerial accumulator time px py camX camY hp level xp xpNext kills runGold damageDealt iframes faceX spawnTimer encounterCooldown orbAngle pendingChest levelUpsQueued traitCharge traitCooldown traitCasts lastAim") || typeof s.finalPhase !== "boolean" || typeof s.source !== "string" || typeof s.damageCause !== "string") return false;
    if (!Number.isInteger(s.entitySerial) || !Number.isInteger(s.randomState) || s.randomState > 0xffffffff || s.entitySerial < 0 || s.accumulator < 0 || s.accumulator > .25 || s.encounterCooldown < 0 || s.encounterCooldown > ENCOUNTER_SPACING || s.pendingChest < 0 || s.levelUpsQueued < 0) return false;
    const validStats = (stats: PlayerStats | null) => stats && Object.keys(BASE_SNAPSHOT_STATS).every((key) => typeof stats[key as keyof PlayerStats] === "number" && Number.isFinite(stats[key as keyof PlayerStats]) && stats[key as keyof PlayerStats] >= 0);
    if (!validStats(s.stats) || !validStats(s.passiveBase)) return false;
    if (!Array.isArray(s.weapons) || s.weapons.length > MAX_WEAPONS || s.weapons.some((w) => !own(WEAPONS, w.id) || !Number.isInteger(w.level) || w.level < 1 || w.level > 8 || typeof w.evolved !== "boolean" || typeof w.timer !== "number" || typeof w.alt !== "number")) return false;
    if (new Set(s.weapons.map((w) => w.id)).size !== s.weapons.length) return false;
    if (!Array.isArray(s.passives) || s.passives.length > MAX_PASSIVES || s.passives.some((p) => !own(PASSIVES, p.id) || !Number.isInteger(p.level) || p.level < 1 || p.level > 5)) return false;
    if (new Set(s.passives.map((p) => p.id)).size !== s.passives.length) return false;
    const entity = (e: { x: number; y: number; active: boolean }) => typeof e.x === "number" && typeof e.y === "number" && e.active === true;
    if (!Array.isArray(s.enemies) || s.enemies.length > 400 || s.enemies.some((e) => !entity(e) || !own(ENEMIES, e.def?.id) || !Number.isInteger(e.id) || !nonnegativeRecord(e.hitCooldowns) || !numeric(e, "id x y hp maxHp speed damage radius xp hitFlash slowT slowF kx ky orbCd wobble charge faceX chargeX chargeY windup") || e.hp <= 0 || e.radius <= 0 || e.radius > 50)) return false;
    const ids = s.enemies.map((e) => e.id); if (s.boss) ids.push(s.boss.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => id <= 0 || id > s.entitySerial)) return false;
    if (!Array.isArray(s.bullets) || s.bullets.length > 300 || s.bullets.some((b) => !entity(b) || !["arrow", "orb", "shard", "fireball", "meteor"].includes(b.kind) || !Array.isArray(b.hitIds) || b.hitIds.some((id) => !Number.isInteger(id)) || !own(WEAPONS, b.source) || !numeric(b, "x y vx vy life maxLife damage radius pierce angle tx ty aoe slowDuration"))) return false;
    if (!Array.isArray(s.enemyBullets) || s.enemyBullets.length > 120 || s.enemyBullets.some((b) => !entity(b) || !numeric(b, "x y vx vy life damage radius spin"))) return false;
    if (!Array.isArray(s.pickups) || s.pickups.length > 700 || s.pickups.some((p) => !entity(p) || !["gem", "coin", "meat", "magnet", "bomb", "chest"].includes(p.kind) || !numeric(p, "x y value tier vx vy bob"))) return false;
    const slotsValid = (items: { slot: number }[], cap: number) => new Set(items.map((item) => item.slot)).size === items.length && items.every((item) => Number.isInteger(item.slot) && item.slot >= 0 && item.slot < cap);
    if (!slotsValid(s.enemies, 400) || !slotsValid(s.bullets, 300) || !slotsValid(s.enemyBullets, 120) || !slotsValid(s.pickups, 700)) return false;
    if (s.boss && (!BOSSES.some((b) => b.id === s.boss?.def?.id) || !nonnegativeRecord(s.boss.hitCooldowns) || !numeric(s.boss, "id x y hp maxHp hitFlash t1 t2 t3 faceX windup dashT dashX dashY spiralA spiralN spiralT") || s.boss.hp <= 0)) return false;
    if (!Array.isArray(s.scheduled) || s.scheduled.length > 1000 || s.scheduled.some((a) => a.runId !== s.runId || !["slash", "lightning", "meteor", "slam", "teleport"].includes(a.kind) || !Array.isArray(a.args) || a.args.length !== (a.kind === "slash" ? 3 : 4) || a.args.some((n) => typeof n !== "number") || typeof a.remaining !== "number")) return false;
    if (![s.currentDraft, s.currentChest, s.deferredPickups, s.fx, s.banished, s.bossesSpawned, s.eliteSpawned, s.swarmSpawned].every(Array.isArray) || !s.draftTools || !s.metrics?.damageByWeapon || !s.metrics.goldBySource) return false;
    if (!numeric(s.draftTools, "rerolls skips banishes") || s.draftTools.rerolls < 0 || s.draftTools.rerolls > 3 || s.draftTools.skips < 0 || s.draftTools.skips > 2 || s.draftTools.banishes < 0 || s.draftTools.banishes > 1) return false;
    if (!numeric(s.metrics, "overkill damageTaken healing xpCollected") || !nonnegativeRecord(s.metrics.damageByWeapon) || !nonnegativeRecord(s.metrics.goldBySource) || !Array.isArray(s.metrics.bossesDefeated) || !Array.isArray(s.metrics.evolutions)) return false;
    if (s.covenant && (!numeric(s.covenant, "x y remaining progress target") || !["offered", "active", "reward", "complete", "declined", "failed"].includes(s.covenant.status) || s.covenant.reward !== null && !COVENANT_REWARDS.some((r) => r.id === s.covenant?.reward))) return false;
    if (s.fx.length > 121 || s.fx.some((f) => !numeric(f, "x y x2 y2 t dur radius angle arc") || !["slash", "ring", "bolt", "explosion", "telegraph", "nova", "summon"].includes(f.kind))) return false;
    if (s.deferredPickups.length > 2000 || s.deferredPickups.some((p) => !numeric(p, "x y value") || !["gem", "coin", "meat", "magnet", "bomb", "chest"].includes(p.kind))) return false;
    if (["levelup", "evolution"].includes(s.phase) && !s.currentDraft.length || s.phase === "chest" && !s.currentChest.length || s.phase === "covenant" && (!s.covenant || !["offered", "reward"].includes(s.covenant.status))) return false;
    if (s.currentChest.length > 6 || s.currentChest.some((r) => !text(r.name) || !text(r.desc) || !text(r.icon, 100) || typeof r.isEvolution !== "boolean")) return false;
    if (s.bossesSpawned.some((id) => !BOSSES.some((b) => b.id === id)) || s.eliteSpawned.some((minute) => !ELITE_MINUTES.includes(minute)) || s.swarmSpawned.some((minute) => !SWARM_MINUTES.includes(minute)) || s.banished.some((id) => !own(WEAPONS, id) && !own(PASSIVES, id))) return false;
    if (!own(WEAPONS, s.source) && !["other", "bomb", "revival"].includes(s.source)) return false;
    if (s.enemies.some((e) => typeof e.elite !== "boolean" || typeof e.charging !== "boolean" || e.speed < 0 || e.damage < 0 || e.slowF < 0 || e.slowF > 1) || s.pickups.some((p) => typeof p.attracted !== "boolean" || p.value < 0) || s.bullets.some((b) => typeof b.evolved !== "boolean" || b.damage < 0)) return false;
    if (s.metrics.bossesDefeated.some((id) => !BOSSES.some((b) => b.id === id)) || s.metrics.evolutions.some((id) => !own(WEAPONS, id))) return false;
    if (s.currentDraft.length > 6 || s.currentDraft.some((o) => {
      if (!o || !["weapon", "passive", "evolution", "gold", "heal"].includes(o.kind) || !text(o.id, 100) || !text(o.name) || !text(o.desc) || !text(o.icon, 100) || !text(o.color, 100) || typeof o.isNew !== "boolean" || !Number.isInteger(o.level) || !Number.isInteger(o.maxLevel)) return true;
      if (o.detail !== undefined && !text(o.detail) || o.partner !== undefined && !text(o.partner) || o.evolutionReady !== undefined && typeof o.evolutionReady !== "boolean") return true;
      if (o.kind === "gold" || o.kind === "heal") return o.id !== o.kind || o.level !== 0 || o.maxLevel !== 0;
      const catalog = o.kind === "passive" ? PASSIVES : WEAPONS;
      return !own(catalog, o.id) || o.level < 1 || o.level > catalog[o.id].maxLevel || o.maxLevel !== catalog[o.id].maxLevel;
    })) return false;
    if (s.phase === "evolution" && s.currentDraft.some((o) => o.kind !== "evolution" || o.level !== 8) || s.phase === "levelup" && s.currentDraft.some((o) => o.kind === "evolution")) return false;
    const banished = new Set(s.banished);
    if (new Set(s.currentDraft.map((o) => `${o.kind}:${o.id}`)).size !== s.currentDraft.length || s.currentDraft.some((o) => !validUpgradeForBuild(o, s.weapons, s.passives, banished))) return false;
    return true;
  } catch { return false; }
}
const BASE_SNAPSHOT_STATS: PlayerStats = { maxHp: 100, regen: 0, might: 1, area: 1, projSpeed: 1, cooldown: 1, moveSpeed: 1, magnet: 95, luck: 1, critChance: .05, critDamage: 1.6, armor: 0, xpGain: 1, goldGain: 1, revives: 0 };
