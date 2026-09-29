"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Game } from "../game/engine";
import { renderGame, combatViewport } from "../game/render";
import { Input } from "../game/input";
import { audio } from "../game/audio";
import { platform } from "../game/platform";
import { loadProfile, saveProfile, saveProfileOnPause, createDefaultProfile, statsWithMeta, updateSettings, purchaseUpgrade, refundUpgrades, beginRun, checkpointRun, settleRun, withRunSnapshot, setProfileMuted, recoverProfileBackup, ACHIEVEMENTS, type ProfileSave } from "../game/meta";
import { DEFAULT_SETTINGS, type GameSettings } from "../game/settings";
import { CHARACTERS, WEAPONS, PASSIVES, META_UPGRADES, metaUpgradeCost, BASE_STATS, BOSSES, MINI_BOSSES } from "../game/data";
import type { CharacterId, GamePhase, HudState, UpgradeOption, ChestReward, RunStats, CovenantOption, RunPhase } from "../game/types";

const fmtTime = (t: number) => `${Math.floor(t / 60).toString().padStart(2, "0")}:${Math.floor(t % 60).toString().padStart(2, "0")}`;
const gold = (n: number) => Math.floor(n).toLocaleString();
const HUNTER_ROLES: Record<CharacterId, { role: string; sigil: string }> = {
  knight: { role: "Enduring guardian", sigil: "♜" }, ranger: { role: "Mobile marksman", sigil: "➶" },
  mage: { role: "Arcane controller", sigil: "✧" }, reaper: { role: "Close-range reaper", sigil: "☾" },
};
const BOSS_TIPS: Record<string, string> = {
  colossus: "Leave the marked slam circle and keep an escape route through summoned skeletons.",
  bloodwarden: "Step out of the marked charge lane, then dodge the aimed five-bolt fan.",
  lich: "Find the gaps in radial volleys and watch the marked teleport destination.",
  dreadknight: "Evade the committed charge and keep moving through three staggered ground slams.",
  voidseer: "Find the gaps in the warned radial volley and leave the three marked slam circles.",
  death: "Evade the locked rush and spiral barrage. Defeat Death to reclaim the dawn.",
};
type Panel = "settings" | "journal" | "build" | "end-run" | "refund" | "run-error" | "end-saved" | "reload-save" | null;
type QaMetrics = { samples: number; frames: number; fps: number; p50: number; p95: number; p99: number; width: number; height: number; dpr: number; enemies: number; projectiles: number; pickups: number; particles: number; effects: number };

export default function GameRoot() {
  const canvasRef = useRef<HTMLCanvasElement>(null), wrapRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null), saveErrorRef = useRef<HTMLElement>(null);
  const gameRef = useRef<Game | null>(null), inputRef = useRef<Input | null>(null);
  const profileRef = useRef<ProfileSave | null>(null);
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS);
  const phaseRef = useRef<GamePhase>("menu"), panelRef = useRef<Panel>(null);
  const suspendedRef = useRef(false);
  const wakeCanvasRef = useRef<() => void>(() => {});
  const qaRef = useRef(false);
  const resetQaMetricsRef = useRef<() => void>(() => {});
  const [qaMetrics, setQaMetrics] = useState<QaMetrics | null>(null);
  const [qaMode, setQaMode] = useState(false);
  const [profile, setProfile] = useState<ProfileSave | null>(null);
  const [loadError, setLoadError] = useState("");
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [backupAvailable, setBackupAvailable] = useState(false);
  const [runError, setRunError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveConflict, setSaveConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [panel, setPanelState] = useState<Panel>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [options, setOptions] = useState<UpgradeOption[]>([]);
  const [rewards, setRewards] = useState<ChestReward[]>([]);
  const [covenants, setCovenants] = useState<CovenantOption[]>([]);
  const [result, setResult] = useState<RunStats | null>(null);
  const [selected, setSelected] = useState<CharacterId>("knight");
  const [notice, setNotice] = useState("");
  const [bossWarning, setBossWarning] = useState("");
  const [suspended, setSuspended] = useState(false);
  const [inputDevice, setInputDevice] = useState<"keyboard" | "pointer">("keyboard");
  const settings = profile?.settings ?? DEFAULT_SETTINGS;
  const hasProfile = Boolean(profile), bossActive = Boolean(hud?.boss);

  const persist = useCallback((next: ProfileSave, options?: { pauseCheckpoint: boolean }) => {
    profileRef.current = next; settingsRef.current = next.settings; setProfile(next);
    if (qaRef.current) { setSaving(false); return; }
    setSaving(true);
    void (options?.pauseCheckpoint ? saveProfileOnPause(next) : saveProfile(next)).then(() => { if (profileRef.current?.revision === next.revision) { setSaveError(""); setSaveConflict(false); } }).catch((error: unknown) => {
      if (profileRef.current?.revision !== next.revision) return;
      setSaveError(error instanceof Error ? error.message : "Progress could not be saved.");
      setSaveConflict(current => current || (error instanceof Error && error.name === "SaveConflictError"));
    }).finally(() => { if (profileRef.current?.revision === next.revision) setSaving(false); });
  }, []);
  const changeSettings = useCallback((patch: Partial<GameSettings>) => {
    const p = profileRef.current; if (p) persist(updateSettings(p, patch));
  }, [persist]);
  const setPanel = useCallback((next: Panel) => { panelRef.current = next; setPanelState(next); inputRef.current?.reset(); }, []);
  const changePhase = useCallback((next: GamePhase) => {
    phaseRef.current = next; setPhase(next); inputRef.current?.setEnabled(next === "playing" && !suspendedRef.current);
    wakeCanvasRef.current();
  }, []);
  const load = useCallback(async () => {
    if (qaRef.current) {
      const sandbox = createDefaultProfile(); sandbox.gold = 100000; sandbox.settings.onboardingComplete = true;
      profileRef.current = sandbox; settingsRef.current = sandbox.settings; setProfile(sandbox); setSelected("knight"); return;
    }
    const loaded = await loadProfile();
    setBackupAvailable(Boolean(loaded.backup));
    if (loaded.status !== "ready" || !loaded.profile) { setLoadError(loaded.error ?? "Your progress could not be loaded. Retry before playing."); return; }
    if (loaded.warning) setNotice(loaded.warning);
    const p = loaded.profile;
    profileRef.current = p; settingsRef.current = p.settings; setProfile(p); setSelected(p.settings.lastHunter);
  }, []);

  useEffect(() => {
    qaRef.current = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("debug") === "1";
    queueMicrotask(() => setQaMode(qaRef.current));
    try { platform.init(); } catch (error) { const message = error instanceof Error ? error.message : "The platform could not initialize. Check the connection and retry."; queueMicrotask(() => setLoadError(message)); return; }
    const input = new Input(); inputRef.current = input;
    input.escapePauses = !platform.isPlayables;
    input.setEnabled(false); if (wrapRef.current) input.attach(wrapRef.current);
    input.onDeviceChange = setInputDevice;
    let warningUntil = 0;
    let alive = true, raf = 0, lastSnapshotTime = -15, renderFault = false;
    const intervals: number[] = [];
    let qaFrame = 0, qaLastFrame = 0, qaNextPublish = 0;
    resetQaMetricsRef.current = () => { intervals.length = 0; qaFrame = 0; qaLastFrame = 0; qaNextPublish = 0; setQaMetrics(null); };
    const snapshot = (p: ProfileSave) => {
      const g = gameRef.current; if (!g || qaRef.current) return p;
      try { return withRunSnapshot(p, g.runId, g.exportSnapshot()); }
      catch { setNotice("Run checkpoint unavailable. Earned permanent rewards are still saved."); return p; }
    };
    const checkpoint = (stats: RunStats) => {
      const p = profileRef.current; if (!p) return;
      let next = checkpointRun(p, stats.runId, stats.gold, stats);
      const elapsed = gameRef.current?.time ?? stats.time;
      if (elapsed - lastSnapshotTime >= 15) { next = snapshot(next); lastSnapshotTime = elapsed; }
      if (next !== p) persist(next);
    };
    const game = new Game(input, {
      onPhaseChange: (next) => {
        changePhase(next);
        if (next === "paused" && profileRef.current) persist(snapshot(profileRef.current));
      }, onHud: (h) => { setHud(h); if (warningUntil && (gameRef.current?.time ?? 0) >= warningUntil) { setBossWarning(""); warningUntil = 0; } }, onLevelUp: setOptions, onChest: setRewards,
      onRunStart: (runId, hunter) => { renderFault = false; if (qaRef.current) resetQaMetricsRef.current(); setBossWarning(""); warningUntil = 0; lastSnapshotTime = -15; const p = profileRef.current; if (p) persist(beginRun(p, runId, hunter)); },
      onError: (message) => { platform.reportError(); setRunError(message); setPanel("run-error"); input.reset(); audio.setSuspended(true); },
      onEvolutionChoice: setOptions, onCovenant: setCovenants, onProgress: checkpoint,
      onRunEnd: (stats) => {
        setResult(stats); setPanel(null); audio.stopMusic();
        const p = profileRef.current;
        if (p) persist(settleRun(p, stats.runId, stats, { hunter: stats.character, outcome: stats.won ? "won" : stats.abandoned ? "abandoned" : "died", weapons: stats.weaponIds, evolutions: stats.metrics.evolutions, cause: stats.cause }));
      },
      onBossWarning: (name) => {
        setBossWarning(name); warningUntil = (gameRef.current?.time ?? 0) + 3.2;
      },
    });
    game.debug = qaRef.current;
    gameRef.current = game;
    input.onPause = () => {
      if (suspendedRef.current) return;
      if (panelRef.current === "run-error") return;
      if (panelRef.current) { setPanel(null); return; }
      if (phaseRef.current === "playing") game.pause();
      else if (phaseRef.current === "paused") game.resume();
    };
    const ctx = canvasRef.current?.getContext("2d");
    // Coalesce invalidations; frozen scenes need one repaint, not a second game loop.
    const wake = () => { if (alive && !suspendedRef.current && !raf) raf = requestAnimationFrame(draw); };
    const draw = (frameTime: number) => {
      raf = 0;
      if (!alive || suspendedRef.current) return;
      const canvas = canvasRef.current;
      if (canvas && ctx) {
        const width = wrapRef.current?.clientWidth ?? window.innerWidth, height = wrapRef.current?.clientHeight ?? window.innerHeight;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
          canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
          const viewport = combatViewport(width, height); game.setViewport(viewport.width, viewport.height);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const p = phaseRef.current;
        try {
          if (["menu", "characters", "shop", "howto"].includes(p)) {
            if (!renderFault) drawMenuBackdrop(ctx, width, height, settingsRef.current.reducedMotion ? 0 : performance.now() / 1000);
            else { ctx.fillStyle = "#090a12"; ctx.fillRect(0, 0, width, height); }
          }
          else if (!renderFault) renderGame(game, ctx, width, height, settingsRef.current);
        } catch {
          renderFault = true; platform.reportError();
          if (!["menu", "characters", "shop", "howto", "gameover", "victory"].includes(p)) {
            game.setSuspended("error", true); input.reset(); audio.setSuspended(true);
            setRunError("The battlefield could not be drawn. End this attempt to return safely."); setPanel("run-error");
          } else setNotice("The animated background is unavailable. Menus remain usable.");
        }
      }
      const p = phaseRef.current;
      const animate = p === "playing" ? !game.suspended : ["menu", "characters", "shop", "howto"].includes(p) && !settingsRef.current.reducedMotion;
      if (process.env.NODE_ENV !== "production" && qaRef.current) {
        if (p === "playing" && animate && !panelRef.current && !renderFault) {
          if (qaLastFrame) { intervals[qaFrame % 600] = frameTime - qaLastFrame; qaFrame++; }
          qaLastFrame = frameTime;
        } else qaLastFrame = 0;
        if (frameTime >= qaNextPublish || !animate) {
          const sorted = [...intervals].sort((a, b) => a - b);
          const percentile = (q: number) => sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)] ?? 0;
          const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
          const count = (pool: { active: boolean }[]) => pool.reduce((sum, item) => sum + Number(item.active), 0);
          setQaMetrics({ samples: intervals.length, frames: qaFrame, fps: average > 0 ? 1000 / average : 0, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), width: wrapRef.current?.clientWidth ?? 0, height: wrapRef.current?.clientHeight ?? 0, dpr: Math.min(2, window.devicePixelRatio || 1), enemies: count(game.enemies), projectiles: count(game.bullets) + count(game.enemyBullets), pickups: count(game.pickups), particles: count(game.particles), effects: game.fx.length });
          qaNextPublish = frameTime + 1000;
        }
      }
      if (!renderFault && !panelRef.current && animate) wake();
    };
    wakeCanvasRef.current = wake;
    const resizeObserver = new ResizeObserver(wake);
    if (wrapRef.current) resizeObserver.observe(wrapRef.current);
    window.addEventListener("resize", wake);
    const suspend = () => {
      suspendedRef.current = true; setSuspended(true); game.setSuspended("platform", true); input.reset(); audio.setSuspended(true); cancelAnimationFrame(raf);
      raf = 0;
      qaLastFrame = 0;
      // Reward checkpoints are emitted by the engine; snapshots are captured at the same suspension boundary.
      const p = profileRef.current;
      if (p && game.runId && !["menu", "characters", "shop", "howto", "gameover", "victory"].includes(phaseRef.current)) {
        persist(snapshot(checkpointRun(p, game.runId, game.hudSnapshot().gold)), { pauseCheckpoint: true });
      }
    };
    const resume = () => {
      suspendedRef.current = false; setSuspended(false); game.setSuspended("platform", false);
      input.setEnabled(phaseRef.current === "playing"); audio.setSuspended(phaseRef.current === "paused" || panelRef.current === "run-error");
      wake();
    };
    const unsubscribes = [platform.onPause(suspend), platform.onResume(resume), platform.onAudioChanged((enabled) => audio.setPlatformEnabled(enabled))];
    audio.setPlatformEnabled(platform.audioEnabled);
    if (platform.suspended) suspend(); else wake();
    let paintedFrame = 0;
    const readyFrame = requestAnimationFrame(() => { paintedFrame = requestAnimationFrame(() => { if (alive) platform.firstFrameReady(); }); });
    queueMicrotask(() => { if (alive) void load(); });
    return () => {
      alive = false; cancelAnimationFrame(raf); cancelAnimationFrame(readyFrame); cancelAnimationFrame(paintedFrame);
      wakeCanvasRef.current = () => {}; resizeObserver.disconnect(); window.removeEventListener("resize", wake);
      resetQaMetricsRef.current = () => {};
      unsubscribes.forEach((unsubscribe) => unsubscribe()); input.detach(); game.dispose(); audio.dispose();
    };
  }, [changePhase, load, persist, setPanel, startupAttempt]);

  useEffect(() => {
    settingsRef.current = settings;
    audio.setVolumes(settings.musicVolume, settings.sfxVolume);
    audio.setMuted(platform.isPlayables ? false : (profile?.muted ?? false));
    inputRef.current?.configure(settings.joystickMode, settings.joystickSide);
    wakeCanvasRef.current();
  }, [settings, profile?.muted]);
  useEffect(() => { wakeCanvasRef.current(); }, [phase, panel]);
  useEffect(() => {
    if (!suspended) return;
    const previous = document.activeElement as HTMLElement | null;
    curtainRef.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [suspended]);
  useEffect(() => {
    const banner = saveErrorRef.current, root = wrapRef.current;
    if (!banner || !root) return;
    const observer = new ResizeObserver(() => root.style.setProperty("--save-error-height", `${banner.getBoundingClientRect().height + 24}px`));
    observer.observe(banner);
    return () => observer.disconnect();
  }, [saveError]);
  useEffect(() => {
    audio.setSuspended(suspended || phase === "paused" || Boolean(runError));
    audio.setIntensity(phase === "victory" ? "dawn" : bossActive ? "boss" : phase === "menu" ? "menu" : "hunt");
  }, [phase, suspended, bossActive, runError]);
  useEffect(() => { if (hasProfile && gameRef.current) { let painted = 0; const id = requestAnimationFrame(() => { painted = requestAnimationFrame(() => platform.gameReady()); }); return () => { cancelAnimationFrame(id); cancelAnimationFrame(painted); }; } }, [hasProfile]);
  useEffect(() => { if (!notice || suspended) return; const id = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(id); }, [notice, suspended]);

  const start = (hunter: CharacterId) => {
    const p = profileRef.current, game = gameRef.current; if (!p || !game || suspended) return;
    setPanel(null); setResult(null); setRunError(""); setHud(null); audio.resume(); audio.startMusic();
    game.startRun(hunter, statsWithMeta(p));
    setSelected(hunter);
  };
  const backToMenu = () => { gameRef.current?.stop(); audio.stopMusic(); setPanel(null); changePhase("menu"); };
  const buy = (id: string) => {
    const p = profileRef.current; if (!p) return;
    const purchase = purchaseUpgrade(p, id);
    if (purchase.ok) { persist(purchase.profile); audio.resume(); audio.sfx("gold"); setNotice("Power-up purchased. Your next hunt begins stronger."); }
    else setNotice(purchase.error ?? "This power-up cannot be purchased.");
  };
  const pick = (option: UpgradeOption) => {
    if (phase === "evolution") gameRef.current?.chooseEvolution(option.id);
    else gameRef.current?.applyUpgrade(option);
    if (!settings.onboardingComplete) changeSettings({ onboardingComplete: true });
  };
  const inRun = !["menu", "characters", "shop", "howto"].includes(phase);
  const showOnboarding = phase === "playing" && !settings.onboardingComplete;
  const captureBattlefield = () => {
    if (process.env.NODE_ENV === "production" || !qaRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) { setNotice("The battlefield is not available to capture."); return; }
    try { canvas.toBlob(blob => {
      if (!blob) { setNotice("The battlefield image could not be created."); return; }
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "norpek-qa-battlefield.png"; link.hidden = true; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Captured the actual battlefield canvas. HUD and menus are excluded.");
    }, "image/png"); } catch { setNotice("This browser could not capture the battlefield image."); }
  };

  return <main ref={wrapRef} className="game-root" data-reduced-motion={settings.reducedMotion} data-high-contrast={settings.highContrast} data-suspended={suspended} data-save-error={Boolean(saveError)} aria-label="NORPEK: Nightfall Survivors">
    <div inert={suspended}>
    <canvas ref={canvasRef} className="world-canvas" role="img" aria-hidden={phase !== "playing" || Boolean(panel)} aria-label="Nightfall battlefield. Move with WASD, arrow keys, or drag. Attacks fire automatically." />
    <div className="sr-only" role="status" aria-live="polite">{bossWarning ? `${bossWarning} has arrived.` : notice}</div>
    {!profile && <Screen title={loadError ? "Progress needs attention" : "Gathering the night…"} narrow>
      <p>{loadError || "Loading your hunter, settings and permanent power-ups."}</p>
      {loadError && <div className="action-row"><button className="btn-gold" onClick={() => { setLoadError(""); if (!gameRef.current && platform.isPlayables) window.location.reload(); else setStartupAttempt(a => a + 1); }}>Retry loading</button>{backupAvailable && <button className="btn-ghost" onClick={async () => {
        const recovered = await recoverProfileBackup();
        if (recovered.status === "ready" && recovered.profile) { profileRef.current = recovered.profile; settingsRef.current = recovered.profile.settings; setProfile(recovered.profile); setSelected(recovered.profile.settings.lastHunter); setLoadError(""); setBackupAvailable(false); setNotice("Backup restored. Some recent progress may be missing."); }
        else setLoadError(recovered.error ?? "Backup could not be restored.");
      }}>Replace unreadable save with backup</button>}</div>}
    </Screen>}
    {profile && <>
      {inRun && hud && !["gameover", "victory"].includes(phase) && <Hud hud={hud} inactive={phase !== "playing" || Boolean(panel)} onPause={() => gameRef.current?.pause()} />}
      {bossWarning && phase === "playing" && <div className="boss-warning" aria-hidden="true"><span>ENCOUNTER APPROACHING</span><strong>{bossWarning}</strong></div>}
      {!panel && phase === "menu" && <Screen title="NORPEK" eyebrow="NIGHTFALL SURVIVORS" hero>
        <p className="hero-copy">Hold back the dark. Shape your build. Face twelve mini-bosses and six main bosses across thirty minutes. Defeat Death to reclaim the dawn.</p>
        {(profile.activeRun || (profile.rewardLedger && !profile.rewardLedger.settled)) && <div className="panel resume-card"><strong>An unfinished hunt awaits.</strong><p>{profile.activeRun ? "Resume from your last checkpoint, or end this hunt and keep banked gold." : "Your earned rewards are kept, but no resumable checkpoint is available. End this saved hunt before rebuilding your power-ups."}</p><button className="btn-gold" disabled={!profile.activeRun} onClick={() => {
          const game = gameRef.current; if (!game || !profile.activeRun) return;
          try { if (!game.importSnapshot(profile.activeRun.state)) throw new Error("Invalid checkpoint"); if (game.phase === "playing") game.pause(); setHud(game.hudSnapshot()); audio.resume(); audio.startMusic(); setNotice("Hunt restored. Continue when you are ready."); }
          catch { setNotice("This checkpoint cannot be restored. Your permanent progress is preserved."); }
        }}>Resume hunt</button><button className="btn-text" onClick={() => setPanel("end-saved")}>End saved hunt & keep gold</button></div>}
        <div className="menu-actions"><button className="btn-gold" onClick={() => changePhase("characters")}>Begin the hunt <span aria-hidden="true">→</span></button>
          <button className="btn-ghost" onClick={() => changePhase("shop")}>Power-Ups <span>{gold(profile.gold)} gold</span></button>
          <button className="btn-ghost" onClick={() => setPanel("journal")}>Hunter’s journal</button><button className="btn-ghost" onClick={() => setPanel("settings")}>Settings</button></div>
        <div className="record-strip"><span>Best <b>{fmtTime(profile.bestTime)}</b></span><span>Slain <b>{profile.totalKills.toLocaleString()}</b></span><span>Dawns <b>{profile.wins}</b></span></div>
      </Screen>}
      {!panel && phase === "characters" && <Screen title="Choose your hunter" eyebrow="FOUR PATHS THROUGH THE NIGHT" footer={<><button className="btn-ghost" onClick={backToMenu}>Back</button><button className="btn-gold" onClick={() => start(selected)}>Hunt as {CHARACTERS.find(c => c.id === selected)?.name} →</button></>}>
        <div className="hunter-grid">{CHARACTERS.map(c => <button key={c.id} aria-pressed={selected === c.id} className={`hunter-card ${selected === c.id ? "selected" : ""}`} onClick={() => setSelected(c.id)}>
          <span className="hunter-sigil" style={{ color: c.color }} aria-hidden="true">{HUNTER_ROLES[c.id].sigil}</span><span className="hunter-heading"><strong>{c.name}</strong><span>{HUNTER_ROLES[c.id].role}</span></span>
          <span className="selected-mark" aria-hidden="true">{selected === c.id ? "✓" : "○"}</span><p>{c.desc}</p>
          <span className="starting-weapon">Starts with {WEAPONS[c.weapon].name}</span>
          <span className="bonus-list">{c.bonuses.filter(b => !b.startsWith("Starts")).map(b => <span key={b} className={b.startsWith("-") ? "penalty" : "benefit"}>{b}</span>)}</span>
          <span className="hunter-trait">{c.trait}</span>
        </button>)}</div>
      </Screen>}
      {!panel && phase === "shop" && <Screen title="Power-Ups" eyebrow="PERMANENT BLESSINGS" footer={<><button className="btn-ghost" onClick={backToMenu}>Back</button><button className="btn-ghost" disabled={Boolean(profile.rewardLedger && !profile.rewardLedger.settled)} onClick={() => setPanel("refund")}>Refund power-ups</button><button className="btn-gold" onClick={() => changePhase("characters")}>Choose hunter →</button></>}>
        <p className="section-intro"><strong>{gold(profile.gold)} gold</strong> in your treasury. Purchases apply to your next hunt.{profile.rewardLedger && !profile.rewardLedger.settled && <><br/><small>End your saved hunt from the main menu to refund power-ups.</small></>}</p>
        <div className="shop-grid">{META_UPGRADES.map(u => { const rank = profile.upgrades[u.id] ?? 0, cost = metaUpgradeCost(u, rank), maxed = rank >= u.maxLevel; return <article className="panel upgrade-card" key={u.id}>
          <div className="card-overline">RANK {rank} / {u.maxLevel}</div><h3>{u.name}</h3><p>{u.desc}</p><small>{upgradeBenefit(u.id, rank)}{!maxed && ` → ${upgradeBenefit(u.id, rank + 1)}`}</small><Rank value={rank} max={u.maxLevel}/>
          <button className={maxed || cost > profile.gold ? "btn-ghost" : "btn-gold"} disabled={maxed || cost > profile.gold} onClick={() => buy(u.id)}>{maxed ? "Fully blessed" : `${gold(cost)} gold · Rank ${rank + 1}`}</button>
          {!maxed && cost > profile.gold && <small>{gold(Math.ceil(cost - profile.gold))} more gold needed</small>}
        </article>; })}</div>
      </Screen>}
      {!panel && phase === "paused" && <Screen title="The hunt can wait" eyebrow="PAUSED" narrow footer={<button className="btn-gold" onClick={() => gameRef.current?.resume()}>Resume hunt →</button>}>
        <p>{hud ? `${fmtTime(hud.time)} survived · Level ${hud.level} · ${gold(hud.gold)} gold earned` : "Your hunt is paused."}</p>
        <div className="menu-actions"><button className="btn-ghost" onClick={() => setPanel("build")}>Your build & stats</button><button className="btn-ghost" onClick={() => setPanel("settings")}>Settings</button><button className="btn-ghost" onClick={() => setPanel("journal")}>Hunter’s journal</button><button className="btn-danger" onClick={() => setPanel("end-run")}>End this hunt</button></div>
      </Screen>}
      {!panel && (phase === "levelup" || phase === "evolution") && <Screen title={phase === "evolution" ? "Choose an evolution" : "Choose your boon"} eyebrow={phase === "evolution" ? "POWER AWAKENS" : `LEVEL ${hud?.level ?? 1}`}>
        <p className="section-intro">{phase === "evolution" ? "Your chest can awaken one of these weapons." : "The night is paused. Shape what happens next."}</p>
        <p className="section-intro"><small>Weapons {hud?.weapons.length ?? 0} / 6 · Passives {hud?.passives.length ?? 0} / 6</small></p>
        <div className="choice-grid">{options.map((o, i) => <div className="choice-wrap" key={`${o.id}-${i}`}><button className="choice-card" onClick={() => pick(o)}>
          <span className="card-overline">{o.kind === "evolution" ? "Evolution · max weapon" : <>{o.isNew ? "NEW " : ""}{o.kind} {o.maxLevel > 0 ? `· ${o.isNew ? "Level 1" : `${o.level - 1} → ${o.level}`}` : ""}</>}</span>
          <span className="choice-icon" aria-hidden="true">{o.icon}</span><h3>{o.name}</h3><p>{o.desc}</p>{o.detail && <p className="choice-detail">{o.detail}</p>}
          {o.maxLevel > 0 && <Rank value={o.level} max={o.maxLevel}/>} {o.partner && <small>Evolution partner: {o.partner}</small>}{o.evolutionReady && <span className="benefit">Evolution ready</span>}
        </button>{phase === "levelup" && (hud?.draftTools.banishes ?? 0) > 0 && <button className="btn-text" onClick={() => gameRef.current?.banishOption(o.id)}>Banish {o.name}</button>}</div>)}</div>
        {phase === "levelup" && <div className="action-row"><button className="btn-ghost" disabled={!hud?.draftTools.rerolls} onClick={() => gameRef.current?.rerollDraft()}>Reroll ({hud?.draftTools.rerolls ?? 0})</button><button className="btn-ghost" disabled={!hud?.draftTools.skips} onClick={() => gameRef.current?.skipDraft()}>Skip ({hud?.draftTools.skips ?? 0})</button><span className="muted">Banish removes an item from future drafts this hunt.</span></div>}
      </Screen>}
      {!panel && phase === "chest" && <Screen title={rewards.some(r => r.isEvolution) ? "Power awakened" : "Treasures of the night"} eyebrow="CHEST OPENED" narrow footer={<button className="btn-gold" onClick={() => gameRef.current?.ackChest()}>Continue hunt →</button>}>
        <div className="reward-list">{rewards.map((r, i) => <article className={`panel ${r.isEvolution ? "evolution-reward" : ""}`} key={i}><span aria-hidden="true">{r.icon}</span><div><h3>{r.name}</h3><p>{r.desc}</p></div></article>)}</div>
      </Screen>}
      {!panel && phase === "covenant" && <Screen title="A covenant in the dark" eyebrow="OPTIONAL RITUAL">
        <p className="section-intro">{hud?.covenant?.status === "reward" ? "The ritual is complete. Choose your blessing for this hunt." : "Defeat 12 foes within the marked shrine area in 45 seconds. A cultist ring will arrive. Only enemies defeated inside the circle count. Complete it to choose a blessing. Failure grants no blessing; you may decline safely."}</p>
        <div className="choice-grid">{covenants.map(c => <button className="choice-card" key={c.id} onClick={() => gameRef.current?.chooseCovenantReward(c.id)}><h3>{c.name}</h3><p>{c.desc}</p></button>)}</div>
        {!covenants.length && <div className="action-row"><button className="btn-gold" onClick={() => gameRef.current?.acceptCovenant()}>Accept ritual</button><button className="btn-ghost" onClick={() => gameRef.current?.declineCovenant()}>Continue without it</button></div>}
      </Screen>}
      {!panel && result && (phase === "gameover" || phase === "victory") && <Screen title={result.won ? "Dawn reclaimed" : result.abandoned ? "The hunt ends here" : "The night remembers"} eyebrow={result.won ? "VICTORY" : result.abandoned ? "HUNT ENDED" : "FALLEN, NOT FORGOTTEN"}>
        <p className="section-intro">{result.won ? "Death has fallen. You have earned the dawn." : result.abandoned ? "Your earned gold is kept. Return when you are ready." : result.cause || "The horde overcame you. Your earned gold carries into the next hunt."}</p>
        {result.won && result.metrics.goldBySource.victory > 0 && <p className="section-intro"><small>Gold earned includes the fixed {gold(result.metrics.goldBySource.victory)}-gold dawn bonus.</small></p>}
        <div className="result-stats"><Stat label="Survived" value={fmtTime(result.time)}/><Stat label="Gold earned" value={gold(result.gold)}/><Stat label="Enemies slain" value={gold(result.kills)}/><Stat label="Level reached" value={String(result.level)}/>{result.finaleTime > 0 && <Stat label="Death encounter" value={fmtTime(result.finaleTime)}/>}<Stat label="Damage dealt" value={gold(result.damageDealt)}/></div>
        <div className="panel recap"><h3>Your final build</h3><p>{result.build.map(id => WEAPONS[id]?.name ?? id).join(" · ") || "Starting equipment"}</p><p className="muted">{result.won ? "Try a new hunter or a different evolution path." : "Invest your gold, keep escape routes open, and pair weapons with their evolution passives."}</p></div>
        <div className="action-row"><button className="btn-gold" onClick={() => start(result.character)}>Hunt again →</button><button className="btn-ghost" onClick={() => changePhase("shop")}>Power-Ups</button><button className="btn-ghost" onClick={() => changePhase("characters")}>Change hunter</button><button className="btn-text" onClick={backToMenu}>Menu</button></div>
      </Screen>}
      {panel === "settings" && <Settings settings={settings} muted={profile.muted} onChange={changeSettings} onMute={() => { const p = profileRef.current; if (p) persist(setProfileMuted(p, !p.muted)); }} onBack={() => setPanel(null)}/>}
      {panel === "journal" && <Journal profile={profile} onBack={() => setPanel(null)} onReplayTutorial={() => { changeSettings({ onboardingComplete: false }); setNotice("Guidance will appear in your next hunt."); }}/>}
      {panel === "build" && hud && <BuildView hud={hud} onBack={() => setPanel(null)}/>}
      {panel === "end-run" && <Screen title="End this hunt?" eyebrow="YOUR PROGRESS IS KEPT" narrow footer={<><button className="btn-ghost" onClick={() => setPanel(null)}>Keep hunting</button><button className="btn-danger" onClick={() => { setPanel(null); gameRef.current?.abandonRun(); }}>End hunt & keep gold</button></>}><p>This attempt will end. Gold already earned remains in your treasury. Your current weapons and level reset for the next hunt.</p></Screen>}
      {panel === "reload-save" && <Screen title="Reload saved progress?" eyebrow="ANOTHER SESSION HAS CHANGED YOUR SAVE" narrow footer={<><button className="btn-ghost" onClick={() => setPanel(null)}>Keep this session open</button><button className="btn-danger" onClick={() => { gameRef.current?.stop(); audio.stopMusic(); profileRef.current = null; setProfile(null); setSaveError(""); setSaveConflict(false); setPanel(null); changePhase("menu"); setStartupAttempt(a => a + 1); }}>Reload latest saved progress</button></>}><p>Your current unsaved hunt and local changes will be discarded. The latest saved progress from the other session will be loaded.</p></Screen>}
      {panel === "end-saved" && <Screen title="End your saved hunt?" narrow footer={<><button className="btn-ghost" onClick={() => setPanel(null)}>Keep checkpoint</button><button className="btn-danger" onClick={() => { const p = profileRef.current; if (p?.rewardLedger && !p.rewardLedger.settled) persist(settleRun(p, p.rewardLedger.runId, p.rewardLedger.latestStats, { outcome: "abandoned", cause: "Saved hunt ended deliberately" })); setPanel(null); }}>End saved hunt</button></>}><p>Your banked gold and permanent progress stay. The resumable hunt is removed, and you can refund or rebuild your power-ups.</p></Screen>}
      {panel === "run-error" && <Screen title="The hunt stopped safely" eyebrow="RECOVERY" narrow footer={<button className="btn-gold" onClick={() => { setPanel(null); gameRef.current?.abandonRun(); }}>End hunt & keep earned gold</button>}><p>{runError}</p><p>Your permanent progress is retained. End this attempt before starting another hunt.</p></Screen>}
      {panel === "refund" && <Screen title="Rebuild your blessings?" narrow footer={<><button className="btn-ghost" onClick={() => setPanel(null)}>Keep power-ups</button><button className="btn-gold" onClick={() => { const refund = refundUpgrades(profile); persist(refund.profile); setPanel(null); setNotice(`${gold(refund.refunded)} gold refunded.`); }}>Refund all power-ups</button></>}><p>All permanent ranks return to zero and their recorded purchase cost returns to your treasury. This affects future hunts.</p></Screen>}
      {showOnboarding && <aside className="onboarding" data-ui><strong>{inputDevice === "pointer" ? "Drag to move. Release to stop." : "WASD or arrow keys to move. You can also drag."}</strong><span>{hud && hud.time > 10 ? "Collect glowing gems to level up. Pair weapons with passives to unlock evolutions." : "Your weapons attack automatically. Keep an escape route open; Sword Wave follows your last movement direction."}</span><button className="btn-text" onClick={() => changeSettings({ onboardingComplete: true })}>Got it</button></aside>}
      {saveError && <aside ref={saveErrorRef} className="save-error" data-ui data-global role="alert"><strong>Progress is waiting to save.</strong><span>{saveError}</span><button className="btn-ghost" onClick={() => { if (saveConflict) { gameRef.current?.pause(); setPanel("reload-save"); } else if (profileRef.current) persist(profileRef.current); }}>{saveConflict ? "Reload saved progress…" : "Retry save"}</button></aside>}
      {notice && <div className="toast" data-ui>{notice}</div>}
      {!qaMode && !inRun && <div className="save-status" aria-live="off">{saveError ? "Save pending" : qaMode ? "QA · temporary profile, never saved" : platform.storageKind === "preview" ? "SDK preview · progress lasts for this session" : saving ? "Saving…" : "Progress saved"}</div>}
    </>}
    {process.env.NODE_ENV !== "production" && qaMode && profile && <QaLab metrics={qaMetrics} phase={phase} onResetMetrics={() => { resetQaMetricsRef.current(); wakeCanvasRef.current(); }} onCapture={captureBattlefield} onLaunch={(scenario) => { start(scenario.hunter); gameRef.current?.debugScenario(scenario); setHud(gameRef.current?.hudSnapshot() ?? null); }} onPause={() => gameRef.current?.pause()} onResume={() => gameRef.current?.resume()}/>}
    </div>
    {suspended && <div ref={curtainRef} tabIndex={-1} className="platform-curtain" data-ui role="status">Hunt suspended</div>}
  </main>;
}

function Screen({ title, eyebrow, children, footer, narrow = false, hero = false }: { title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode; narrow?: boolean; hero?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const opened = useRef(0);
  useEffect(() => {
    opened.current = performance.now();
    const previous = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("h1,h2")?.focus());
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || ref.current?.closest("[inert]")) return;
      const selector = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';
      const controls = [...Array.from(ref.current?.querySelectorAll<HTMLElement>(selector) ?? []), ...Array.from(ref.current?.closest("main")?.querySelectorAll<HTMLElement>(`[data-global] :is(${selector})`) ?? [])].filter(el => el.getClientRects().length > 0 && !el.closest("[inert],[hidden]"));
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1], active = document.activeElement;
      // The save recovery banner is a sibling of the dialog, so the listener must also cover it.
      const outsideControls = !controls.some(control => control === active);
      if (event.shiftKey && (active === first || outsideControls)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || outsideControls)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trapTab);
    return () => { cancelAnimationFrame(id); document.removeEventListener("keydown", trapTab); if (previous?.isConnected && !previous.closest("[inert]")) previous.focus({ preventScroll: true }); };
  }, [title]);
  return <section ref={ref} data-ui className={`screen-shell ${hero ? "hero-screen" : ""}`} aria-label={title} role="dialog" onClickCapture={e => { if (performance.now() - opened.current < 180) { e.preventDefault(); e.stopPropagation(); } }}><div className={`screen-content ${narrow ? "narrow" : ""}`}>
    <header className="screen-heading">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 tabIndex={-1}>{title}</h1><span className="heading-rule" aria-hidden="true"/></header>
    {children}{footer && <footer className="screen-footer">{footer}</footer>}
  </div></section>;
}
function Rank({ value, max }: { value: number; max: number }) { return <span className="rank-track" role="img" aria-label={`Rank ${value} of ${max}`}>{Array.from({ length: max }, (_, i) => <span key={i} className={i < value ? "filled" : ""}/>)}</span>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="stat"><span>{label}</span><strong>{value}</strong></div>; }

function Hud({ hud, inactive, onPause }: { hud: HudState; inactive: boolean; onPause: () => void }) {
  const hp = Math.max(0, Math.min(1, hud.hp / hud.maxHp));
  const nextLabel = hud.nextEncounter && hud.finaleTime <= 0 ? `Next ${hud.nextEncounter.kind === "miniBoss" ? "mini-boss" : "main boss"}: ${hud.nextEncounter.name} at ${fmtTime(hud.nextEncounter.minute * 60)}` : null;
  return <div className="hud" inert={inactive} aria-hidden={inactive} aria-label="Hunt status">
    <div className="xp-track" role="progressbar" aria-label={`Experience, level ${hud.level}`} aria-valuenow={Math.floor(hud.xp)} aria-valuemin={0} aria-valuemax={Math.ceil(hud.xpNext)}><span style={{ width: `${Math.min(1, hud.xp / hud.xpNext) * 100}%` }}/></div>
    <div className="hud-main"><div className="hud-health"><span className="hud-label">VITALITY <b>{Math.ceil(hud.hp)} / {hud.maxHp}</b></span><div role="progressbar" aria-label="Hunter health" aria-valuenow={Math.max(0, Math.ceil(hud.hp))} aria-valuemin={0} aria-valuemax={Math.ceil(hud.maxHp)} className={`health-track ${hp < .35 ? "low" : ""}`}><span style={{ width: `${hp * 100}%` }}/></div><span className="hud-small">LV {hud.level} <span> · {gold(hud.kills)} slain</span></span></div>
      <div className="hud-time"><strong>{fmtTime(hud.time)}</strong><span title={hud.nextEncounter?.name}><span aria-hidden={Boolean(nextLabel)}>{hud.finaleTime > 0 ? `DEATH +${fmtTime(hud.finaleTime)}` : hud.nextEncounter ? `${hud.nextEncounter.kind === "miniBoss" ? "MINI-BOSS" : "BOSS"} AT ${fmtTime(hud.nextEncounter.minute * 60)}` : hud.boss ? "BOSS ENCOUNTER" : "SURVIVE THE NIGHT"}</span>{nextLabel && <span className="sr-only">{nextLabel}</span>}</span></div>
      <div className="hud-actions"><span>{gold(hud.gold)} <small>gold</small></span><button className="btn-ghost" data-ui onClick={onPause} aria-label="Pause hunt">Ⅱ <span>Pause</span></button></div>
    </div>
    <div className="hud-equipment" aria-label="Your equipment">{hud.weapons.map(w => <span key={w.id} title={`${w.name}, ${w.evolved ? "evolved" : `level ${w.level}`}`} className={w.evolved ? "evolved" : ""}><span aria-hidden="true">{w.icon}</span><b>{w.evolved ? "✦" : w.level}</b><span className="sr-only">{w.name}, level {w.level}</span></span>)}<i/>{hud.passives.map(p => <span key={p.id} title={`${p.name}, level ${p.level}`}><span aria-hidden="true">{p.icon}</span><b>{p.level}</b><span className="sr-only">{p.name}, level {p.level}</span></span>)}</div>
    {hud.covenant?.status === "active" && <div className="covenant-status"><strong>Ritual: {hud.covenant.progress} / {hud.covenant.target}</strong><span>{Math.ceil(hud.covenant.remaining)}s remaining · stay near the shrine</span></div>}
    {hud.boss && <div className="boss-health"><strong>{hud.boss.name}</strong><div role="progressbar" aria-label={`${hud.boss.name} health`} aria-valuenow={Math.ceil(hud.boss.hp)} aria-valuemin={0} aria-valuemax={Math.ceil(hud.boss.maxHp)}><span style={{ width: `${Math.max(0, hud.boss.hp / hud.boss.maxHp) * 100}%` }}/></div></div>}
  </div>;
}

function Settings({ settings, muted, onChange, onMute, onBack }: { settings: GameSettings; muted: boolean; onChange: (patch: Partial<GameSettings>) => void; onMute: () => void; onBack: () => void }) {
  return <Screen title="Make the night yours" eyebrow="SETTINGS" footer={<button className="btn-gold" onClick={onBack}>Done</button>}>
    <div className="settings-grid"><section className="panel settings-section"><h2>Sound</h2>
      {platform.isPlayables && <p>YouTube controls overall sound. These levels apply when platform sound is enabled.</p>}
      <label className="setting-row"><span>Music <span aria-hidden="true">{Math.round(settings.musicVolume * 100)}%</span></span><input type="range" aria-label="Music volume" aria-valuetext={`${Math.round(settings.musicVolume * 100)} percent`} min="0" max="1" step=".05" value={settings.musicVolume} onChange={e => onChange({ musicVolume: Number(e.target.value) })}/></label>
      <label className="setting-row"><span>Sound effects <span aria-hidden="true">{Math.round(settings.sfxVolume * 100)}%</span></span><input type="range" aria-label="Sound effects volume" aria-valuetext={`${Math.round(settings.sfxVolume * 100)} percent`} min="0" max="1" step=".05" value={settings.sfxVolume} onChange={e => onChange({ sfxVolume: Number(e.target.value) })}/></label>
      {!platform.isPlayables && <button className="btn-ghost" onClick={onMute} aria-pressed={muted}>{muted ? "Enable sound" : "Mute all sound"}</button>}
    </section><section className="panel settings-section"><h2>Comfort & clarity</h2>
      <Toggle label="Reduced motion" description="Calmer menus, no camera shake or damage flashing." checked={settings.reducedMotion} onChange={v => onChange({ reducedMotion: v })}/>
      <Toggle label="Screen shake" checked={settings.screenShake} onChange={v => onChange({ screenShake: v })}/>
      <Toggle label="Impact flashes & pulses" description="Keep health and danger warnings visible without flashing impacts." checked={settings.screenFlash} onChange={v => onChange({ screenFlash: v })}/>
      <Toggle label="Emphasize threats & hunter" checked={settings.highContrast} onChange={v => onChange({ highContrast: v })}/>
      <label className="setting-row"><span>Visual effects</span><select aria-label="Visual effects" value={settings.effectsIntensity} onChange={e => onChange({ effectsIntensity: e.target.value as GameSettings["effectsIntensity"] })}><option value="full">Full atmosphere</option><option value="reduced">Fewer particles</option></select></label>
      <label className="setting-row"><span>Damage numbers</span><select aria-label="Damage numbers" value={settings.damageNumbers} onChange={e => onChange({ damageNumbers: e.target.value as GameSettings["damageNumbers"] })}><option value="all">All hits</option><option value="critical">Critical hits & healing</option><option value="off">Off</option></select></label>
    </section><section className="panel settings-section"><h2>Movement</h2><p>WASD / arrow keys, or drag with a mouse, pen or finger. Attacks fire automatically.</p>
      <label className="setting-row"><span>Touch joystick</span><select aria-label="Touch joystick" value={settings.joystickMode} onChange={e => onChange({ joystickMode: e.target.value as GameSettings["joystickMode"] })}><option value="floating">Where you touch</option><option value="fixed">Fixed position</option></select></label>
      <label className="setting-row"><span>Fixed joystick side</span><select aria-label="Fixed joystick side" value={settings.joystickSide} onChange={e => onChange({ joystickSide: e.target.value as GameSettings["joystickSide"] })}><option value="left">Left</option><option value="right">Right</option></select></label>
      <p className="muted">{platform.isPlayables ? "Press P or use the Pause button to pause." : "Press P or Escape to pause."} Release movement before choosing upgrades.</p>
    </section></div>
  </Screen>;
}
function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="toggle-row"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><input type="checkbox" aria-label={label} checked={checked} onChange={e => onChange(e.target.checked)}/></label>;
}
function Journal({ profile, onBack, onReplayTutorial }: { profile: ProfileSave; onBack: () => void; onReplayTutorial: () => void }) {
  const [tab, setTab] = useState("field");
  return <Screen title="Hunter’s journal" eyebrow="KNOWLEDGE OUTLASTS THE NIGHT" footer={<button className="btn-gold" onClick={onBack}>Back</button>}>
    <nav className="journal-tabs" aria-label="Journal pages">{[["field", "Field guide"], ["encounters", "Boss schedule"], ["recipes", "Evolutions"], ["records", "Records"]].map(([id, name]) => <button key={id} className={tab === id ? "btn-gold" : "btn-ghost"} aria-pressed={tab === id} onClick={() => setTab(id)}>{name}</button>)}</nav>
    {tab === "field" && <div className="guide-grid"><article className="panel"><h2>Move to survive</h2><p>Use WASD, arrow keys, or drag. Your attacks fire automatically. Sword Wave follows the last direction you moved; other weapons seek targets or attack around you.</p><p>Keep open ground behind you. Circling through a gap is safer than running into an unbroken wall of enemies.</p><button className="btn-ghost" onClick={onReplayTutorial}>Show first-run guidance again</button></article>
      <article className="panel"><h2>Build with purpose</h2><p>Glowing gems grant experience. Each level offers a choice. Carry up to six weapons and six passives. Max a weapon, hold its paired passive, then claim a treasure chest to evolve it.</p><p>Reroll, skip and banish charges are limited per hunt. An item you banish will not appear again in that hunt’s drafts.</p></article>
      <article className="panel"><h2>Read the ground</h2><p>Outlined danger zones warn of incoming attacks. Leave before the countdown closes. Hostile projectiles can hurt you even while you are damaging their source.</p><p>Mini-bosses begin at 01:00. A main boss arrives every five minutes, ending with Death at 30:00. Open the Boss schedule for exact times and attack tells. Defeat Death to win; reaching the timer alone is not victory.</p></article>
      <article className="panel"><h2>Know your rewards</h2><p>Gems give XP. Coins give permanent gold. Food restores health. Magnets gather nearby gems. Bombs damage the horde. Chests grant rewards and eligible evolutions.</p><p>Earned gold is kept when the hunt ends. Spend it on Power-Ups, or refund permanent upgrades to try another direction.</p></article>
    </div>}
    {tab === "encounters" && <><p className="section-intro">Twelve mini-bosses and six main bosses punctuate the hunt. Mini-bosses wear a crown and have a named health bar. They resist freezing and knockback, so keep moving while you attack. Edge markers point toward threats beyond the screen.</p>
      <ol className="encounter-schedule">{[
        ...MINI_BOSSES.map(b => ({ ...b, kind: "Mini-boss", tip: b.pattern === "charge" ? "Leave the marked charge lane before the rush." : b.pattern === "volley" ? "Move sideways from the marked aim line; watch the gaps between bolts." : "Leave the marked circle before the ground slam." })),
        ...BOSSES.map(b => ({ ...b, kind: "Main boss", tip: BOSS_TIPS[b.id] ?? "Read the warning zones and keep an escape route open." })),
      ].sort((a, b) => a.minute - b.minute).map(b => <li className="panel" key={b.id}><time>{fmtTime(b.minute * 60)}</time><div><p className="card-overline">{b.kind}</p><h2>{b.name}</h2><p className="muted">{b.title}</p><p>{b.tip}</p></div></li>)}</ol>
    </>}
    {tab === "recipes" && <div className="recipe-grid">{Object.values(WEAPONS).map(w => <article className="panel recipe" key={w.id}><p className="card-overline">{w.name} · LEVEL {w.maxLevel}</p><h2>{w.evolvedName}</h2><p className="recipe-formula"><span>{w.name}</span><b>+</b><span>{PASSIVES[w.evolvesWith].name}</span><b>+</b><span>Treasure chest</span></p><p>{w.evolvedDesc}</p></article>)}</div>}
    {tab === "records" && <><div className="result-stats"><Stat label="Best survival" value={fmtTime(profile.bestTime)}/><Stat label="Dawns reclaimed" value={String(profile.wins)}/><Stat label="Hunts completed" value={String(profile.runs)}/><Stat label="Enemies slain" value={gold(profile.totalKills)}/></div>
      <h2 className="subheading">Hunter mastery</h2><div className="guide-grid">{CHARACTERS.map(c => <article className="panel" key={c.id}><h2>{c.name}</h2><p>{profile.mastery[c.id].runs} hunts · {profile.mastery[c.id].wins} victories · best {fmtTime(profile.mastery[c.id].bestTime)}</p><p className="muted">{c.trait}</p></article>)}</div>
      <h2 className="subheading">Milestones · {profile.achievements.length} / {ACHIEVEMENTS.length}</h2><div className="guide-grid">{ACHIEVEMENTS.map(a => <article className="panel" key={a.id}><p className="card-overline">{profile.achievements.includes(a.id) ? "EARNED" : "UNDISCOVERED"}</p><h3>{a.name}</h3><p>{a.description}</p></article>)}</div>
      <h2 className="subheading">Recent hunts</h2>{profile.history.length ? <div className="history-list">{profile.history.map(r => <article className="panel" key={r.runId}><h3>{CHARACTERS.find(c => c.id === r.hunter)?.name} · {r.outcome === "won" ? "Dawn reclaimed" : r.outcome === "abandoned" ? "Hunt ended" : "Fallen"}</h3><p>{fmtTime(r.time)} · {r.kills} slain · {gold(r.gold)} gold · Level {r.level}</p><p className="muted">{r.cause}</p><small>{(r.build.length ? r.build : r.weapons.map(id => WEAPONS[id]?.name ?? id)).join(" · ")}</small></article>)}</div> : <p className="muted">Your first hunt will begin this record.</p>}</>}
  </Screen>;
}
function BuildView({ hud, onBack }: { hud: HudState; onBack: () => void }) {
  return <Screen title="Your build" eyebrow="THE POWER YOU CARRY" footer={<button className="btn-gold" onClick={onBack}>Back to pause</button>}>
    <p className="section-intro">{hud.trait}</p><h2 className="subheading">Weapons · {hud.weapons.length} / 6</h2><div className="build-grid">{hud.weapons.map(w => <article className="panel" key={w.id}><p className="card-overline">{w.evolved ? "EVOLVED" : `LEVEL ${w.level} / ${w.maxLevel}`}</p><h3>{w.name}</h3><p>{w.desc}</p><Rank value={w.level} max={w.maxLevel}/><small>{w.evolved ? "Evolution complete" : w.evolutionReady ? "Ready to evolve at your next chest" : `Evolution partner: ${w.partner}`}</small></article>)}</div>
    <h2 className="subheading">Passives · {hud.passives.length} / 6</h2><div className="build-grid">{hud.passives.map(p => <article className="panel" key={p.id}><h3>{p.name}</h3><p>{p.desc}</p><Rank value={p.level} max={p.maxLevel}/></article>)}</div>
    <h2 className="subheading">Effective stats</h2><div className="result-stats"><Stat label="Damage" value={`${Math.round(hud.stats.might * 100)}%`}/><Stat label="Attack area" value={`${Math.round(hud.stats.area * 100)}%`}/><Stat label="Cooldown" value={`${Math.round(hud.stats.cooldown * 100)}%`}/><Stat label="Movement" value={`${Math.round(hud.stats.moveSpeed * 100)}%`}/><Stat label="Critical chance" value={`${Math.round(hud.stats.critChance * 100)}%`}/><Stat label="Armor" value={String(hud.stats.armor)}/><Stat label="Regeneration" value={`${hud.stats.regen.toFixed(1)} HP/s`}/><Stat label="Revives left" value={String(hud.stats.revives)}/></div>
  </Screen>;
}
const embers: { x: number; y: number; s: number; v: number; p: number }[] = [];
function drawMenuBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0b0a18");
  grad.addColorStop(0.6, "#120a1c");
  grad.addColorStop(1, "#1a0b14");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // moon
  const mx = w * 0.78;
  const my = h * 0.2;
  const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 160);
  mg.addColorStop(0, "rgba(200,180,255,0.25)");
  mg.addColorStop(1, "rgba(200,180,255,0)");
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(mx, my, 160, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d8cff0";
  ctx.shadowColor = "#b8a8ff";
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(mx, my, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0b0a18";
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(mx - 12, my - 8, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (!embers.length) {
    for (let i = 0; i < 70; i++) {
      embers.push({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 2.4, v: 8 + Math.random() * 26, p: Math.random() * Math.PI * 2 });
    }
  }
  for (const e of embers) {
    const x = e.x * w + Math.sin(t * 0.5 + e.p) * 30;
    const y = ((e.y * h - t * e.v) % h + h) % h;
    const a = 0.25 + Math.sin(t * 2 + e.p) * 0.15;
    ctx.fillStyle = e.p % 2 > 1 ? `rgba(240,199,94,${a})` : `rgba(196,90,138,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, e.s, 0, Math.PI * 2);
    ctx.fill();
  }
  // ground silhouette
  ctx.fillStyle = "#070610";
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.86);
  for (let x = 0; x <= w; x += 60) {
    ctx.lineTo(x, h * 0.86 + Math.sin(x * 0.01 + 2) * 14);
  }
  ctx.lineTo(w, h);
  ctx.fill();
}


function upgradeBenefit(id: string, rank: number) {
  const stats = { ...BASE_STATS };
  META_UPGRADES.find(u => u.id === id)?.apply(stats, rank);
  const values: Record<string, string> = {
    might: `${Math.round((stats.might - 1) * 100)}% bonus damage`, vitality: `${stats.maxHp} base HP`,
    swiftness: `${Math.round((stats.moveSpeed - 1) * 100)}% bonus speed`, haste: `${Math.round((1 - stats.cooldown) * 1000) / 10}% cooldown reduction`,
    magnetism: `${Math.round(stats.magnet)} pickup range`, fortune: `${Math.round((stats.luck - 1) * 100)}% bonus luck`,
    greed: `${Math.round((stats.goldGain - 1) * 100)}% bonus gold`, growth: `${Math.round((stats.xpGain - 1) * 100)}% bonus XP`,
    armor: `${stats.armor} armor`, revival: `${stats.revives} ${stats.revives === 1 ? "revive" : "revives"}`,
  };
  return values[id] ?? `Rank ${rank}`;
}

type QaScenario = { hunter: CharacterId; minute: number; density: number; fullBuild: boolean; boss: string; miniBoss: string; phase: RunPhase; invulnerable: boolean; seed: number };
function QaLab({ metrics, phase, onResetMetrics, onCapture, onLaunch, onPause, onResume }: { metrics: QaMetrics | null; phase: GamePhase; onResetMetrics: () => void; onCapture: () => void; onLaunch: (scenario: QaScenario) => void; onPause: () => void; onResume: () => void }) {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<QaScenario>({ hunter: "knight", minute: 0, density: 10, fullBuild: false, boss: "none", miniBoss: "none", phase: "playing", invulnerable: true, seed: 42 });
  const update = <K extends keyof QaScenario>(key: K, value: QaScenario[K]) => setScenario(s => ({ ...s, [key]: value }));
  return <aside className={`qa-lab ${open ? "open" : ""}`} data-ui data-global>
    <button className="btn-ghost" aria-expanded={open} onClick={() => setOpen(!open)}>QA lab · temporary profile {open ? "−" : "+"}</button>
    {open && <div className="qa-controls"><p>No real progress is loaded or saved. These scenarios are developer-only and do not establish balanced full-run results.</p>
      <section className="qa-metrics" aria-label="QA frame diagnostics" aria-live="off"><strong>Canvas RAF intervals · {phase}</strong>
        <p>{metrics?.samples ? `${metrics.fps.toFixed(1)} average FPS · p50 ${metrics.p50.toFixed(1)} ms · p95 ${metrics.p95.toFixed(1)} ms · p99 ${metrics.p99.toFixed(1)} ms` : "Launch a playing scenario to collect samples."}</p>
        <p>{metrics?.samples ?? 0} / 600 rolling samples · {metrics?.frames ?? 0} frames since reset</p>
        {metrics && <><p>{metrics.width} × {metrics.height} CSS px · raster DPR {metrics.dpr}</p><p>Active: {metrics.enemies} enemies · {metrics.projectiles} projectiles · {metrics.pickups} pickups · {metrics.particles} particles · {metrics.effects} effects</p></>}
        <p>Local development measurements, updated once per second. Intervals between rendered frames, not CPU or GPU cost. Pause gaps are excluded. This does not establish mobile or release-build performance.</p>
        <button className="btn-ghost" onClick={onResetMetrics}>Reset frame samples</button>
        <button className="btn-ghost" onClick={onCapture}>Capture battlefield PNG</button><small>Actual canvas pixels only; HUD and menus are excluded.</small>
      </section>
      <label>Hunter<select aria-label="QA hunter" value={scenario.hunter} onChange={e => update("hunter", e.target.value as CharacterId)}>{CHARACTERS.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
      <label>Scenario<select aria-label="QA scenario" value={scenario.phase} onChange={e => update("phase", e.target.value as RunPhase)}>{(["playing", "levelup", "chest", "evolution", "covenant", "paused", "gameover", "victory"] as const).map(phase => <option key={phase} value={phase}>{phase}</option>)}</select></label>
      <label>Minute<input type="number" aria-label="QA starting minute" min="0" max="30" value={scenario.minute} onChange={e => update("minute", Math.min(30, Math.max(0, Number(e.target.value))))}/></label>
      <label>Enemies<input type="number" aria-label="QA enemy count" min="0" max="350" value={scenario.density} onChange={e => update("density", Math.min(350, Math.max(0, Number(e.target.value))))}/></label>
      <label>Boss<select aria-label="QA boss" value={scenario.boss} onChange={e => update("boss", e.target.value as QaScenario["boss"])}><option value="none">None</option>{BOSSES.map(boss => <option key={boss.id} value={boss.id}>{fmtTime(boss.minute * 60)} · {boss.name}</option>)}</select></label>
      <label>Mini-boss<select aria-label="QA mini-boss" value={scenario.miniBoss} onChange={e => update("miniBoss", e.target.value)}><option value="none">None</option>{MINI_BOSSES.map(boss => <option key={boss.id} value={boss.id}>{fmtTime(boss.minute * 60)} · {boss.name}</option>)}</select></label>
      <label>Seed<input type="number" aria-label="QA random seed" min="1" max="4294967295" value={scenario.seed} onChange={e => update("seed", Math.max(1, Number(e.target.value)))}/></label>
      <Toggle label="Six max-level weapons/passives" checked={scenario.fullBuild} onChange={v => update("fullBuild", v)}/><Toggle label="Invulnerable" checked={scenario.invulnerable} onChange={v => update("invulnerable", v)}/>
      <button className="btn-gold" onClick={() => { onLaunch({ ...scenario, fullBuild: scenario.fullBuild || scenario.phase === "evolution" }); setOpen(false); }}>Launch fresh QA hunt</button>
      <div className="action-row"><button className="btn-ghost" onClick={onPause}>Pause</button><button className="btn-ghost" onClick={onResume}>Resume</button></div>
    </div>}
  </aside>;
}
