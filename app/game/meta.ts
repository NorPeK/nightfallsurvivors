import type { MetaSave, PlayerStats } from "./types";
import { BASE_STATS, META_UPGRADES } from "./data";

const KEY = "norpek-nightfall-save-v1";

export function loadSave(): MetaSave {
  if (typeof window === "undefined") return defaultSave();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: MetaSave) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage unavailable (private mode etc.) — play without persistence
  }
}

function defaultSave(): MetaSave {
  return {
    gold: 0,
    upgrades: {},
    bestTime: 0,
    totalKills: 0,
    wins: 0,
    runs: 0,
    muted: false,
  };
}

/** Base stats + permanent meta upgrades applied. */
export function statsWithMeta(save: MetaSave): PlayerStats {
  const stats: PlayerStats = { ...BASE_STATS };
  for (const def of META_UPGRADES) {
    const lvl = save.upgrades[def.id] ?? 0;
    if (lvl > 0) def.apply(stats, lvl);
  }
  return stats;
}
