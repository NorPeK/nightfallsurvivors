// ---------- Shared engine types ----------

export type Vec = { x: number; y: number };

export type WeaponId =
  | "swordwave"
  | "bow"
  | "orb"
  | "lightning"
  | "frost"
  | "fire"
  | "aura"
  | "daggers";

export type PassiveId =
  | "might"
  | "tome"
  | "boots"
  | "eagle"
  | "crystal"
  | "heart"
  | "magnet"
  | "clover";

export type CharacterId = "knight" | "ranger" | "mage" | "reaper";

export interface WeaponLevelDef {
  desc: string;
  damage?: number; // base damage at this level (absolute)
  cooldown?: number; // seconds (absolute)
  amount?: number; // projectiles / strikes (absolute)
  area?: number; // size multiplier (absolute)
  speed?: number; // projectile speed px/s (absolute)
  pierce?: number;
  duration?: number; // seconds projectile lives / slow time
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  color: string;
  desc: string;
  evolvesWith: PassiveId;
  evolvedName: string;
  evolvedIcon: string;
  evolvedDesc: string;
  maxLevel: number;
  levels: WeaponLevelDef[]; // index 0 = level 1
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  icon: string;
  color: string;
  desc: string;
  maxLevel: number;
  perLevelDesc: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  color: string;
  glow: string;
  shape: "bat" | "ghoul" | "skeleton" | "spider" | "wraith" | "cultist" | "brute" | "hound" | "gargoyle" | "demon" | "golem" | "shadow" | "lancer" | "banshee" | "scarab";
  behavior?: "charge"; // Unspecified enemies pursue; charges commit after a warning.
  attack?: "bolt" | "fan" | "hex"; // Warned ordinary-enemy attacks, separate from mini-boss patterns.
  knockResist?: number; // 0..1
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  minute: number;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  glow: string;
  shape: "colossus" | "lich" | "death";
}

/** Named field encounters; authored stats already include their intended minute's strength. */
export interface MiniBossDef {
  id: string;
  name: string;
  title: string;
  minute: number;
  enemyId: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  gold: number;
  pattern: "charge" | "volley" | "slam";
}

export interface WaveDef {
  minute: number;
  enemies: string[]; // enemy ids active this minute
  interval: number; // seconds between spawn ticks
  perTick: number; // enemies per tick
  maxAlive: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  icon: string;
  color: string;
  weapon: WeaponId;
  desc: string;
  bonuses: string[];
  trait?: string;
  stats: Partial<PlayerStats>;
}

export interface PlayerStats {
  maxHp: number;
  regen: number; // hp / s
  might: number; // damage multiplier
  area: number;
  projSpeed: number;
  cooldown: number; // multiplier, lower = faster
  moveSpeed: number; // multiplier
  magnet: number; // pickup radius px
  luck: number; // multiplier
  critChance: number; // 0..1
  critDamage: number; // multiplier
  armor: number; // flat reduction
  xpGain: number; // multiplier
  goldGain: number; // multiplier
  revives: number;
  evolutionSlots: number; // 1 by default; permanent Evolutions ranks unlock up to 6
}

export interface MetaUpgradeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  apply: (stats: PlayerStats, level: number) => void;
}

export interface MetaSave {
  gold: number;
  upgrades: Record<string, number>;
  bestTime: number;
  totalKills: number;
  wins: number;
  runs: number;
  muted: boolean;
}

// ---------- UI bridge types ----------

export type UpgradeKind = "weapon" | "passive" | "evolution" | "gold" | "heal";

export interface UpgradeOption {
  kind: UpgradeKind;
  id: string;
  name: string;
  icon: string;
  color: string;
  level: number; // level it will BECOME (0 for gold/heal)
  maxLevel: number;
  isNew: boolean;
  desc: string;
  detail?: string;
  partner?: string;
  evolutionReady?: boolean;
}

export interface ChestReward {
  icon: string;
  name: string;
  desc: string;
  isEvolution: boolean;
}

export interface HudState {
  time: number;
  level: number;
  xp: number;
  xpNext: number;
  hp: number;
  maxHp: number;
  kills: number;
  gold: number;
  weapons: { id: WeaponId; name: string; desc: string; partner: string; evolutionReady: boolean; icon: string; level: number; maxLevel: number; evolved: boolean }[];
  passives: { id: PassiveId; name: string; desc: string; icon: string; level: number; maxLevel: number }[];
  stats: PlayerStats;
  draftTools: DraftTools;
  runId: string;
  finaleTime: number;
  trait: string;
  covenant: CovenantState | null;
  nextEncounter: { name: string; minute: number; kind: "boss" | "miniBoss" } | null;
  boss: { name: string; hp: number; maxHp: number } | null;
}

export interface RunStats {
  time: number;
  kills: number;
  gold: number;
  level: number;
  damageDealt: number;
  won: boolean;
  runId: string;
  character: CharacterId;
  abandoned: boolean;
  cause: string;
  finaleTime: number;
  build: string[];
  weaponIds?: WeaponId[];
  metrics: RunMetrics;
}

export interface RunMetrics {
  damageByWeapon: Record<string, number>;
  overkill: number;
  damageTaken: number;
  healing: number;
  xpCollected: number;
  goldBySource: Record<string, number>;
  bossesDefeated: string[];
  /** Absent in older completed-run records. New runs always initialize it. */
  miniBossesDefeated?: string[];
  evolutions: string[];
}

export interface DraftTools { rerolls: number; skips: number; banishes: number }
export type CovenantId = "frost" | "precision" | "sanctuary";
export interface CovenantOption { id: CovenantId; name: string; desc: string }
export interface CovenantState {
  status: "offered" | "active" | "reward" | "complete" | "declined" | "failed";
  x: number; y: number; remaining: number; progress: number; target: number; reward: CovenantId | null;
}

export type RunPhase = "playing" | "levelup" | "chest" | "paused" | "evolution" | "covenant" | "gameover" | "victory";

export type GamePhase =
  | "menu"
  | "characters"
  | "shop"
  | "howto"
  | "playing"
  | "levelup"
  | "chest"
  | "paused"
  | "evolution"
  | "covenant"
  | "gameover"
  | "victory";
