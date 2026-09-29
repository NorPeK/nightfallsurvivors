import type { CharacterId, MetaSave, PlayerStats, RunStats } from "./types";
import { BASE_STATS, BOSSES, ENEMIES, META_UPGRADES, MINI_BOSSES, WEAPONS, metaUpgradeCost } from "./data";
import { platform } from "./platform";
import { initialSettings, isHunter, normalizeSettings, type GameSettings } from "./settings";

export const PROFILE_VERSION = 2;
export const MAX_SAVE_BYTES = 768_000;
export const MAX_HISTORY = 25;
const MAX_GOLD = 1e12;
const MAX_COUNT = 1e12;

export type RunOutcome = "won" | "died" | "abandoned";
export interface RunRecord {
  runId: string;
  hunter: CharacterId;
  outcome: RunOutcome;
  time: number;
  kills: number;
  gold: number;
  level: number;
  damageDealt: number;
  finaleTime: number;
  metrics: RunStats["metrics"];
  weapons: string[];
  build: string[];
  evolutions: string[];
  cause: string;
  finishedAt: number;
}
export interface HunterMastery { runs: number; wins: number; kills: number; bestTime: number; bestLevel: number }
export interface RunSnapshot { version: 1; runId: string; savedAt: number; state: unknown }
export interface RewardLedger {
  runId: string;
  hunter: CharacterId;
  creditedGold: number;
  settled: boolean;
  startedAt: number;
  latestStats: RunStats;
}
export interface ProfileSave extends MetaSave {
  version: 2;
  revision: number;
  settings: GameSettings;
  paidCosts: Record<string, number[]>;
  rewardLedger: RewardLedger | null;
  history: RunRecord[];
  mastery: Record<CharacterId, HunterMastery>;
  discoveries: { weapons: string[]; evolutions: string[]; enemies: string[] };
  achievements: string[];
  activeRun: RunSnapshot | null;
}
export const ACHIEVEMENTS = [
  { id: "first_hunt", name: "Into the Night", description: "Finish your first hunt.", icon: "🌙" },
  { id: "first_dawn", name: "Dawn Reclaimed", description: "Defeat Death for the first time.", icon: "🌅" },
  { id: "survivor", name: "Unbroken", description: "Survive fifteen minutes in one hunt.", icon: "🛡️" },
  { id: "thousand_slain", name: "Night Hunter", description: "Defeat 1,000 foes across your hunts.", icon: "⚔️" },
  { id: "first_evolution", name: "Awakened", description: "Evolve a weapon.", icon: "⭐" },
  { id: "four_hunters", name: "The Gathering", description: "Finish a hunt with every hunter.", icon: "🕯️" },
  { id: "four_dawns", name: "Keepers of Dawn", description: "Win with every hunter.", icon: "🏆" },
  { id: "all_evolutions", name: "Forbidden Arsenal", description: "Discover every weapon evolution.", icon: "📖" },
] as const;

export class SaveDataError extends Error { constructor(message: string, readonly reason: "invalid" | "future" = "invalid") { super(message); this.name = "SaveDataError"; } }
export class SaveConflictError extends Error { constructor() { super("Progress changed in another session. Reload your saved progress before continuing to save."); this.name = "SaveConflictError"; } }
const object = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const validId = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9_.:-]{1,160}$/.test(v);
const boundedNumber = (value: unknown, fallback: number, max: number, integer = false): number => {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) {
    throw new SaveDataError("Saved progress contains an invalid number. Your existing save has not been replaced.");
  }
  return value;
};
const emptyMastery = (): HunterMastery => ({ runs: 0, wins: 0, kills: 0, bestTime: 0, bestLevel: 0 });
const emptyStats = (): RunStats => ({
  time: 0, kills: 0, gold: 0, level: 1, damageDealt: 0, won: false,
  runId: "", character: "knight", abandoned: false, cause: "", finaleTime: 0, build: [],
  metrics: { damageByWeapon: {}, overkill: 0, damageTaken: 0, healing: 0, xpCollected: 0, goldBySource: {}, bossesDefeated: [], miniBossesDefeated: [], evolutions: [] },
});
const knownList = (value: unknown, keys: string[]): string[] => Array.isArray(value)
  ? [...new Set(value.filter((v): v is string => typeof v === "string" && keys.includes(v)))].slice(0, keys.length) : [];
const readableList = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((v): v is string => typeof v === "string").slice(0, 20).map((v) => v.slice(0, 160)) : [];

export function createDefaultProfile(): ProfileSave {
  return {
    version: PROFILE_VERSION, revision: 0, gold: 0, upgrades: {}, bestTime: 0, totalKills: 0, wins: 0, runs: 0, muted: false,
    settings: initialSettings(), paidCosts: {}, rewardLedger: null, history: [], activeRun: null,
    mastery: { knight: emptyMastery(), ranger: emptyMastery(), mage: emptyMastery(), reaper: emptyMastery() },
    discoveries: { weapons: [], evolutions: [], enemies: [] }, achievements: [],
  };
}

function readStats(value: unknown): RunStats {
  if (!object(value)) return emptyStats();
  const defaults = emptyStats();
  const metrics = object(value.metrics) ? value.metrics : {};
  const amounts = (data: unknown): Record<string, number> => {
    if (!object(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([key]) => validId(key)).slice(0, 32).map(([key, amount]) => [key, boundedNumber(amount, 0, 1e15)]));
  };
  return {
    ...defaults,
    time: boundedNumber(value.time, 0, 86400), kills: boundedNumber(value.kills, 0, MAX_COUNT, true),
    gold: boundedNumber(value.gold, 0, MAX_GOLD), level: boundedNumber(value.level, 1, 1e6, true),
    damageDealt: boundedNumber(value.damageDealt, 0, 1e15), won: value.won === true,
    runId: validId(value.runId) ? value.runId : "", character: isHunter(value.character) ? value.character : "knight",
    abandoned: value.abandoned === true, cause: typeof value.cause === "string" ? value.cause.slice(0, 160) : "",
    finaleTime: boundedNumber(value.finaleTime, 0, 86400), build: readableList(value.build),
    weaponIds: knownList(value.weaponIds, Object.keys(WEAPONS)) as RunStats["weaponIds"],
    metrics: { damageByWeapon: amounts(metrics.damageByWeapon), goldBySource: amounts(metrics.goldBySource),
      overkill: boundedNumber(metrics.overkill, 0, 1e15), damageTaken: boundedNumber(metrics.damageTaken, 0, 1e15),
      healing: boundedNumber(metrics.healing, 0, 1e15), xpCollected: boundedNumber(metrics.xpCollected, 0, 1e15),
      bossesDefeated: knownList(metrics.bossesDefeated, BOSSES.map(b => b.id)),
      miniBossesDefeated: knownList(metrics.miniBossesDefeated, MINI_BOSSES.map(b => b.id)),
      evolutions: knownList(metrics.evolutions, Object.keys(WEAPONS)),
    },
  };
}

/** Validate opaque run state structurally here; the engine must validate semantics before restoring. */
function validSnapshot(value: unknown, ledger: RewardLedger | null): RunSnapshot | null {
  if (!object(value) || value.version !== 1 || !validId(value.runId) || !ledger || ledger.settled || value.runId !== ledger.runId || !object(value.state)) return null;
  if (value.state.runId !== undefined && value.state.runId !== value.runId) return null;
  if (value.state.charId !== undefined && value.state.charId !== ledger.hunter) return null;
  const safe = (node: unknown, depth: number): boolean => {
    if (depth > 40) return false;
    if (node === null || typeof node === "boolean" || typeof node === "string") return true;
    if (typeof node === "number") return Number.isFinite(node);
    if (Array.isArray(node)) return node.length <= 20000 && node.every((v) => safe(v, depth + 1));
    if (object(node)) return Object.keys(node).length <= 1000 && Object.entries(node).every(([key, v]) => !["__proto__", "constructor", "prototype"].includes(key) && safe(v, depth + 1));
    return false;
  };
  if (!safe(value.state, 0) || bytes(JSON.stringify(value.state)) > 640_000) return null;
  // An incompatible run must never prevent recovery of valid permanent progress.
  if (typeof value.savedAt !== "number" || !Number.isSafeInteger(value.savedAt) || value.savedAt < 0) return null;
  return { version: 1, runId: value.runId, savedAt: value.savedAt, state: value.state };
}

/** Missing optional fields migrate safely; invalid currency/ranks fail closed rather than erase progress. */
export function parseProfile(raw: string): ProfileSave {
  if (bytes(raw) > MAX_SAVE_BYTES) throw new SaveDataError("Saved progress is too large to load safely.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new SaveDataError("Saved progress could not be read. Your existing save has not been replaced."); }
  if (!object(value)) throw new SaveDataError("Saved progress has an unsupported format.");
  if (value.version !== undefined && value.version !== 1 && value.version !== PROFILE_VERSION) throw new SaveDataError("This save was made by a different game version. Update the game before loading it.", "future");
  if (value.upgrades !== undefined && !object(value.upgrades)) throw new SaveDataError("Saved upgrades could not be read. Your existing save has not been replaced.");
  const profile = createDefaultProfile();
  profile.revision = boundedNumber(value.revision, 0, Number.MAX_SAFE_INTEGER - 1, true);
  profile.gold = boundedNumber(value.gold, 0, MAX_GOLD);
  profile.bestTime = boundedNumber(value.bestTime, 0, 86400);
  profile.totalKills = boundedNumber(value.totalKills, 0, MAX_COUNT, true);
  profile.wins = boundedNumber(value.wins, 0, MAX_COUNT, true);
  profile.runs = boundedNumber(value.runs, 0, MAX_COUNT, true);
  profile.muted = value.muted === true;
  profile.settings = normalizeSettings(value.settings, profile.settings);
  const ranks = object(value.upgrades) ? value.upgrades : {};
  const costs = object(value.paidCosts) ? value.paidCosts : {};
  for (const def of META_UPGRADES) {
    const rank = boundedNumber(ranks[def.id], 0, def.maxLevel, true);
    if (!rank) continue;
    profile.upgrades[def.id] = rank;
    const paid = costs[def.id];
    if (value.version === PROFILE_VERSION && paid === undefined) throw new SaveDataError("Saved purchase history is missing. Your existing save has not been replaced.");
    if (paid !== undefined && (!Array.isArray(paid) || paid.length !== rank)) throw new SaveDataError("Saved purchase history is inconsistent. Your existing save has not been replaced.");
    // Legacy prices are precisely known; preserve paid value before future balance changes.
    profile.paidCosts[def.id] = Array.from({ length: rank }, (_, i) => boundedNumber(Array.isArray(paid) ? paid[i] : undefined, legacyCost(def.id, i), MAX_GOLD));
  }
  if (object(value.mastery)) for (const hunter of ["knight", "ranger", "mage", "reaper"] as const) {
    const m = value.mastery[hunter];
    if (!object(m)) continue;
    profile.mastery[hunter] = {
      runs: boundedNumber(m.runs, 0, MAX_COUNT, true), wins: boundedNumber(m.wins, 0, MAX_COUNT, true),
      kills: boundedNumber(m.kills, 0, MAX_COUNT, true), bestTime: boundedNumber(m.bestTime, 0, 86400), bestLevel: boundedNumber(m.bestLevel, 0, 1e6, true),
    };
  }
  if (object(value.discoveries)) profile.discoveries = {
    weapons: knownList(value.discoveries.weapons, Object.keys(WEAPONS)),
    evolutions: knownList(value.discoveries.evolutions, Object.keys(WEAPONS)),
    enemies: knownList(value.discoveries.enemies, Object.keys(ENEMIES)),
  };
  profile.achievements = knownList(value.achievements, ACHIEVEMENTS.map((a) => a.id));
  if (Array.isArray(value.history)) profile.history = value.history.slice(0, MAX_HISTORY).flatMap((r) => {
    if (!object(r) || !validId(r.runId) || !isHunter(r.hunter) || !["won", "died", "abandoned"].includes(String(r.outcome))) return [];
    return [{ ...readStats(r), runId: r.runId, hunter: r.hunter, outcome: r.outcome as RunOutcome,
      weapons: knownList(r.weapons, Object.keys(WEAPONS)), build: readableList(r.build), evolutions: knownList(r.evolutions, Object.keys(WEAPONS)),
      cause: typeof r.cause === "string" ? r.cause.slice(0, 160) : "", finishedAt: boundedNumber(r.finishedAt, 0, Number.MAX_SAFE_INTEGER) }];
  });
  if (value.rewardLedger !== undefined && value.rewardLedger !== null) {
    const r = value.rewardLedger;
    if (!object(r) || !validId(r.runId) || !isHunter(r.hunter) || typeof r.settled !== "boolean") throw new SaveDataError("Saved reward progress could not be read. Your existing save has not been replaced.");
    profile.rewardLedger = { runId: r.runId, hunter: r.hunter, settled: r.settled, creditedGold: boundedNumber(r.creditedGold, 0, MAX_GOLD), startedAt: boundedNumber(r.startedAt, 0, Number.MAX_SAFE_INTEGER), latestStats: readStats(r.latestStats) };
  }
  profile.activeRun = validSnapshot(value.activeRun, profile.rewardLedger);
  return unlockAchievements(profile);
}

// Frozen original price table is part of migration, independent of future shop tuning.
const LEGACY_PRICES: Record<string, [number, number]> = {
  might: [150, 1.9], vitality: [120, 1.9], swiftness: [130, 1.9], haste: [180, 1.9], magnetism: [90, 1.8],
  fortune: [140, 1.9], greed: [110, 1.9], growth: [160, 1.9], armor: [200, 2.2], revival: [600, 3],
};
function legacyCost(id: string, rank: number) { const p = LEGACY_PRICES[id]; return p ? Math.round(p[0] * p[1] ** rank) : 0; }
function changed(profile: ProfileSave, fields: Partial<ProfileSave>): ProfileSave { return { ...profile, ...fields, version: PROFILE_VERSION, revision: profile.revision + 1 }; }

export function updateSettings(profile: ProfileSave, patch: Partial<GameSettings>): ProfileSave {
  return changed(profile, { settings: normalizeSettings({ ...profile.settings, ...patch }) });
}
export function setProfileMuted(profile: ProfileSave, muted: boolean): ProfileSave { return changed(profile, { muted }); }

export function purchaseUpgrade(profile: ProfileSave, id: string): { profile: ProfileSave; ok: boolean; error?: string } {
  const def = META_UPGRADES.find((u) => u.id === id);
  if (!def) return { profile, ok: false, error: "Unknown Power-Up." };
  const rank = profile.upgrades[id] ?? 0;
  if (rank >= def.maxLevel) return { profile, ok: false, error: "This Power-Up is already complete." };
  const cost = metaUpgradeCost(def, rank);
  if (profile.gold < cost) return { profile, ok: false, error: "Not enough gold." };
  return { ok: true, profile: changed(profile, {
    gold: profile.gold - cost, upgrades: { ...profile.upgrades, [id]: rank + 1 },
    paidCosts: { ...profile.paidCosts, [id]: [...(profile.paidCosts[id] ?? []), cost] },
  }) };
}
export function refundUpgrades(profile: ProfileSave): { profile: ProfileSave; refunded: number } {
  if (profile.rewardLedger && !profile.rewardLedger.settled) return { profile, refunded: 0 };
  const refunded = Object.values(profile.paidCosts).reduce((sum, costs) => sum + costs.reduce((s, cost) => s + cost, 0), 0);
  return { profile: refunded ? changed(profile, { gold: Math.min(MAX_GOLD, profile.gold + refunded), upgrades: {}, paidCosts: {} }) : profile, refunded };
}

export function beginRun(profile: ProfileSave, runId: string, hunter: CharacterId): ProfileSave {
  if (!validId(runId) || !isHunter(hunter)) throw new Error("A valid new run identity is required.");
  if (profile.rewardLedger?.runId === runId || profile.history.some((r) => r.runId === runId)) return profile;
  let next = profile;
  if (next.rewardLedger && !next.rewardLedger.settled) next = settleRun(next, next.rewardLedger.runId, next.rewardLedger.latestStats, { outcome: "abandoned", cause: "Run interrupted" });
  return changed(next, {
    rewardLedger: { runId, hunter, creditedGold: 0, settled: false, startedAt: Date.now(), latestStats: emptyStats() },
    activeRun: null, settings: { ...next.settings, lastHunter: hunter },
  });
}

/** totalGold is cumulative earned currency, not an increment. Preserve sub-coin precision. */
export function checkpointRun(profile: ProfileSave, runId: string, totalGold: number, stats?: Partial<RunStats>): ProfileSave {
  const ledger = profile.rewardLedger;
  if (!ledger || ledger.runId !== runId || ledger.settled) return profile;
  boundedNumber(totalGold, 0, MAX_GOLD);
  const creditedGold = Math.max(totalGold, ledger.creditedGold);
  const latestStats = stats ? readStats({ ...ledger.latestStats, ...stats, gold: creditedGold }) : { ...ledger.latestStats, gold: creditedGold };
  // A delayed checkpoint cannot move cumulative counters backwards.
  for (const key of ["time", "kills", "level", "damageDealt", "finaleTime"] as const) latestStats[key] = Math.max(latestStats[key], ledger.latestStats[key]);
  latestStats.runId = runId;
  latestStats.character = ledger.hunter;
  if (creditedGold === ledger.creditedGold && JSON.stringify(latestStats) === JSON.stringify(ledger.latestStats)) return profile;
  return changed(profile, { gold: Math.min(MAX_GOLD, profile.gold + creditedGold - ledger.creditedGold), rewardLedger: { ...ledger, creditedGold, latestStats } });
}

export interface SettlementDetails { hunter?: CharacterId; outcome?: RunOutcome; weapons?: string[]; evolutions?: string[]; enemies?: string[]; cause?: string }
export function settleRun(profile: ProfileSave, runId: string, stats: RunStats, details: SettlementDetails = {}): ProfileSave {
  const ledger = profile.rewardLedger;
  if (!ledger || ledger.runId !== runId || ledger.settled) return profile;
  const finalStats = readStats(stats);
  const checkpoint = checkpointRun(profile, runId, finalStats.gold, finalStats);
  const checked = checkpoint.rewardLedger!.latestStats;
  const outcome = details.outcome ?? (checked.won ? "won" : checked.abandoned ? "abandoned" : "died");
  const hunter = ledger.hunter;
  const won = outcome === "won";
  const weapons = knownList(details.weapons ?? (checked.weaponIds?.length ? checked.weaponIds : checked.build), Object.keys(WEAPONS));
  const evolutions = knownList(details.evolutions ?? checked.metrics.evolutions, Object.keys(WEAPONS));
  const prior = checkpoint.mastery[hunter];
  const result: RunRecord = { ...checked, runId, hunter, outcome, gold: checkpoint.rewardLedger!.creditedGold,
    weapons, build: checked.build, evolutions, cause: (details.cause ?? checked.cause).slice(0, 160), finishedAt: Date.now() };
  return unlockAchievements(changed(checkpoint, {
    bestTime: Math.max(checkpoint.bestTime, checked.time), totalKills: Math.min(MAX_COUNT, checkpoint.totalKills + checked.kills),
    wins: checkpoint.wins + Number(won), runs: checkpoint.runs + 1,
    mastery: { ...checkpoint.mastery, [hunter]: { runs: prior.runs + 1, wins: prior.wins + Number(won), kills: prior.kills + checked.kills, bestTime: Math.max(prior.bestTime, checked.time), bestLevel: Math.max(prior.bestLevel, checked.level) } },
    discoveries: { weapons: knownList([...checkpoint.discoveries.weapons, ...weapons], Object.keys(WEAPONS)), evolutions: knownList([...checkpoint.discoveries.evolutions, ...evolutions], Object.keys(WEAPONS)), enemies: knownList([...checkpoint.discoveries.enemies, ...(details.enemies ?? [])], Object.keys(ENEMIES)) },
    rewardLedger: { ...checkpoint.rewardLedger!, settled: true }, activeRun: null,
    history: [result, ...checkpoint.history].slice(0, MAX_HISTORY),
  }));
}

function unlockAchievements(profile: ProfileSave): ProfileSave {
  const earned = new Set(profile.achievements);
  if (profile.runs > 0) earned.add("first_hunt");
  if (profile.wins > 0) earned.add("first_dawn");
  if (profile.bestTime >= 900) earned.add("survivor");
  if (profile.totalKills >= 1000) earned.add("thousand_slain");
  if (profile.discoveries.evolutions.length) earned.add("first_evolution");
  if (Object.values(profile.mastery).every((m) => m.runs > 0)) earned.add("four_hunters");
  if (Object.values(profile.mastery).every((m) => m.wins > 0)) earned.add("four_dawns");
  if (profile.discoveries.evolutions.length === Object.keys(WEAPONS).length) earned.add("all_evolutions");
  return { ...profile, achievements: [...earned] };
}

export function withRunSnapshot(profile: ProfileSave, runId: string, state: unknown): ProfileSave {
  if (profile.rewardLedger?.runId !== runId || profile.rewardLedger.settled) return profile;
  const activeRun = validSnapshot({ version: 1, runId, savedAt: Date.now(), state }, profile.rewardLedger);
  if (!activeRun) throw new SaveDataError("This run could not be saved for resume. Earned permanent rewards are still retained.");
  // Detach from mutable engine arrays before asynchronous persistence.
  return changed(profile, { activeRun: JSON.parse(JSON.stringify(activeRun)) as RunSnapshot });
}
export function clearRunSnapshot(profile: ProfileSave): ProfileSave { return profile.activeRun ? changed(profile, { activeRun: null }) : profile; }

export function statsWithMeta(save: MetaSave): PlayerStats {
  const stats: PlayerStats = { ...BASE_STATS };
  for (const def of META_UPGRADES) {
    const rank = save.upgrades && Object.hasOwn(save.upgrades, def.id) ? save.upgrades[def.id] : undefined;
    const level = typeof rank === "number" && Number.isFinite(rank) ? Math.max(0, Math.min(def.maxLevel, Math.floor(rank))) : 0;
    if (level > 0) def.apply(stats, level);
  }
  return stats;
}

export interface ProfileStorage { loadData(): Promise<string | null>; saveData(data: string, options?: { preserveBackup?: boolean; pauseCheckpoint?: boolean }): Promise<void>; loadBackup?(): Promise<string | null> }
export interface ProfileLoadResult { status: "ready" | "error"; profile: ProfileSave | null; isNew: boolean; error?: string; backup?: ProfileSave; warning?: string }
export type PersistenceStatus = "unloaded" | "loading" | "ready" | "error" | "conflict";

/** One active writer. Detect external changes; never silently merge currency or overwrite unread saves. */
export function createProfileRepository(storage: ProfileStorage) {
  let status: PersistenceStatus = "unloaded";
  let loading: Promise<ProfileLoadResult> | null = null;
  let queue: Promise<void> = Promise.resolve();
  let lastRaw: string | null = null;
  let current: ProfileSave | null = null;
  let highestRevision = -1;
  let highestRaw: string | null = null;
  let failedRaw: string | null | undefined;
  let availableBackup: ProfileSave | undefined;
  type WriteRequest = { raw: string; waiters: { resolve: () => void; reject: (error: unknown) => void }[] };
  let pending: WriteRequest | null = null;
  let draining = false;
  let lastWriteError: unknown = null;
  // A rejected network promise may have committed its payload before losing the acknowledgement.
  let uncertainRaw: string | null = null;

  const load = (): Promise<ProfileLoadResult> => {
    if (loading) return loading;
    if (status === "loading") return Promise.resolve({ status: "error", profile: null, isNew: false, error: "Recovery is in progress. Please wait." });
    if (status === "ready" && current) {
      // Remounts must see the latest committed revision, not the profile from before an in-flight checkpoint.
      if (draining) return queue.then(() => load());
      return Promise.resolve({ status: "ready", profile: current, isNew: lastRaw === null });
    }
    status = "loading";
    failedRaw = undefined;
    availableBackup = undefined;
    loading = (async (): Promise<ProfileLoadResult> => {
      try {
        await queue.catch(() => undefined);
        const raw = await storage.loadData();
        failedRaw = raw;
        const profile = raw === null ? createDefaultProfile() : parseProfile(raw);
        lastRaw = raw; current = profile; highestRevision = profile.revision; highestRaw = JSON.stringify(profile); status = "ready"; lastWriteError = null; uncertainRaw = null;
        failedRaw = undefined;
        const discardedSnapshot = raw !== null && Boolean((JSON.parse(raw) as Record<string, unknown>).activeRun) && !profile.activeRun;
        return { status: "ready", profile, isNew: raw === null, ...(discardedSnapshot ? { warning: "The previous run cannot be resumed in this version. Your earned gold and permanent progress are safe." } : {}) };
      } catch (error) {
        status = "error";
        let backup: ProfileSave | undefined;
        if (failedRaw !== undefined && !(error instanceof SaveDataError && error.reason === "future")) {
          try { const raw = await storage.loadBackup?.(); if (raw) backup = parseProfile(raw); } catch { /* Corrupt backups must not replace the original. */ }
        }
        availableBackup = backup;
        return { status: "error", profile: null, isNew: false, error: error instanceof Error ? error.message : "Saved progress is unavailable. Please retry.", ...(backup ? { backup } : {}) };
      } finally { loading = null; }
    })();
    return loading;
  };

  /** Call only after a deliberate recovery action; failed reads can never authorize replacement. */
  const recoverBackup = async (): Promise<ProfileLoadResult> => {
    if (status !== "error" || !availableBackup || failedRaw === undefined) {
      return { status: "error", profile: null, isNew: false, error: "A readable backup is not available. Retry loading your existing progress." };
    }
    const expected = failedRaw;
    const restored = changed(availableBackup, {});
    const raw = JSON.stringify(restored);
    status = "loading";
    try {
      await queue;
      const existing = await storage.loadData();
      if (existing !== expected) throw new SaveConflictError();
      await storage.saveData(raw, { preserveBackup: true });
      lastRaw = raw; current = restored; highestRevision = restored.revision; highestRaw = raw;
      status = "ready"; failedRaw = undefined; availableBackup = undefined; lastWriteError = null; uncertainRaw = null;
      return { status: "ready", profile: restored, isNew: false };
    } catch (error) {
      status = "error";
      return { status: "error", profile: null, isNew: false, backup: availableBackup, error: error instanceof Error ? error.message : "The backup could not be restored. Please retry." };
    }
  };

  const prepareWrite = (profile: ProfileSave): string => {
    if (status === "conflict") throw new SaveConflictError();
    if (status !== "ready") throw new SaveDataError("Progress must load successfully before it can be saved.");
    const raw = JSON.stringify(profile);
    parseProfile(raw);
    if (profile.revision < highestRevision || (profile.revision === highestRevision && highestRaw !== raw)) throw new SaveConflictError();
    highestRevision = profile.revision; highestRaw = raw;
    return raw;
  };

  const drainPending = async () => {
    try {
      while (pending) {
        const request = pending;
        pending = null;
        try {
          if (status === "conflict") throw new SaveConflictError();
          if (status !== "ready") throw new SaveDataError("Progress must load successfully before it can be saved.");
          const remote = await storage.loadData();
          if (status !== "ready") throw new SaveDataError("Saving was interrupted by a progress reload.");
          // Only our last acknowledged or exact attempted payload may precede a newer queued revision.
          if (remote !== lastRaw && remote !== request.raw && (uncertainRaw === null || remote !== uncertainRaw)) { status = "conflict"; throw new SaveConflictError(); }
          if (remote !== null && remote === uncertainRaw) { lastRaw = remote; current = parseProfile(remote); }
          if (remote !== request.raw) { uncertainRaw = request.raw; await storage.saveData(request.raw); }
          lastRaw = request.raw; current = parseProfile(request.raw); lastWriteError = null; uncertainRaw = null;
          for (const waiter of request.waiters) waiter.resolve();
        } catch (error) {
          if (error instanceof Error && error.name === "SaveConflictError") status = "conflict";
          lastWriteError = error;
          for (const waiter of request.waiters) waiter.reject(error);
        }
      }
    } finally { draining = false; }
  };

  const save = (profile: ProfileSave): Promise<void> => {
    let raw: string;
    try { raw = prepareWrite(profile); } catch (error) { return Promise.reject(error); }
    const result = new Promise<void>((resolve, reject) => {
      // Keep at most one not-yet-started write. Each newer profile includes all earlier domain operations.
      if (pending) { pending.raw = raw; pending.waiters.push({ resolve, reject }); }
      else pending = { raw, waiters: [{ resolve, reject }] };
    });
    if (!draining) {
      draining = true;
      queue = queue.then(drainPending);
    }
    return result;
  };

  /** One explicit checkpoint at the pause boundary; ordinary queued work waits for platform resume. */
  const saveOnPause = (profile: ProfileSave): Promise<void> => {
    if (draining) return save(profile);
    let raw: string;
    try { raw = prepareWrite(profile); } catch (error) { return Promise.reject(error); }
    draining = true;
    let write: Promise<void>;
    // Invoke synchronously in the pause callback, without another load or overlapping an earlier write.
    uncertainRaw = raw;
    try { write = storage.saveData(raw, { pauseCheckpoint: true }); } catch (error) { write = Promise.reject(error); }
    const result = write.then(() => { lastRaw = raw; current = parseProfile(raw); lastWriteError = null; uncertainRaw = null; }, (error: unknown) => {
      lastWriteError = error;
      if (error instanceof Error && error.name === "SaveConflictError") status = "conflict";
      throw error;
    });
    queue = result.catch(() => undefined).then(drainPending);
    return result;
  };
  return { load, save, saveOnPause, recoverBackup, getStatus: () => status, flush: () => queue.then(() => { if (lastWriteError) throw lastWriteError; }) };
}

const repository = createProfileRepository(platform);
export const loadProfile = repository.load;
export const saveProfile = repository.save;
export const saveProfileOnPause = repository.saveOnPause;
export const recoverProfileBackup = repository.recoverBackup;
export const flushProfileWrites = repository.flush;
export const getPersistenceStatus = repository.getStatus;
