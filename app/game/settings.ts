import type { CharacterId } from "./types";

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  reducedMotion: boolean;
  screenShake: boolean;
  screenFlash: boolean;
  effectsIntensity: "full" | "reduced";
  damageNumbers: "all" | "critical" | "off";
  highContrast: boolean;
  joystickSide: "left" | "right";
  joystickMode: "floating" | "fixed";
  onboardingComplete: boolean;
  lastHunter: CharacterId;
}

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  musicVolume: 0.65, sfxVolume: 0.8, reducedMotion: false, screenShake: true, screenFlash: true,
  effectsIntensity: "full", damageNumbers: "all", highContrast: false,
  joystickSide: "left", joystickMode: "floating", onboardingComplete: false, lastHunter: "knight",
});

export function isHunter(value: unknown): value is CharacterId {
  return value === "knight" || value === "ranger" || value === "mage" || value === "reaper";
}

/** Preferences can recover independently of currency: unknown values use safe defaults. */
export function normalizeSettings(value: unknown, defaults: GameSettings = { ...DEFAULT_SETTINGS }): GameSettings {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const volume = (key: "musicVolume" | "sfxVolume") => typeof source[key] === "number" && Number.isFinite(source[key])
    ? Math.max(0, Math.min(1, source[key] as number)) : defaults[key];
  const bool = (key: keyof GameSettings) => typeof source[key] === "boolean" ? source[key] as boolean : defaults[key] as boolean;
  return {
    musicVolume: volume("musicVolume"), sfxVolume: volume("sfxVolume"),
    reducedMotion: bool("reducedMotion"), screenShake: bool("screenShake"), screenFlash: bool("screenFlash"),
    effectsIntensity: source.effectsIntensity === "reduced" || source.effectsIntensity === "full" ? source.effectsIntensity : defaults.effectsIntensity,
    damageNumbers: source.damageNumbers === "off" || source.damageNumbers === "critical" || source.damageNumbers === "all" ? source.damageNumbers : defaults.damageNumbers,
    highContrast: bool("highContrast"),
    joystickSide: source.joystickSide === "right" || source.joystickSide === "left" ? source.joystickSide : defaults.joystickSide,
    joystickMode: source.joystickMode === "fixed" || source.joystickMode === "floating" ? source.joystickMode : defaults.joystickMode,
    onboardingComplete: bool("onboardingComplete"), lastHunter: isHunter(source.lastHunter) ? source.lastHunter : defaults.lastHunter,
  };
}

export function initialSettings(): GameSettings {
  const reducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { ...DEFAULT_SETTINGS, reducedMotion, screenShake: !reducedMotion, screenFlash: !reducedMotion, effectsIntensity: reducedMotion ? "reduced" : "full" };
}
