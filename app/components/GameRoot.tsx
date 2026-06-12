"use client";

// NORPEK: Nightfall Survivors — React shell: canvas host + all UI screens.

import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "../game/engine";
import { renderGame } from "../game/render";
import { Input } from "../game/input";
import { audio } from "../game/audio";
import { loadSave, writeSave, statsWithMeta } from "../game/meta";
import {
  CHARACTERS,
  META_UPGRADES,
  metaUpgradeCost,
  GAME_DURATION,
} from "../game/data";
import type {
  CharacterId,
  GamePhase,
  HudState,
  MetaSave,
  UpgradeOption,
  ChestReward,
  RunStats,
} from "../game/types";

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function GameRoot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const inputRef = useRef<Input | null>(null);

  const [phase, setPhase] = useState<GamePhase>("menu");
  const phaseRef = useRef<GamePhase>("menu");
  const [save, setSave] = useState<MetaSave | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [options, setOptions] = useState<UpgradeOption[]>([]);
  const [chestRewards, setChestRewards] = useState<ChestReward[]>([]);
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [bossWarn, setBossWarn] = useState<{ name: string; title: string } | null>(null);
  const [selChar, setSelChar] = useState<CharacterId>("knight");

  const setPhaseBoth = useCallback((p: GamePhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // ---- init engine once
  useEffect(() => {
    const s = loadSave();
    setSave(s);
    audio.muted = s.muted;

    const input = new Input();
    inputRef.current = input;
    if (wrapRef.current) input.attach(wrapRef.current);

    const game = new Game(input, {
      onPhaseChange: (p) => {
        // engine phases map directly; menus are React-side
        setPhaseBoth(p);
      },
      onHud: (h) => setHud(h),
      onLevelUp: (opts) => setOptions(opts),
      onChest: (r) => setChestRewards(r),
      onRunEnd: (stats) => {
        setRunStats(stats);
        setSave((prev) => {
          if (!prev) return prev;
          const next: MetaSave = {
            ...prev,
            gold: prev.gold + stats.gold,
            totalKills: prev.totalKills + stats.kills,
            bestTime: Math.max(prev.bestTime, stats.time),
            wins: prev.wins + (stats.won ? 1 : 0),
            runs: prev.runs + 1,
          };
          writeSave(next);
          return next;
        });
        audio.stopMusic();
      },
      onBossWarning: (name, title) => {
        setBossWarn({ name, title });
        setTimeout(() => setBossWarn(null), 3200);
      },
    });
    gameRef.current = game;

    input.onPause = () => {
      const g = gameRef.current;
      if (!g) return;
      if (phaseRef.current === "playing") g.pause();
      else if (phaseRef.current === "paused") g.resume();
    };

    // debug mode: ?debug=1 → T +60s, Y +290s, X +xp, K kill all, B melt boss
    let debugKeys: ((e: KeyboardEvent) => void) | null = null;
    if (new URLSearchParams(window.location.search).has("debug")) {
      game.debug = true;
      (window as unknown as { __game?: Game }).__game = game;
      debugKeys = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        if (k === "t") game.debugSkip(60);
        if (k === "y") game.debugSkip(290);
        if (k === "x") game.gainXp(50);
        if (k === "k") game.debugKillAll();
        if (k === "b") game.debugMeltBoss();
      };
      window.addEventListener("keydown", debugKeys);
    }

    // render loop (always running so paused frames still draw)
    let raf = 0;
    const ctx = canvasRef.current?.getContext("2d");
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas && ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const p = phaseRef.current;
        try {
          if (p === "menu" || p === "characters" || p === "shop" || p === "howto") {
            drawMenuBackdrop(ctx, w, h, performance.now() / 1000);
          } else if (gameRef.current) {
            renderGame(gameRef.current, ctx, w, h);
          }
        } catch (err) {
          // one bad frame must never kill the render loop
          console.error("render error", err);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      if (debugKeys) window.removeEventListener("keydown", debugKeys);
      game.stop();
      input.detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- actions
  const startRun = (charId: CharacterId) => {
    const g = gameRef.current;
    if (!g || !save) return;
    audio.resume();
    audio.startMusic();
    setRunStats(null);
    setHud(null);
    g.startRun(charId, statsWithMeta(save));
  };

  const buyUpgrade = (id: string) => {
    if (!save) return;
    const def = META_UPGRADES.find((u) => u.id === id)!;
    const lvl = save.upgrades[id] ?? 0;
    const cost = metaUpgradeCost(def, lvl);
    if (lvl >= def.maxLevel || save.gold < cost) return;
    audio.resume();
    audio.sfx("gold");
    const next = { ...save, gold: save.gold - cost, upgrades: { ...save.upgrades, [id]: lvl + 1 } };
    writeSave(next);
    setSave(next);
  };

  const toggleMute = () => {
    if (!save) return;
    const next = { ...save, muted: !save.muted };
    writeSave(next);
    setSave(next);
    audio.setMuted(next.muted);
  };

  const quitToMenu = () => {
    audio.stopMusic();
    gameRef.current?.stop();
    setPhaseBoth("menu");
  };

  const inRun = ["playing", "levelup", "chest", "paused", "gameover", "victory"].includes(phase);

  return (
    <div ref={wrapRef} className="fixed inset-0 overflow-hidden bg-[#06060c]">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* ---------- HUD ---------- */}
      {inRun && hud && phase !== "gameover" && phase !== "victory" && (
        <Hud hud={hud} onPause={() => gameRef.current?.pause()} />
      )}

      {/* boss warning banner */}
      {bossWarn && (
        <div className="pointer-events-none absolute inset-x-0 top-[30%] z-30 flex flex-col items-center anim-fade-in">
          <div className="font-display text-3xl sm:text-5xl font-black tracking-[0.18em] text-red-500 title-glow" style={{ animation: "bossShake 0.25s linear infinite" }}>
            {bossWarn.name}
          </div>
          <div className="font-display mt-2 text-sm sm:text-lg tracking-[0.35em] text-red-200/80 uppercase">{bossWarn.title}</div>
          <div className="mt-3 h-px w-64 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
        </div>
      )}

      {/* ---------- screens ---------- */}
      {phase === "menu" && save && (
        <MainMenu
          save={save}
          onPlay={() => setPhaseBoth("characters")}
          onShop={() => setPhaseBoth("shop")}
          onHowTo={() => setPhaseBoth("howto")}
          onMute={toggleMute}
        />
      )}
      {phase === "characters" && (
        <CharacterSelect
          sel={selChar}
          onSel={setSelChar}
          onBack={() => setPhaseBoth("menu")}
          onStart={() => startRun(selChar)}
        />
      )}
      {phase === "shop" && save && (
        <Shop save={save} onBuy={buyUpgrade} onBack={() => setPhaseBoth("menu")} />
      )}
      {phase === "howto" && <HowTo onBack={() => setPhaseBoth("menu")} />}

      {phase === "levelup" && (
        <LevelUpModal options={options} onPick={(o) => gameRef.current?.applyUpgrade(o)} level={hud?.level ?? 1} />
      )}
      {phase === "chest" && <ChestModal rewards={chestRewards} onClose={() => gameRef.current?.ackChest()} />}
      {phase === "paused" && hud && (
        <PauseModal
          hud={hud}
          muted={save?.muted ?? false}
          onResume={() => gameRef.current?.resume()}
          onQuit={quitToMenu}
          onMute={toggleMute}
        />
      )}
      {(phase === "gameover" || phase === "victory") && runStats && (
        <EndScreen stats={runStats} onRetry={() => setPhaseBoth("characters")} onMenu={quitToMenu} />
      )}
    </div>
  );
}

// =====================================================================
// menu backdrop (canvas) — drifting embers over a dark gradient
// =====================================================================

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

// =====================================================================
// HUD
// =====================================================================

function Hud({ hud, onPause }: { hud: HudState; onPause: () => void }) {
  const xpFrac = Math.min(1, hud.xp / hud.xpNext);
  const hpFrac = Math.max(0, hud.hp / hud.maxHp);
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* XP bar */}
      <div className="absolute inset-x-0 top-0 h-[14px] bg-black/70 border-b border-white/10">
        <div
          className="h-full bg-gradient-to-r from-sky-500 via-indigo-400 to-fuchsia-400 transition-[width] duration-200"
          style={{ width: `${xpFrac * 100}%`, boxShadow: "0 0 12px rgba(99,102,241,0.8)" }}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-wider text-white/90">
          LV {hud.level}
        </div>
      </div>

      {/* timer */}
      <div className="absolute left-1/2 top-6 -translate-x-1/2 text-center">
        <div className="font-display text-3xl sm:text-4xl font-bold tracking-[0.15em] text-white/95" style={{ textShadow: "0 0 14px rgba(140,120,255,0.6), 0 2px 0 #000" }}>
          {fmtTime(hud.time)}
        </div>
      </div>

      {/* kills + gold */}
      <div className="absolute right-2 top-6 flex flex-col items-end gap-1 text-sm font-semibold">
        <div className="rounded bg-black/55 px-2 py-0.5 text-red-300">💀 {hud.kills}</div>
        <div className="rounded bg-black/55 px-2 py-0.5 text-amber-300">🪙 {hud.gold}</div>
        <button
          data-ui
          onClick={onPause}
          className="btn-ghost pointer-events-auto mt-1 rounded-md px-3 py-1 text-xs"
        >
          ⏸ PAUSE
        </button>
      </div>

      {/* HP + items */}
      <div className="absolute left-2 top-6 flex flex-col gap-1.5">
        <div className="h-[14px] w-40 sm:w-52 overflow-hidden rounded border border-black/60 bg-black/60">
          <div
            className={`h-full transition-[width] duration-200 ${hpFrac > 0.35 ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : "bg-gradient-to-r from-red-700 to-red-500 anim-pulse-glow"}`}
            style={{ width: `${hpFrac * 100}%` }}
          />
          <div className="absolute mt-[-14px] h-[14px] w-40 sm:w-52 text-center text-[10px] font-bold leading-[14px] text-white/95">
            {hud.hp} / {hud.maxHp}
          </div>
        </div>
        <div className="flex max-w-[180px] flex-wrap gap-1">
          {hud.weapons.map((w, i) => (
            <div key={i} className={`relative flex h-7 w-7 items-center justify-center rounded border text-sm ${w.evolved ? "border-pink-400/70 bg-pink-950/60" : "border-white/20 bg-black/55"}`}>
              {w.icon}
              <span className="absolute -bottom-1 -right-1 rounded bg-black/85 px-0.5 text-[8px] font-bold leading-tight text-amber-300">{w.evolved ? "★" : w.level}</span>
            </div>
          ))}
        </div>
        <div className="flex max-w-[180px] flex-wrap gap-1">
          {hud.passives.map((p, i) => (
            <div key={i} className="relative flex h-6 w-6 items-center justify-center rounded border border-indigo-300/25 bg-black/45 text-xs">
              {p.icon}
              <span className="absolute -bottom-1 -right-1 rounded bg-black/85 px-0.5 text-[8px] font-bold leading-tight text-indigo-300">{p.level}</span>
            </div>
          ))}
        </div>
      </div>

      {/* boss bar */}
      {hud.boss && (
        <div className="absolute inset-x-0 bottom-4 mx-auto w-[min(620px,92%)]">
          <div className="mb-1 text-center font-display text-xs sm:text-sm font-bold tracking-[0.25em] text-red-300 uppercase" style={{ textShadow: "0 0 10px rgba(255,40,40,0.7)" }}>
            {hud.boss.name}
          </div>
          <div className="h-[16px] overflow-hidden rounded border border-red-900 bg-black/75">
            <div
              className="h-full bg-gradient-to-r from-red-800 via-red-500 to-red-600 transition-[width] duration-150"
              style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%`, boxShadow: "0 0 14px rgba(255,30,30,0.7)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Screens
// =====================================================================

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div data-ui className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto nice-scroll p-4">
      {children}
    </div>
  );
}

function MainMenu({ save, onPlay, onShop, onHowTo, onMute }: {
  save: MetaSave;
  onPlay: () => void;
  onShop: () => void;
  onHowTo: () => void;
  onMute: () => void;
}) {
  return (
    <Screen>
      <div className="anim-fade-in-up flex w-full max-w-xl flex-col items-center text-center">
        <div className="font-display text-base tracking-[0.5em] text-purple-300/70">N I G H T F A L L</div>
        <h1 className="font-display title-glow mt-1 text-6xl sm:text-7xl font-black tracking-wider text-red-500">NORPEK</h1>
        <div className="font-display mt-2 text-lg tracking-[0.35em] text-amber-200/90">SURVIVORS</div>
        <p className="mt-4 max-w-md text-sm text-zinc-400">
          The dark holds its breath for thirty minutes. Survive the horde, fell the three harbingers, and strike down Death itself to reclaim the dawn.
        </p>

        <div className="mt-8 flex w-64 flex-col gap-3">
          <button className="btn-gold rounded-lg py-3 text-lg font-bold" onClick={onPlay}>⚔ BEGIN THE HUNT</button>
          <button className="btn-ghost rounded-lg py-2.5" onClick={onShop}>🜲 POWER-UPS</button>
          <button className="btn-ghost rounded-lg py-2.5" onClick={onHowTo}>📜 HOW TO PLAY</button>
          <button className="btn-ghost rounded-lg py-2" onClick={onMute}>{save.muted ? "🔇 UNMUTE" : "🔊 MUTE"}</button>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-zinc-500">
          <span>🪙 <span className="text-amber-300 font-semibold">{save.gold}</span> gold</span>
          <span>⏱ best {fmtTime(save.bestTime)}</span>
          <span>💀 {save.totalKills.toLocaleString()} slain</span>
          <span>🏆 {save.wins} {save.wins === 1 ? "dawn" : "dawns"} reclaimed</span>
        </div>
      </div>
    </Screen>
  );
}

function CharacterSelect({ sel, onSel, onBack, onStart }: {
  sel: CharacterId;
  onSel: (c: CharacterId) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <Screen>
      <div className="anim-fade-in-up w-full max-w-3xl">
        <h2 className="font-display text-center text-3xl font-bold tracking-[0.2em] text-amber-200">CHOOSE YOUR HUNTER</h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHARACTERS.map((c) => (
            <div
              key={c.id}
              className={`choice-card p-4 ${sel === c.id ? "selected" : ""}`}
              onClick={() => onSel(c.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-3xl">{c.icon}</div>
                <div>
                  <div className="font-display text-lg font-bold" style={{ color: c.color }}>{c.name}</div>
                  <div className="text-xs tracking-[0.2em] text-zinc-400 uppercase">{c.title}</div>
                </div>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{c.desc}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-emerald-300/90">
                {c.bonuses.map((b) => (
                  <li key={b}>◆ {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn-ghost rounded-lg px-6 py-2.5" onClick={onBack}>← BACK</button>
          <button className="btn-gold rounded-lg px-10 py-2.5 text-lg font-bold" onClick={onStart}>HUNT ⚔</button>
        </div>
      </div>
    </Screen>
  );
}

function Shop({ save, onBuy, onBack }: { save: MetaSave; onBuy: (id: string) => void; onBack: () => void }) {
  return (
    <Screen>
      <div className="anim-fade-in-up w-full max-w-3xl">
        <h2 className="font-display text-center text-3xl font-bold tracking-[0.2em] text-amber-200">POWER-UPS</h2>
        <p className="mt-1 text-center text-sm text-zinc-400">
          Permanent blessings, paid in gold. <span className="text-amber-300 font-semibold">🪙 {save.gold}</span>
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {META_UPGRADES.map((u) => {
            const lvl = save.upgrades[u.id] ?? 0;
            const maxed = lvl >= u.maxLevel;
            const cost = metaUpgradeCost(u, lvl);
            const afford = save.gold >= cost;
            return (
              <div key={u.id} className="panel flex flex-col p-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{u.icon}</span>
                  <span className="font-display text-sm font-bold text-zinc-100">{u.name}</span>
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">{u.desc}</div>
                <div className="mt-2 flex gap-1">
                  {Array.from({ length: u.maxLevel }).map((_, i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded ${i < lvl ? "bg-amber-400" : "bg-white/10"}`} />
                  ))}
                </div>
                <button
                  className="btn-gold mt-2.5 rounded-md py-1.5 text-xs font-bold disabled:opacity-100"
                  disabled={maxed || !afford}
                  onClick={() => onBuy(u.id)}
                >
                  {maxed ? "MAXED" : `🪙 ${cost}`}
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex justify-center">
          <button className="btn-ghost rounded-lg px-6 py-2.5" onClick={onBack}>← BACK</button>
        </div>
      </div>
    </Screen>
  );
}

function HowTo({ onBack }: { onBack: () => void }) {
  return (
    <Screen>
      <div className="anim-fade-in-up panel w-full max-w-lg p-6">
        <h2 className="font-display text-center text-2xl font-bold tracking-[0.2em] text-amber-200">HOW TO PLAY</h2>
        <div className="mt-4 space-y-3 text-sm text-zinc-300">
          <p>🕹 <b>Move</b> with <b>WASD</b> / arrow keys — or touch &amp; drag anywhere on mobile. Your weapons attack on their own.</p>
          <p>💎 Collect <b>gems</b> from the fallen to level up, then choose new weapons and passives. You can carry 6 of each.</p>
          <p>⭐ Max out a weapon and hold its paired passive, then open a <b>treasure chest</b> (dropped by crowned elites) to <b>evolve</b> it into something monstrous.</p>
          <p>👑 Harbingers arrive at <b>5:00</b> and <b>15:00</b>. At <b>30:00</b>, <b>Death itself</b> comes for you — slay it to win the night.</p>
          <p>🪙 Gold persists between runs. Spend it on permanent <b>Power-Ups</b>.</p>
          <p>⏸ Press <b>ESC</b> or <b>P</b> to pause.</p>
        </div>
        <div className="mt-5 flex justify-center">
          <button className="btn-ghost rounded-lg px-6 py-2.5" onClick={onBack}>← BACK</button>
        </div>
      </div>
    </Screen>
  );
}

function LevelUpModal({ options, onPick, level }: { options: UpgradeOption[]; onPick: (o: UpgradeOption) => void; level: number }) {
  return (
    <div data-ui className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-4 anim-fade-in">
      <div className="anim-fade-in-up w-full max-w-2xl">
        <div className="text-center">
          <div className="font-display gold-text text-3xl font-black tracking-[0.2em]">LEVEL UP!</div>
          <div className="mt-1 text-xs tracking-[0.3em] text-zinc-400">LEVEL {level} — CHOOSE YOUR BOON</div>
        </div>
        <div className={`mt-5 grid gap-3 ${options.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"} grid-cols-1`}>
          {options.map((o, i) => (
            <button
              key={`${o.id}-${i}`}
              className={`choice-card p-4 text-left ${o.isNew ? "is-new" : ""}`}
              style={{ animationDelay: `${i * 70}ms` }}
              onClick={() => onPick(o)}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{o.icon}</span>
                {o.isNew ? (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-300">NEW!</span>
                ) : (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">LV {o.level}</span>
                )}
              </div>
              <div className="font-display mt-2 text-base font-bold" style={{ color: o.color }}>{o.name}</div>
              {o.maxLevel > 0 && (
                <div className="mt-1.5 flex gap-0.5">
                  {Array.from({ length: o.maxLevel }).map((_, j) => (
                    <div key={j} className={`h-1 flex-1 rounded ${j < o.level ? "bg-amber-400" : "bg-white/10"}`} />
                  ))}
                </div>
              )}
              <div className="mt-2 text-xs leading-relaxed text-zinc-400">{o.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChestModal({ rewards, onClose }: { rewards: ChestReward[]; onClose: () => void }) {
  const hasEvo = rewards.some((r) => r.isEvolution);
  return (
    <div data-ui className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4 anim-fade-in">
      <div className="anim-fade-in-up panel w-full max-w-md p-6 text-center" style={hasEvo ? { borderColor: "rgba(244,114,182,0.6)", boxShadow: "0 0 50px rgba(244,114,182,0.25)" } : undefined}>
        <div className="text-6xl" style={{ filter: "drop-shadow(0 0 18px rgba(240,199,94,0.8))" }}>{hasEvo ? "✨" : "🎁"}</div>
        <div className={`font-display mt-2 text-2xl font-black tracking-[0.2em] ${hasEvo ? "text-pink-300" : "gold-text"}`}>
          {hasEvo ? "EVOLUTION!" : "TREASURE!"}
        </div>
        <div className="mt-4 space-y-2 text-left">
          {rewards.map((r, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-lg border p-2.5 ${r.isEvolution ? "border-pink-400/50 bg-pink-950/40" : "border-white/10 bg-white/5"}`} style={{ animation: `fadeInUp 0.3s ease both`, animationDelay: `${i * 120}ms` }}>
              <span className="text-2xl">{r.icon}</span>
              <div>
                <div className={`text-sm font-bold ${r.isEvolution ? "text-pink-200" : "text-zinc-100"}`}>{r.name}</div>
                <div className="text-[11px] text-zinc-400">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-gold mt-5 w-full rounded-lg py-2.5 font-bold" onClick={onClose}>CONTINUE</button>
      </div>
    </div>
  );
}

function PauseModal({ hud, muted, onResume, onQuit, onMute }: {
  hud: HudState;
  muted: boolean;
  onResume: () => void;
  onQuit: () => void;
  onMute: () => void;
}) {
  return (
    <div data-ui className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4 anim-fade-in">
      <div className="anim-fade-in-up panel w-full max-w-sm p-6 text-center">
        <div className="font-display text-3xl font-black tracking-[0.25em] text-zinc-100">PAUSED</div>
        <div className="mt-2 text-xs text-zinc-400">{fmtTime(hud.time)} — LV {hud.level} — 💀 {hud.kills}</div>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {hud.weapons.map((w, i) => (
            <span key={i} className={`rounded border px-1.5 py-0.5 text-sm ${w.evolved ? "border-pink-400/60" : "border-white/15"}`}>{w.icon}{w.evolved ? "★" : w.level}</span>
          ))}
          {hud.passives.map((p, i) => (
            <span key={i} className="rounded border border-indigo-300/25 px-1.5 py-0.5 text-sm">{p.icon}{p.level}</span>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-2.5">
          <button className="btn-gold rounded-lg py-2.5 font-bold" onClick={onResume}>RESUME</button>
          <button className="btn-ghost rounded-lg py-2" onClick={onMute}>{muted ? "🔇 UNMUTE" : "🔊 MUTE"}</button>
          <button className="btn-ghost rounded-lg py-2 text-red-300" onClick={onQuit}>ABANDON RUN</button>
        </div>
      </div>
    </div>
  );
}

function EndScreen({ stats, onRetry, onMenu }: { stats: RunStats; onRetry: () => void; onMenu: () => void }) {
  const won = stats.won;
  return (
    <div data-ui className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-4 anim-fade-in">
      <div className="anim-fade-in-up w-full max-w-md text-center">
        {won ? (
          <>
            <div className="text-6xl" style={{ filter: "drop-shadow(0 0 24px rgba(240,199,94,0.9))" }}>🌅</div>
            <h2 className="font-display gold-text mt-3 text-5xl font-black tracking-[0.15em]">DAWN RECLAIMED</h2>
            <p className="mt-2 text-sm text-amber-100/80">Death itself has fallen to your blade. The night is over.</p>
          </>
        ) : (
          <>
            <div className="text-6xl" style={{ filter: "drop-shadow(0 0 24px rgba(196,58,58,0.9))" }}>💀</div>
            <h2 className="font-display title-glow mt-3 text-5xl font-black tracking-[0.15em] text-red-500">YOU DIED</h2>
            <p className="mt-2 text-sm text-zinc-400">The dark claims another hunter{stats.time >= GAME_DURATION ? " — at the very threshold of dawn." : "."}</p>
          </>
        )}
        <div className="panel mx-auto mt-6 grid grid-cols-2 gap-x-6 gap-y-2.5 p-5 text-left text-sm">
          <Stat label="Survived" value={fmtTime(Math.min(stats.time, GAME_DURATION))} />
          <Stat label="Level" value={`${stats.level}`} />
          <Stat label="Slain" value={stats.kills.toLocaleString()} />
          <Stat label="Damage" value={Math.round(stats.damageDealt).toLocaleString()} />
          <Stat label="Gold earned" value={`🪙 ${stats.gold}`} />
          <Stat label="Verdict" value={won ? "LEGEND" : "FALLEN"} />
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn-gold rounded-lg px-8 py-2.5 font-bold" onClick={onRetry}>{won ? "HUNT AGAIN" : "RETRY"}</button>
          <button className="btn-ghost rounded-lg px-6 py-2.5" onClick={onMenu}>MENU</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</div>
      <div className="font-display text-lg font-bold text-zinc-100">{value}</div>
    </div>
  );
}
