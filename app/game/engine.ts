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
  CHARACTERS,
  GAME_DURATION,
  MAX_WEAPONS,
  MAX_PASSIVES,
  enemyHpScale,
  enemyDmgScale,
  enemyXpScale,
  xpForLevel,
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
} from "./types";
import { Input } from "./input";
import { audio } from "./audio";

// ---------------------------------------------------------------- entities

export interface Enemy {
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
}

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
  onPhaseChange: (phase: "playing" | "levelup" | "chest" | "paused" | "gameover" | "victory") => void;
  onHud: (hud: HudState) => void;
  onLevelUp: (options: UpgradeOption[]) => void;
  onChest: (rewards: ChestReward[]) => void;
  onRunEnd: (stats: RunStats) => void;
  onBossWarning: (name: string, title: string) => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- engine

export class Game {
  // world
  time = 0;
  running = false;
  phase: "playing" | "levelup" | "chest" | "paused" | "gameover" | "victory" = "playing";
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
  eliteSpawned = new Set<number>();
  swarmSpawned = new Set<number>();

  // misc
  debug = false;
  input: Input;
  cb: Callbacks;
  private raf = 0;
  private lastT = 0;
  private hudTimer = 0;
  private grid = new Map<number, number[]>(); // spatial hash -> enemy indices
  private pendingChest = 0;
  levelUpsQueued = 0;
  victoryT = 0;

  constructor(input: Input, cb: Callbacks) {
    this.input = input;
    this.cb = cb;
    this.stats = { ...({} as PlayerStats) };
    for (let i = 0; i < 400; i++) this.enemies.push(this.blankEnemy());
    for (let i = 0; i < 300; i++) this.bullets.push(this.blankBullet());
    for (let i = 0; i < 120; i++) this.enemyBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0, radius: 7, color: "#fff", spin: 0 });
    for (let i = 0; i < 700; i++) this.pickups.push({ active: false, kind: "gem", x: 0, y: 0, value: 0, tier: 0, vx: 0, vy: 0, attracted: false, bob: Math.random() * TAU });
    for (let i = 0; i < 500; i++) this.particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: "#fff", kind: "puff" });
    for (let i = 0; i < 90; i++) this.dmgNums.push({ active: false, x: 0, y: 0, vy: 0, life: 0, value: 0, crit: false, heal: false });
  }

  private blankEnemy(): Enemy {
    return {
      active: false, def: ENEMIES.bat, x: 0, y: 0, hp: 1, maxHp: 1, speed: 0, damage: 0,
      radius: 10, xp: 1, elite: false, hitFlash: 0, slowT: 0, slowF: 1, kx: 0, ky: 0,
      orbCd: 0, wobble: Math.random() * TAU, charge: 0, charging: false, faceX: 1,
    };
  }
  private blankBullet(): Bullet {
    return {
      active: false, kind: "arrow", x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
      damage: 0, radius: 5, pierce: 0, angle: 0, evolved: false, tx: 0, ty: 0, aoe: 0,
    };
  }

  // ------------------------------------------------------------- run setup

  startRun(charId: CharacterId, metaStats: PlayerStats) {
    const char = CHARACTERS.find((c) => c.id === charId)!;
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
    this.setPhase("playing");
    this.start();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      try {
        if (this.phase === "playing") this.update(dt);
      } catch (err) {
        // a single bad frame must never freeze the run
        console.error("frame error", err);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setPhase(p: typeof this.phase) {
    this.phase = p;
    this.cb.onPhaseChange(p);
  }

  pause() {
    if (this.phase === "playing") this.setPhase("paused");
  }
  resume() {
    if (this.phase === "paused") {
      this.lastT = performance.now();
      this.setPhase("playing");
    }
  }

  // ------------------------------------------------------------- main update

  private update(dt: number) {
    this.time += dt;
    const t = this.finalPhase ? GAME_DURATION : this.time;

    this.updatePlayer(dt);
    this.updateSpawning(dt, t);
    this.buildGrid();
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateWeapons(dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateFx(dt);
    this.shake = Math.max(0, this.shake - dt * 18);

    // camera lerp
    this.camX += (this.px - this.camX) * Math.min(1, dt * 6);
    this.camY += (this.py - this.camY) * Math.min(1, dt * 6);

    // hud sync ~10Hz
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.cb.onHud(this.hudSnapshot());
    }

    // 30:00 — Death arrives
    if (!this.finalPhase && this.time >= GAME_DURATION) {
      this.enterFinalPhase();
    }

    if (this.victoryT > 0) {
      this.victoryT -= dt;
      if (this.victoryT <= 0) this.endRun(true);
    }
  }

  private updatePlayer(dt: number) {
    const mv = this.input.getMove();
    const speed = 175 * this.stats.moveSpeed;
    this.px += mv.x * speed * dt;
    this.py += mv.y * speed * dt;
    this.moving = Math.abs(mv.x) + Math.abs(mv.y) > 0.01;
    if (Math.abs(mv.x) > 0.01) this.faceX = Math.sign(mv.x);
    if (this.moving) this.walkT += dt * 9;
    this.iframes = Math.max(0, this.iframes - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.healFlash = Math.max(0, this.healFlash - dt);
    this.reviveFx = Math.max(0, this.reviveFx - dt);
    if (this.stats.regen > 0 && this.hp < this.stats.maxHp) {
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);
    }
    // Sanctuary heal
    const aura = this.weapons.find((w) => w.id === "aura");
    if (aura?.evolved && this.hp < this.stats.maxHp) {
      this.hp = Math.min(this.stats.maxHp, this.hp + 1.2 * dt);
    }
  }

  // ------------------------------------------------------------- spawning

  private waveFor(t: number) {
    const minute = Math.min(29, Math.floor(t / 60));
    return WAVES[minute];
  }

  private updateSpawning(dt: number, t: number) {
    if (this.finalPhase) return; // only the final boss + his summons

    const minute = Math.floor(t / 60);
    const wave = this.waveFor(t);
    const bossAlive = this.boss !== null;

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
          const id = wave.enemies[Math.floor(Math.random() * wave.enemies.length)];
          this.spawnEnemy(ENEMIES[id], false);
        }
      }
    }

    // swarm events — ring of bats/spiders converging (VS-style)
    if (SWARM_MINUTES.includes(minute) && !this.swarmSpawned.has(minute) && t % 60 > 28) {
      this.swarmSpawned.add(minute);
      const id = minute < 10 ? "bat" : minute < 20 ? "spider" : "hound";
      const count = 40;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU;
        const e = this.spawnEnemy(ENEMIES[id], false);
        if (e) {
          e.x = this.px + Math.cos(a) * 620;
          e.y = this.py + Math.sin(a) * 620;
          e.hp *= 0.6;
          e.maxHp *= 0.6;
        }
      }
    }

    // elites — drop treasure chests
    if (ELITE_MINUTES.includes(minute) && !this.eliteSpawned.has(minute) && t % 60 > 25) {
      this.eliteSpawned.add(minute);
      const pool = wave.enemies;
      const def = ENEMIES[pool[pool.length - 1]];
      this.spawnEnemy(def, true);
    }

    // bosses at 5 / 15 (30 handled by enterFinalPhase)
    for (const b of BOSSES) {
      if (b.minute < 30 && minute >= b.minute && !this.bossesSpawned.has(b.id) && !this.boss) {
        this.spawnBoss(b);
      }
    }
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
    const a = Math.random() * TAU;
    const dist = rand(560, 700);
    const hpMul = enemyHpScale(this.time) * (elite ? 14 : 1);
    slot.active = true;
    slot.def = def;
    slot.x = this.px + Math.cos(a) * dist;
    slot.y = this.py + Math.sin(a) * dist;
    slot.maxHp = def.hp * hpMul;
    slot.hp = slot.maxHp;
    slot.speed = def.speed * (elite ? 0.85 : rand(0.92, 1.08));
    slot.damage = def.damage * enemyDmgScale(this.time) * (elite ? 1.6 : 1);
    slot.radius = def.radius * (elite ? 1.9 : 1);
    slot.xp = def.xp * enemyXpScale(this.time) * (elite ? 10 : 1);
    slot.elite = elite;
    slot.hitFlash = 0;
    slot.slowT = 0;
    slot.slowF = 1;
    slot.kx = 0;
    slot.ky = 0;
    slot.orbCd = 0;
    slot.charge = rand(0, 2);
    slot.charging = false;
    if (elite) {
      this.addFx({ kind: "summon", x: slot.x, y: slot.y, x2: 0, y2: 0, t: 0, dur: 0.8, radius: slot.radius * 2.4, color: "#ffd166", angle: 0, arc: 0 });
    }
    return slot;
  }

  spawnBoss(def: BossDef) {
    this.bossesSpawned.add(def.id);
    const a = Math.random() * TAU;
    this.boss = {
      def,
      x: this.px + Math.cos(a) * 480,
      y: this.py + Math.sin(a) * 480,
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
    if (this.boss) this.boss.hp = 0.0001; // any lingering boss dies
    const final = BOSSES[2];
    this.spawnBoss(final);
  }

  // ------------------------------------------------------------- spatial hash

  private gridKey(cx: number, cy: number) {
    return (cx + 5000) * 16384 + (cy + 5000);
  }

  private buildGrid() {
    this.grid.clear();
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
    const x0 = Math.floor((x - r) / cs);
    const x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs);
    const y1 = Math.floor((y + r) / cs);
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
            if (fn(e)) return;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------- enemies

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.orbCd = Math.max(0, e.orbCd - dt);
      e.wobble += dt * 6;

      let speedF = 1;
      if (e.slowT > 0) {
        e.slowT -= dt;
        speedF = e.slowF;
      }

      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.faceX = Math.sign(dx) || 1;

      // teleport far-behind enemies back to the front (VS-style)
      if (dist > 1150) {
        const a = Math.random() * TAU;
        e.x = this.px + Math.cos(a) * 640;
        e.y = this.py + Math.sin(a) * 640;
        continue;
      }

      let vx = (dx / dist) * e.speed * speedF;
      let vy = (dy / dist) * e.speed * speedF;

      // hellhound charge behavior
      if (e.def.shape === "hound" && speedF > 0) {
        e.charge -= dt;
        if (!e.charging && e.charge <= 0 && dist < 320 && dist > 110) {
          e.charging = true;
          e.charge = 0.9;
        }
        if (e.charging) {
          vx *= 2.6;
          vy *= 2.6;
          if (e.charge <= 0) {
            e.charging = false;
            e.charge = rand(2.5, 4);
          }
        }
      }
      // wraith drift
      if (e.def.shape === "wraith" || e.def.shape === "shadow") {
        const s = Math.sin(e.wobble * 0.9) * 40;
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
      if (dist < e.radius + 14 && this.iframes <= 0) {
        this.damagePlayer(e.damage);
      }
    }
  }

  damagePlayer(raw: number) {
    if (this.iframes > 0 || this.phase !== "playing") return;
    const dmg = Math.max(1, raw - this.stats.armor);
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

  /** Apply damage to an enemy; returns overkill. */
  hitEnemy(e: Enemy, dmg: number, canCrit: boolean, kbX: number, kbY: number, opts?: { slow?: number; slowF?: number; quiet?: boolean }) {
    let final = dmg * this.stats.might;
    let crit = false;
    if (canCrit && Math.random() < this.stats.critChance) {
      crit = true;
      final *= this.stats.critDamage;
    }
    final = Math.max(1, Math.round(final));
    e.hp -= final;
    this.damageDealt += final;
    e.hitFlash = 0.12;
    const kr = 1 - (e.def.knockResist ?? 0);
    e.kx += kbX * kr;
    e.ky += kbY * kr;
    if (opts?.slow) {
      e.slowT = Math.max(e.slowT, opts.slow);
      e.slowF = opts.slowF ?? 0.55;
    }
    if (!opts?.quiet) audio.sfx("hit");
    this.spawnDmgNum(e.x + rand(-8, 8), e.y - e.radius - 4, final, crit, false);
    if (e.hp <= 0) this.killEnemy(e, true);
    return crit;
  }

  private killEnemy(e: Enemy, drops: boolean) {
    e.active = false;
    this.kills++;
    this.burst(e.x, e.y, e.elite ? 18 : 7, e.def.color, e.elite ? 160 : 90);
    if (!drops) return;

    // gem
    const xpVal = e.xp * this.stats.xpGain;
    this.dropPickup("gem", e.x + rand(-6, 6), e.y + rand(-6, 6), xpVal);
    // gold / extras
    const luck = this.stats.luck;
    if (e.elite) {
      this.dropPickup("chest", e.x, e.y, 0);
      for (let i = 0; i < 6; i++) this.dropPickup("coin", e.x + rand(-30, 30), e.y + rand(-30, 30), 5);
    } else {
      const r = Math.random();
      if (r < 0.035 * luck) this.dropPickup("coin", e.x, e.y, 5);
      else if (r < 0.035 * luck + 0.012 * luck) this.dropPickup("meat", e.x, e.y, 0);
      else if (r < 0.035 * luck + 0.012 * luck + 0.0022) {
        this.dropPickup(Math.random() < 0.5 ? "magnet" : "bomb", e.x, e.y, 0);
      }
    }
  }

  // ------------------------------------------------------------- boss logic

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
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
    let speed = b.def.speed * (b.enraged ? 1.35 : 1);
    if (b.dashT > 0) {
      b.dashT -= dt;
      b.x += b.dashX * dt;
      b.y += b.dashY * dt;
    } else if (b.windup > 0) {
      b.windup -= dt;
      if (b.windup <= 0) {
        b.dashT = 1.0;
        b.dashX = (dx / dist) * speed * 3.2;
        b.dashY = (dy / dist) * speed * 3.2;
        audio.sfx("slash");
      }
    } else {
      b.x += (dx / dist) * speed * dt;
      b.y += (dy / dist) * speed * dt;
    }

    // contact damage
    if (dist < b.def.radius + 14 && this.iframes <= 0) {
      this.damagePlayer(b.def.damage);
    }

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
        setTimeout(() => this.bossSlam(tx, ty, 120, b.def.damage * 1.2), 1200);
      }
      if (b.t2 <= 0) {
        b.t2 = 13;
        for (let i = 0; i < 4; i++) {
          const e = this.spawnEnemy(ENEMIES.skeleton, false);
          if (e) {
            const a = (i / 4) * TAU;
            e.x = b.x + Math.cos(a) * 70;
            e.y = b.y + Math.sin(a) * 70;
          }
        }
        this.addFx({ kind: "summon", x: b.x, y: b.y, x2: 0, y2: 0, t: 0, dur: 0.7, radius: 100, color: b.def.glow, angle: 0, arc: 0 });
      }
    } else if (b.def.id === "lich") {
      if (b.t1 <= 0) {
        b.t1 = 5 * enrageMul;
        // radial volley
        const n = 14;
        const off = Math.random() * TAU;
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
        // teleport + summon wraiths
        this.burst(b.x, b.y, 16, b.def.glow, 130);
        const a = Math.random() * TAU;
        b.x = this.px + Math.cos(a) * rand(220, 330);
        b.y = this.py + Math.sin(a) * rand(220, 330);
        this.addFx({ kind: "summon", x: b.x, y: b.y, x2: 0, y2: 0, t: 0, dur: 0.7, radius: 90, color: b.def.glow, angle: 0, arc: 0 });
        for (let i = 0; i < 3; i++) {
          const e = this.spawnEnemy(ENEMIES.wraith, false);
          if (e) {
            e.x = b.x + rand(-80, 80);
            e.y = b.y + rand(-80, 80);
          }
        }
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
        b.spiralA = Math.random() * TAU;
        b.spiralT = 0;
        audio.sfx("zap");
      }
      if (b.t2 <= 0 && b.dashT <= 0 && b.windup <= 0) {
        b.t2 = 10 * enrageMul;
        b.windup = 0.7;
        this.addFx({ kind: "telegraph", x: b.x, y: b.y, x2: this.px, y2: this.py, t: 0, dur: 0.7, radius: 40, color: "#ff2222", angle: Math.atan2(dy, dx), arc: 0 });
      }
      if (b.t3 <= 0) {
        b.t3 = 13 * enrageMul;
        for (let i = 0; i < (b.enraged ? 7 : 5); i++) {
          const e = this.spawnEnemy(ENEMIES.shadow, false);
          if (e) {
            const a = Math.random() * TAU;
            e.x = b.x + Math.cos(a) * rand(60, 140);
            e.y = b.y + Math.sin(a) * rand(60, 140);
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
    if (this.phase === "gameover" || this.phase === "victory") return;
    this.addFx({ kind: "ring", x, y, x2: 0, y2: 0, t: 0, dur: 0.5, radius: r * 1.4, color: "#ffb84d", angle: 0, arc: 0 });
    this.burst(x, y, 20, "#d8c9a0", 170);
    this.shake = Math.max(this.shake, 0.9);
    audio.sfx("explosion");
    const ddx = this.px - x;
    const ddy = this.py - y;
    if (Math.hypot(ddx, ddy) < r + 12) this.damagePlayer(dmg);
  }

  hitBoss(dmg: number, canCrit: boolean) {
    const b = this.boss;
    if (!b) return;
    let final = dmg * this.stats.might;
    let crit = false;
    if (canCrit && Math.random() < this.stats.critChance) {
      crit = true;
      final *= this.stats.critDamage;
    }
    final = Math.max(1, Math.round(final));
    b.hp -= final;
    this.damageDealt += final;
    b.hitFlash = 0.1;
    this.spawnDmgNum(b.x + rand(-14, 14), b.y - b.def.radius - 8, final, crit, false);
    if (b.hp <= 0) this.killBoss();
  }

  private killBoss() {
    const b = this.boss;
    if (!b) return;
    this.boss = null;
    this.kills++;
    audio.sfx("bossDie");
    this.shake = Math.max(this.shake, 1.4);
    this.burst(b.x, b.y, 50, b.def.color, 240);
    this.burst(b.x, b.y, 30, "#ffd166", 200);
    this.addFx({ kind: "nova", x: b.x, y: b.y, x2: 0, y2: 0, t: 0, dur: 1.0, radius: 380, color: b.def.glow, angle: 0, arc: 0 });

    if (b.def.id === "death") {
      // VICTORY!
      this.victoryT = 1.6;
      return;
    }
    // rewards: chest + gem shower + magnet
    this.dropPickup("chest", b.x, b.y, 0);
    for (let i = 0; i < 14; i++) {
      this.dropPickup("gem", b.x + rand(-90, 90), b.y + rand(-90, 90), 12 * enemyXpScale(this.time));
    }
    for (let i = 0; i < 10; i++) this.dropPickup("coin", b.x + rand(-70, 70), b.y + rand(-70, 70), 8);
    this.dropPickup("magnet", b.x + rand(-40, 40), b.y + rand(-40, 40), 0);
  }

  // ------------------------------------------------------------- weapons

  private updateWeapons(dt: number) {
    this.orbAngle += dt * 2.4;
    for (const w of this.weapons) {
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
    const def = WEAPONS[w.id];
    const out = { damage: 10, cooldown: 1.5, amount: 1, area: 1, speed: 400, pierce: 0, duration: 2 };
    for (let i = 0; i < w.level && i < def.levels.length; i++) {
      const l = def.levels[i];
      if (l.damage !== undefined) out.damage = l.damage;
      if (l.cooldown !== undefined) out.cooldown = l.cooldown;
      if (l.amount !== undefined) out.amount = l.amount;
      if (l.area !== undefined) out.area = l.area;
      if (l.speed !== undefined) out.speed = l.speed;
      if (l.pierce !== undefined) out.pierce = l.pierce;
      if (l.duration !== undefined) out.duration = l.duration;
    }
    return out;
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
        else if (Math.random() < 24 / n) candidates[Math.floor(Math.random() * 24)] = { x: e.x, y: e.y };
      }
    }
    if (this.boss) {
      // bosses soak a third of random-target attacks (lightning / fireballs)
      if (Math.random() < 0.33) return { x: this.boss.x, y: this.boss.y };
      candidates.push({ x: this.boss.x, y: this.boss.y });
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private fireWeapon(w: WeaponState, def: (typeof WEAPONS)[string], L: ReturnType<Game["levelStats"]>) {
    const area = this.stats.area * L.area;
    const evolved = w.evolved;

    switch (w.id) {
      case "swordwave": {
        const baseA = this.faceX > 0 ? 0 : Math.PI;
        const dmg = L.damage * (evolved ? 1.7 : 1);
        const reach = 95 * area * (evolved ? 1.45 : 1);
        const dirs = evolved ? 3 : L.amount;
        for (let i = 0; i < dirs; i++) {
          let a = baseA;
          if (i === 1) a = baseA + Math.PI;
          if (i === 2) a = baseA + (w.alt % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
          const delay = i * 0.09;
          setTimeout(() => {
            if (this.phase !== "playing") return;
            this.slash(a, reach, dmg, evolved);
          }, delay * 1000);
        }
        w.alt++;
        audio.sfx("slash");
        break;
      }
      case "bow": {
        const target = this.nearestEnemyAngle();
        if (target === null) break;
        const n = evolved ? L.amount + 3 : L.amount;
        const dmg = L.damage * (evolved ? 1.4 : 1);
        const spd = L.speed * this.stats.projSpeed * (evolved ? 1.25 : 1);
        for (let i = 0; i < n; i++) {
          const a = target + (i - (n - 1) / 2) * 0.11;
          this.spawnBullet("arrow", this.px, this.py, Math.cos(a) * spd, Math.sin(a) * spd, dmg, 5, L.pierce + (evolved ? 2 : 0), 1.4, evolved, 0);
        }
        audio.sfx("shoot");
        break;
      }
      case "orb": {
        const n = L.amount;
        const base = this.nearestEnemyAngle() ?? Math.random() * TAU;
        for (let i = 0; i < n; i++) {
          const a = base + (i * TAU) / n + rand(-0.2, 0.2);
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
          setTimeout(() => {
            if (this.phase !== "playing") return;
            this.lightningStrike(t.x, t.y, r, dmg, evolved);
          }, i * 90);
        }
        break;
      }
      case "frost": {
        if (evolved) {
          // Absolute Zero — freezing nova
          const r = 190 * area;
          this.addFx({ kind: "nova", x: this.px, y: this.py, x2: 0, y2: 0, t: 0, dur: 0.55, radius: r, color: "#a8ecff", angle: 0, arc: 0 });
          this.nearEnemies(this.px, this.py, r, (e) => {
            this.hitEnemy(e, L.damage * 2.2, true, 0, 0, { slow: 1.6, slowF: 0, quiet: true });
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
            this.spawnBullet("shard", this.px, this.py, Math.cos(a) * spd, Math.sin(a) * spd, L.damage, 5, 0, 1.1, false, 0);
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
            const tx = t ? t.x + rand(-40, 40) : this.px + rand(-260, 260);
            const ty = t ? t.y + rand(-40, 40) : this.py + rand(-260, 260);
            const delay = i * 0.16;
            setTimeout(() => {
              if (this.phase !== "playing") return;
              this.addFx({ kind: "telegraph", x: tx, y: ty, x2: 0, y2: 0, t: 0, dur: 0.65, radius: 78 * this.stats.area, color: "#ff9f5b", angle: 0, arc: 0 });
              const b = this.spawnBullet("meteor", tx - 180, ty - 420, 0, 0, L.damage * 1.9, 13, 0, 0.65, true, 95 * this.stats.area);
              if (b) {
                b.tx = tx;
                b.ty = ty;
                b.vx = 180 / 0.65;
                b.vy = 420 / 0.65;
              }
            }, delay * 1000);
          }
          audio.sfx("fire");
        } else {
          const n = L.amount;
          for (let i = 0; i < n; i++) {
            const t = this.randomTarget();
            const a = t ? Math.atan2(t.y - this.py, t.x - this.px) : Math.random() * TAU;
            const spd = L.speed * this.stats.projSpeed;
            this.spawnBullet("fireball", this.px, this.py, Math.cos(a) * spd, Math.sin(a) * spd, L.damage, 8, 0, 2.2, false, 62 * area * L.area);
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
    this.addFx({ kind: "slash", x: this.px, y: this.py, x2: 0, y2: 0, t: 0, dur: 0.22, radius: reach, color: evolved ? "#ff6b6b" : "#e8e3d4", angle, arc: 1.5 });
    let killsHealed = 0;
    this.nearEnemies(this.px, this.py, reach, (e) => {
      const a = Math.atan2(e.y - this.py, e.x - this.px);
      let diff = Math.abs(a - angle);
      if (diff > Math.PI) diff = TAU - diff;
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
        let diff = Math.abs(a - angle);
        if (diff > Math.PI) diff = TAU - diff;
        if (diff < 0.95) this.hitBoss(dmg, true);
      }
    }
  }

  private lightningStrike(x: number, y: number, r: number, dmg: number, chain: boolean) {
    this.addFx({ kind: "bolt", x, y: y, x2: x + rand(-30, 30), y2: y - 400, t: 0, dur: 0.18, radius: r, color: "#7dd9ff", angle: 0, arc: 0 });
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
        if (e.orbCd > 0) return;
        e.orbCd = 0.45;
        const dx = e.x - this.px;
        const dy = e.y - this.py;
        const d = Math.hypot(dx, dy) || 1;
        this.hitEnemy(e, dmg, true, (dx / d) * 120, (dy / d) * 120);
      });
      if (this.boss) {
        const d = Math.hypot(this.boss.x - bx, this.boss.y - by);
        if (d < 16 + this.boss.def.radius && (this.boss as unknown as { _orbCd?: number })) {
          const bb = this.boss as Boss & { _orbCd?: number };
          if (!bb._orbCd || bb._orbCd <= 0) {
            bb._orbCd = 0.45;
            this.hitBoss(dmg, true);
          }
        }
      }
    }
    const bb = this.boss as (Boss & { _orbCd?: number }) | null;
    if (bb?._orbCd) bb._orbCd -= dt;
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
      if (!b.active) continue;
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
        this.nearEnemies(b.x, b.y, b.aoe, (e) => {
          const dx = b.x - e.x;
          const dy = b.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          e.x += (dx / d) * 95 * dt;
          e.y += (dy / d) * 95 * dt;
        });
      }
      if (b.kind === "meteor") continue; // damages on impact only

      // collide with enemies
      let dead = false;
      this.nearEnemies(b.x, b.y, b.radius, (e) => {
        if (b.kind === "orb") {
          if (e.orbCd > 0) return;
          e.orbCd = 0.3;
          this.hitEnemy(e, b.damage, true, b.vx * 0.06, b.vy * 0.06, { quiet: true });
          return;
        }
        if (b.kind === "shard") {
          this.hitEnemy(e, b.damage, true, b.vx * 0.04, b.vy * 0.04, { slow: 1.8, slowF: 0.55, quiet: true });
          b.active = false;
          dead = true;
          return true;
        }
        if (b.kind === "fireball") {
          this.explode(b.x, b.y, b.aoe, b.damage);
          b.active = false;
          dead = true;
          return true;
        }
        // arrow
        const crit = this.hitEnemy(e, b.damage, true, b.vx * 0.05, b.vy * 0.05, { quiet: true });
        if (b.evolved && crit) {
          this.addFx({ kind: "ring", x: e.x, y: e.y, x2: 0, y2: 0, t: 0, dur: 0.25, radius: 52, color: "#ffd166", angle: 0, arc: 0 });
          this.nearEnemies(e.x, e.y, 52, (o) => {
            if (o !== e) this.hitEnemy(o, b.damage * 0.5, false, 0, 0, { quiet: true });
          });
        }
        if (b.pierce > 0) b.pierce--;
        else {
          b.active = false;
          dead = true;
          return true;
        }
      });
      if (dead) continue;

      // collide with boss
      if (this.boss) {
        const dx = this.boss.x - b.x;
        const dy = this.boss.y - b.y;
        if (Math.hypot(dx, dy) < b.radius + this.boss.def.radius) {
          if (b.kind === "orb") {
            const bb = this.boss as Boss & { _bulletCd?: number };
            if (!bb._bulletCd || bb._bulletCd <= 0) {
              bb._bulletCd = 0.3;
              this.hitBoss(b.damage, true);
            }
          } else if (b.kind === "fireball") {
            this.explode(b.x, b.y, b.aoe, b.damage);
            b.active = false;
          } else {
            this.hitBoss(b.damage, true);
            if (b.pierce > 0) b.pierce--;
            else b.active = false;
          }
        }
        // hitBoss above may have killed the boss (this.boss → null)
        const bb = this.boss as (Boss & { _bulletCd?: number }) | null;
        if (bb?._bulletCd) bb._bulletCd -= dt;
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
      b.spin = Math.random() * TAU;
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
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const d = Math.hypot(b.x - this.px, b.y - this.py);
      if (d < b.radius + 13) {
        b.active = false;
        this.damagePlayer(b.damage);
      }
    }
  }

  // ------------------------------------------------------------- pickups

  dropPickup(kind: Pickup["kind"], x: number, y: number, value: number) {
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
          const g = live[Math.floor(Math.random() * live.length)];
          g.value += value;
          g.tier = gemTier(g.value);
        }
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
    slot.bob = Math.random() * TAU;
  }

  private updatePickups(dt: number) {
    const magnetR = this.stats.magnet;
    for (const p of this.pickups) {
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
            this.runGold += Math.round(p.value * this.stats.goldGain);
            audio.sfx("gold");
            break;
          }
          case "meat": {
            this.heal(30);
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
    if (this.hp >= this.stats.maxHp) return;
    this.hp = Math.min(this.stats.maxHp, this.hp + v);
    this.healFlash = 0.4;
    this.spawnDmgNum(this.px, this.py - 28, Math.round(v), false, true);
  }

  gainXp(v: number) {
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
    this.setPhase("levelup");
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

    const picks: UpgradeOption[] = [];
    const count = this.stats.luck >= 1.5 ? 4 : 3;
    for (let i = 0; i < count && cands.length; i++) {
      let total = 0;
      for (const c of cands) total += c.weight;
      let r = Math.random() * total;
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
    return picks;
  }

  applyUpgrade(opt: UpgradeOption) {
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
        this.runGold += 50;
        break;
      case "heal":
        this.heal(40);
        break;
    }
    // chain queued level-ups
    if (this.levelUpsQueued > 0) {
      this.levelUpsQueued--;
      this.cb.onLevelUp(this.rollUpgradeOptions());
      return;
    }
    if (this.pendingChest > 0) {
      this.pendingChest--;
      this.openChestNow();
      return;
    }
    this.lastT = performance.now();
    this.setPhase("playing");
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
    if (this.phase === "levelup" || this.phase === "chest") {
      this.pendingChest++;
      return;
    }
    this.openChestNow();
  }

  /** Opens the chest immediately, regardless of current modal phase. */
  private openChestNow() {
    const rewards: ChestReward[] = [];
    // evolution check (VS rule: max-level weapon + its paired passive)
    const evolvable = this.weapons.find(
      (w) => !w.evolved && w.level >= WEAPONS[w.id].maxLevel && this.passives.some((p) => p.id === WEAPONS[w.id].evolvesWith),
    );
    if (evolvable) {
      evolvable.evolved = true;
      const def = WEAPONS[evolvable.id];
      rewards.push({ icon: def.evolvedIcon, name: def.evolvedName, desc: def.evolvedDesc, isEvolution: true });
      audio.sfx("evolve");
    } else {
      // weighted level-ups
      const luck = this.stats.luck;
      const roll = Math.random();
      const n = roll < 0.06 * luck ? 5 : roll < 0.22 * luck ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const ups: { kind: "weapon" | "passive"; id: string }[] = [];
        for (const w of this.weapons) if (!w.evolved && w.level < WEAPONS[w.id].maxLevel) ups.push({ kind: "weapon", id: w.id });
        for (const p of this.passives) if (p.level < PASSIVES[p.id].maxLevel) ups.push({ kind: "passive", id: p.id });
        if (!ups.length) break;
        const pick = ups[Math.floor(Math.random() * ups.length)];
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
    const gold = Math.round(rand(25, 70) * this.stats.goldGain * this.stats.luck);
    this.runGold += gold;
    rewards.push({ icon: "💰", name: `${gold} Gold`, desc: "Added to your treasury.", isEvolution: false });

    this.setPhase("chest");
    this.cb.onChest(rewards);
  }

  ackChest() {
    if (this.pendingChest > 0) {
      this.pendingChest--;
      this.openChestNow();
      return;
    }
    if (this.levelUpsQueued > 0) {
      this.levelUpsQueued--;
      this.setPhase("levelup");
      this.cb.onLevelUp(this.rollUpgradeOptions());
      return;
    }
    this.lastT = performance.now();
    this.setPhase("playing");
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
      const a = Math.random() * TAU;
      const s = rand(speed * 0.3, speed);
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = rand(0.3, 0.7);
      p.life = p.maxLife;
      p.size = rand(1.5, 4);
      p.color = color;
      p.kind = Math.random() < 0.4 ? "spark" : "puff";
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

  private endRun(won: boolean) {
    const stats: RunStats = {
      // the clock freezes at 30:00 during the final fight
      time: Math.min(this.time, GAME_DURATION),
      kills: this.kills,
      gold: this.runGold,
      level: this.level,
      damageDealt: this.damageDealt,
      won,
    };
    if (won) audio.sfx("victory");
    else audio.sfx("death");
    this.setPhase(won ? "victory" : "gameover");
    this.cb.onRunEnd(stats);
  }

  quitToMenu() {
    this.stop();
  }

  /** Debug helpers (only wired up when ?debug=1). */
  debugSkip(seconds: number) {
    if (!this.debug) return;
    this.time = Math.min(this.time + seconds, GAME_DURATION - 0.5);
  }
  debugKillAll() {
    if (!this.debug) return;
    for (const e of this.enemies) if (e.active) this.killEnemy(e, true);
  }
  debugMeltBoss() {
    if (!this.debug || !this.boss) return;
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
      weapons: this.weapons.map((w) => ({
        icon: w.evolved ? WEAPONS[w.id].evolvedIcon : WEAPONS[w.id].icon,
        level: w.level,
        maxLevel: WEAPONS[w.id].maxLevel,
        evolved: w.evolved,
      })),
      passives: this.passives.map((p) => ({
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
