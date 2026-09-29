// World renderer — camera-follow canvas drawing with prerendered sprites,
// procedural gothic ground props, dynamic lights, particles and FX.

import type { Game } from "./engine";
import {
  enemySprite,
  enemyFlashSprite,
  enemyFrozenSprite,
  bossSprite,
  bossFlashSprite,
  playerSprite,
  gemSprite,
  coinSprite,
  meatSprite,
  chestSprite,
  magnetSprite,
  bombSprite,
  arrowSprite,
  shardSprite,
  fireballSprite,
  enemyBulletSprite,
  daggerSprite,
} from "./sprites";
import { MINI_BOSSES } from "./data";
import { JOYSTICK_RADIUS } from "./input";
import type { GameSettings } from "./settings";

export function combatViewport(width: number, height: number) {
  const scale = Math.max(0.5, Math.min(1.5, Math.min(width, height) / 600));
  return { scale, width: width / scale, height: height / scale };
}

const TAU = Math.PI * 2;

type MarkerKind = "boss" | "miniBoss" | "covenant" | "elite" | "chest";
export type ObjectiveMarker = { kind: MarkerKind; x: number; y: number; angle: number };
const MARKER_W = 88, MARKER_H = 32;

/** Pure CSS-pixel layout. One target per kind, at most three badges, no hidden world-state updates. */
export function offscreenMarkers(g: Game, width: number, height: number, settings: GameSettings): ObjectiveMarker[] {
  if (["menu", "characters", "shop", "howto", "gameover", "victory"].includes(g.phase)) return [];
  const { scale } = combatViewport(width, height);
  const candidates: { kind: MarkerKind; x: number; y: number; distance: number }[] = [];
  const consider = (kind: MarkerKind, worldX: number, worldY: number, radius: number) => {
    const x = (worldX - g.camX) * scale + width / 2, y = (worldY - g.camY) * scale + height / 2;
    const r = radius * scale;
    if (x + r >= 0 && x - r <= width && y + r >= 0 && y - r <= height) return;
    const distance = (worldX - g.px) ** 2 + (worldY - g.py) ** 2;
    const previous = candidates.find(c => c.kind === kind);
    if (!previous) candidates.push({ kind, x, y, distance });
    else if (distance < previous.distance) Object.assign(previous, { x, y, distance });
  };
  if (g.boss && g.boss.hp > 0) consider("boss", g.boss.x, g.boss.y, g.boss.def.radius);
  for (const enemy of g.enemies) if (enemy.active && enemy.miniBossId && enemy.hp > 0) consider("miniBoss", enemy.x, enemy.y, enemy.radius);
  if (g.covenant?.status === "active") consider("covenant", g.covenant.x, g.covenant.y, 24);
  for (const enemy of g.enemies) if (enemy.active && enemy.elite && !enemy.miniBossId && enemy.hp > 0) consider("elite", enemy.x, enemy.y, enemy.radius);
  for (const pickup of g.pickups) if (pickup.active && pickup.kind === "chest") consider("chest", pickup.x, pickup.y, 20);

  // Reserve the HUD/equipment/covenant band above, and boss bar below.
  const landscape = height <= 500 && width > height;
  const left = MARKER_W / 2 + 12, right = width - left;
  const top = (landscape ? 150 : 194) + MARKER_H / 2, bottom = height - 64 - MARKER_H / 2;
  if (right <= left || bottom <= top) return [];
  const obstacles: { left: number; right: number; top: number; bottom: number }[] = [];
  const joystick = g.input.joystick;
  if (joystick.active || settings.joystickMode === "fixed") {
    const x = joystick.active ? joystick.originX : settings.joystickSide === "left" ? 86 : width - 86;
    const y = joystick.active ? joystick.originY : height - 100;
    const r = JOYSTICK_RADIUS + 26;
    obstacles.push({ left: x - r, right: x + r, top: y - r, bottom: y + r });
  }
  if (!settings.onboardingComplete) {
    const panelWidth = Math.min(landscape ? 380 : 470, width - 32);
    const panelLeft = landscape ? width - 14 - panelWidth : (width - panelWidth) / 2;
    obstacles.push({ left: panelLeft - 8, right: panelLeft + panelWidth + 8, top: height - (landscape ? 185 : 225), bottom: height });
  }
  const markers: ObjectiveMarker[] = [];
  const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
  for (const target of candidates) {
    if (markers.length === 3) break;
    const dx = target.x - centerX, dy = target.y - centerY;
    const tx = dx === 0 ? Infinity : (dx > 0 ? right - centerX : left - centerX) / dx;
    const ty = dy === 0 ? Infinity : (dy > 0 ? bottom - centerY : top - centerY) / dy;
    const verticalEdge = tx < ty, t = Math.min(tx, ty);
    const baseX = centerX + dx * t, baseY = centerY + dy * t;
    const step = verticalEdge ? MARKER_H + 8 : MARKER_W + 8;
    // Search along the same edge; never move a badge across the battlefield or onto controls.
    const slots = Math.ceil((verticalEdge ? bottom - top : right - left) / step);
    for (let slot = 0; slot <= slots * 2; slot++) {
      const offset = slot === 0 ? 0 : Math.ceil(slot / 2) * step * (slot % 2 ? 1 : -1);
      const x = Math.max(left, Math.min(right, baseX + (verticalEdge ? 0 : offset)));
      const y = Math.max(top, Math.min(bottom, baseY + (verticalEdge ? offset : 0)));
      const box = { left: x - MARKER_W / 2 - 4, right: x + MARKER_W / 2 + 4, top: y - MARKER_H / 2 - 4, bottom: y + MARKER_H / 2 + 4 };
      if (obstacles.some(o => box.left < o.right && box.right > o.left && box.top < o.bottom && box.bottom > o.top)) continue;
      markers.push({ kind: target.kind, x, y, angle: Math.atan2(target.y - y, target.x - (x + 34)) });
      obstacles.push(box);
      break;
    }
  }
  return markers;
}

function drawObjectiveMarkers(ctx: CanvasRenderingContext2D, markers: ObjectiveMarker[], highContrast: boolean) {
  const colors: Record<MarkerKind, string> = { boss: "#ffaf9c", miniBoss: "#f2bfff", elite: "#ffc583", covenant: "#d3b6ff", chest: "#f6df8c" };
  const labels: Record<MarkerKind, string> = { boss: "BOSS", miniBoss: "MINIBOSS", elite: "ELITE", covenant: "RITUAL", chest: "CHEST" };
  for (const marker of markers) {
    ctx.save(); ctx.translate(marker.x, marker.y);
    ctx.fillStyle = "#0b0c15"; ctx.strokeStyle = highContrast ? "#ffffff" : colors[marker.kind]; ctx.lineWidth = highContrast ? 2 : 1;
    ctx.fillRect(-MARKER_W / 2, -MARKER_H / 2, MARKER_W, MARKER_H);
    ctx.strokeRect(-MARKER_W / 2, -MARKER_H / 2, MARKER_W, MARKER_H);
    ctx.fillStyle = ctx.strokeStyle; ctx.font = `bold ${marker.kind === "miniBoss" ? 9 : 10}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(labels[marker.kind], 2, 1);
    ctx.beginPath();
    if (marker.kind === "boss") { ctx.moveTo(-29, -7); ctx.lineTo(-36, 6); ctx.lineTo(-22, 6); ctx.closePath(); }
    else if (marker.kind === "miniBoss") { ctx.moveTo(-36, 5); ctx.lineTo(-36, -5); ctx.lineTo(-32, -1); ctx.lineTo(-29, -7); ctx.lineTo(-26, -1); ctx.lineTo(-22, -5); ctx.lineTo(-22, 5); ctx.closePath(); }
    else if (marker.kind === "elite") { ctx.moveTo(-29, -7); ctx.lineTo(-22, 0); ctx.lineTo(-29, 7); ctx.lineTo(-36, 0); ctx.closePath(); }
    else if (marker.kind === "covenant") { ctx.arc(-29, 0, 6, 0, TAU); ctx.moveTo(-29, -9); ctx.lineTo(-29, 9); ctx.moveTo(-37, 0); ctx.lineTo(-21, 0); }
    else { ctx.rect(-36, -5, 14, 11); ctx.moveTo(-36, -1); ctx.lineTo(-22, -1); ctx.moveTo(-29, -3); ctx.lineTo(-29, 3); }
    ctx.stroke();
    ctx.translate(34, 0); ctx.rotate(marker.angle); ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- ground

let groundTile: HTMLCanvasElement | null = null;

function getGroundTile(): HTMLCanvasElement {
  if (groundTile) return groundTile;
  const s = 256;
  const cv = document.createElement("canvas");
  cv.width = s;
  cv.height = s;
  const c = cv.getContext("2d")!;
  // base
  c.fillStyle = "#0d1019";
  c.fillRect(0, 0, s, s);
  // mottled patches — drawn with wrap-around so tile edges are seamless
  for (let i = 0; i < 38; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = 12 + Math.random() * 36;
    const shade = Math.random();
    for (const wx of [-s, 0, s]) {
      for (const wy of [-s, 0, s]) {
        const px = x + wx;
        const py = y + wy;
        if (px < -r || px > s + r || py < -r || py > s + r) continue;
        const g = c.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, shade < 0.5 ? "rgba(26,33,50,0.55)" : "rgba(9,11,20,0.55)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(px, py, r, 0, TAU);
        c.fill();
      }
    }
  }
  // cracked stone lines
  c.strokeStyle = "rgba(52,62,90,0.3)";
  c.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    c.beginPath();
    let x = Math.random() * s;
    let y = Math.random() * s;
    c.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (Math.random() - 0.5) * 70;
      y += (Math.random() - 0.5) * 70;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  // tiny pebbles / bones
  for (let i = 0; i < 26; i++) {
    c.fillStyle = Math.random() < 0.3 ? "rgba(120,125,140,0.16)" : "rgba(30,36,55,0.4)";
    c.beginPath();
    c.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 0, TAU);
    c.fill();
  }
  groundTile = cv;
  return cv;
}

// ---------------------------------------------------------------- props

type Prop = { kind: number; ox: number; oy: number; scale: number };
const propCache = new Map<string, Prop[]>();
const PROP_CELL = 320;

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = (h * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function propsForCell(cx: number, cy: number): Prop[] {
  const key = `${cx}:${cy}`;
  const hit = propCache.get(key);
  if (hit) return hit;
  if (propCache.size > 400) propCache.clear();
  const out: Prop[] = [];
  const r0 = hash2(cx, cy);
  const count = r0 < 0.35 ? 0 : r0 < 0.8 ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const r1 = hash2(cx * 7 + i, cy * 13 - i);
    const r2 = hash2(cx * 17 - i, cy * 5 + i);
    const r3 = hash2(cx * 29 + i * 3, cy * 31 + i * 7);
    out.push({
      kind: Math.floor(r3 * 6),
      ox: r1 * PROP_CELL,
      oy: r2 * PROP_CELL,
      scale: 0.8 + r3 * 0.5,
    });
  }
  propCache.set(key, out);
  return out;
}

function drawProp(c: CanvasRenderingContext2D, p: Prop, x: number, y: number, time: number) {
  c.save();
  c.translate(x, y);
  c.scale(p.scale, p.scale);
  switch (p.kind) {
    case 0: {
      // tombstone
      c.fillStyle = "#262c3e";
      c.beginPath();
      c.moveTo(-9, 12);
      c.lineTo(-9, -8);
      c.quadraticCurveTo(0, -18, 9, -8);
      c.lineTo(9, 12);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(90,100,130,0.5)";
      c.lineWidth = 1.5;
      c.stroke();
      c.strokeStyle = "rgba(120,130,160,0.5)";
      c.beginPath();
      c.moveTo(-4, -4);
      c.lineTo(4, -4);
      c.moveTo(0, -8);
      c.lineTo(0, 2);
      c.stroke();
      break;
    }
    case 1: {
      // dead tree
      c.strokeStyle = "#1d2230";
      c.lineWidth = 5;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(0, 18);
      c.lineTo(0, -14);
      c.stroke();
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, -4);
      c.lineTo(-12, -20);
      c.moveTo(0, -10);
      c.lineTo(11, -24);
      c.moveTo(-12, -20);
      c.lineTo(-18, -22);
      c.stroke();
      break;
    }
    case 2: {
      // rocks
      c.fillStyle = "#222838";
      c.beginPath();
      c.ellipse(0, 4, 11, 7, 0, 0, TAU);
      c.fill();
      c.fillStyle = "#2b3247";
      c.beginPath();
      c.ellipse(7, 7, 6, 4, 0, 0, TAU);
      c.fill();
      break;
    }
    case 3: {
      // bones
      c.strokeStyle = "rgba(190,185,165,0.4)";
      c.lineWidth = 2.5;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-8, 0);
      c.lineTo(8, 4);
      c.moveTo(-2, -6);
      c.lineTo(4, 8);
      c.stroke();
      c.fillStyle = "rgba(190,185,165,0.45)";
      c.beginPath();
      c.arc(-8, 0, 2.4, 0, TAU);
      c.arc(8, 4, 2.4, 0, TAU);
      c.fill();
      break;
    }
    case 4: {
      // torch — flickering light
      const fl = 0.85 + Math.sin(time * 9 + p.ox) * 0.15;
      c.strokeStyle = "#3a3040";
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(0, 14);
      c.lineTo(0, -8);
      c.stroke();
      const g = c.createRadialGradient(0, -12, 0, 0, -12, 38 * fl);
      g.addColorStop(0, "rgba(255,170,60,0.30)");
      g.addColorStop(1, "rgba(255,120,20,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, -12, 38 * fl, 0, TAU);
      c.fill();
      c.fillStyle = "#ffb84d";
      c.shadowColor = "#ff7b00";
      c.shadowBlur = 10;
      c.beginPath();
      c.ellipse(0, -12, 3.4, 5.5 * fl, 0, 0, TAU);
      c.fill();
      break;
    }
    case 5: {
      // mushroom cluster (eerie glow)
      c.fillStyle = "#3a7d6e";
      c.shadowColor = "#2dd4bf";
      c.shadowBlur = 6;
      [[-5, 4, 4], [3, 6, 3], [0, -1, 5]].forEach(([x, y, r]) => {
        c.beginPath();
        c.arc(x, y, r, Math.PI, 0);
        c.fill();
      });
      break;
    }
  }
  c.restore();
}

// ---------------------------------------------------------------- vignette

let vignetteCv: HTMLCanvasElement | null = null;
let vignetteKey = "";
function getVignette(W: number, H: number, prog: number): HTMLCanvasElement {
  const bucket = Math.round(prog * 40); // regenerate ~every 45s of game time
  const key = `${W}x${H}:${bucket}`;
  if (vignetteCv && vignetteKey === key) return vignetteCv;
  vignetteKey = key;
  if (!vignetteCv || vignetteCv.width !== W || vignetteCv.height !== H) {
    vignetteCv = document.createElement("canvas");
  }
  vignetteCv.width = W;
  vignetteCv.height = H;
  const c = vignetteCv.getContext("2d")!;
  const p = bucket / 40;
  const rTint = Math.round(20 + p * 60);
  const overlay = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
  overlay.addColorStop(0, "rgba(0,0,0,0)");
  overlay.addColorStop(1, `rgba(${rTint},6,${Math.round(28 - p * 16)},${0.5 + p * 0.12})`);
  c.fillStyle = overlay;
  c.fillRect(0, 0, W, H);
  return vignetteCv;
}

// ---------------------------------------------------------------- main draw

export function renderGame(g: Game, ctx: CanvasRenderingContext2D, screenW: number, screenH: number, settings: GameSettings) {
  const viewport = combatViewport(screenW, screenH);
  const W = viewport.width, H = viewport.height;
  ctx.save();
  ctx.scale(viewport.scale, viewport.scale);
  const now = g.time;
  const calmEffects = settings.reducedMotion || !settings.screenFlash;
  // camera with shake
  const shx = settings.screenShake && !settings.reducedMotion ? Math.sin(now * 97) * g.shake * 7 : 0;
  const shy = settings.screenShake && !settings.reducedMotion ? Math.cos(now * 113) * g.shake * 7 : 0;
  const camX = g.camX + shx;
  const camY = g.camY + shy;
  const ox = W / 2 - camX;
  const oy = H / 2 - camY;

  // ---- ground
  const tile = getGroundTile();
  const ts = 256;
  const startX = Math.floor((camX - W / 2) / ts) * ts;
  const startY = Math.floor((camY - H / 2) / ts) * ts;
  for (let x = startX; x < camX + W / 2 + ts; x += ts) {
    for (let y = startY; y < camY + H / 2 + ts; y += ts) {
      ctx.drawImage(tile, Math.floor(x + ox), Math.floor(y + oy));
    }
  }

  // ---- props
  const pc0x = Math.floor((camX - W / 2 - 60) / PROP_CELL);
  const pc1x = Math.floor((camX + W / 2 + 60) / PROP_CELL);
  const pc0y = Math.floor((camY - H / 2 - 60) / PROP_CELL);
  const pc1y = Math.floor((camY + H / 2 + 60) / PROP_CELL);
  for (let cx = pc0x; cx <= pc1x; cx++) {
    for (let cy = pc0y; cy <= pc1y; cy++) {
      for (const p of propsForCell(cx, cy)) {
        drawProp(ctx, p, cx * PROP_CELL + p.ox + ox, cy * PROP_CELL + p.oy + oy, calmEffects ? 0 : now);
      }
    }
  }

  // Covenant boundaries communicate exactly where defeated foes count.
  if (g.covenant?.status === "active") {
    const c = g.covenant;
    ctx.save(); ctx.strokeStyle = "#cdb5f1"; ctx.lineWidth = 3;
    ctx.fillStyle = "rgba(144,105,210,0.055)";
    ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.arc(c.x + ox, c.y + oy, 300, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = "#eddbff"; ctx.font = "600 16px Georgia, serif"; ctx.textAlign = "center";
    ctx.fillText("✧", c.x + ox, c.y + oy); ctx.restore();
  }

  // ---- telegraphs (under everything else)
  for (const f of g.fx) {
    if (f.kind !== "telegraph") continue;
    const k = f.t / f.dur;
    ctx.save();
    if (f.shape === "line") {
      // line telegraph (dash)
      ctx.strokeStyle = `rgba(255,40,40,${0.25 + k * 0.3})`;
      ctx.lineWidth = f.radius * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(f.x + ox, f.y + oy);
      ctx.lineTo(f.x2 + ox, f.y2 + oy);
      ctx.stroke();
    } else {
      const tx = f.x + ox;
      const ty = f.y + oy;
      // faint danger fill that intensifies as impact nears
      const fillG = ctx.createRadialGradient(tx, ty, f.radius * 0.2, tx, ty, f.radius);
      fillG.addColorStop(0, `rgba(255,90,40,${0.03 + k * 0.05})`);
      fillG.addColorStop(1, `rgba(255,90,40,${0.10 + k * 0.12})`);
      ctx.fillStyle = fillG;
      ctx.beginPath();
      ctx.arc(tx, ty, f.radius, 0, TAU);
      ctx.fill();
      // A steady rim preserves the danger boundary when flashes are disabled.
      ctx.strokeStyle = `rgba(255,140,60,${settings.screenFlash && !settings.reducedMotion ? 0.55 + 0.3 * Math.sin(now * 14) : 0.8})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tx, ty, f.radius, 0, TAU);
      ctx.stroke();
      // rotating dashed countdown ring closing inward
      ctx.strokeStyle = "rgba(255,190,100,0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.lineDashOffset = settings.reducedMotion ? 0 : now * 60;
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(4, f.radius * (1 - k)), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // ---- aura ring (Holy Aura / Sanctuary)
  const auraW = g.weapons.find((w) => w.id === "aura");
  if (auraW) {
    const L = g.levelStats(auraW);
    const r = 92 * g.stats.area * L.area * (auraW.evolved ? 1.6 : 1);
    const pulse = calmEffects ? 1 : 1 + Math.sin(now * 5) * 0.025;
    const gx = g.px + ox;
    const gy = g.py + oy;
    const grad = ctx.createRadialGradient(gx, gy, r * 0.4, gx, gy, r * pulse);
    grad.addColorStop(0, "rgba(255,233,168,0.02)");
    grad.addColorStop(0.8, auraW.evolved ? "rgba(255,215,130,0.13)" : "rgba(255,233,168,0.09)");
    grad.addColorStop(1, "rgba(255,233,168,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, r * pulse, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = auraW.evolved ? "rgba(255,220,140,0.5)" : "rgba(255,233,168,0.32)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.lineDashOffset = settings.reducedMotion ? 0 : -now * 40;
    ctx.beginPath();
    ctx.arc(gx, gy, r * pulse, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- pickups
  for (const p of g.pickups) {
    if (!p.active) continue;
    const x = p.x + ox;
    const y = p.y + oy + Math.sin(p.bob) * 3;
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
    let spr: HTMLCanvasElement;
    switch (p.kind) {
      case "gem": spr = gemSprite(p.tier); break;
      case "coin": spr = coinSprite(); break;
      case "meat": spr = meatSprite(); break;
      case "magnet": spr = magnetSprite(); break;
      case "bomb": spr = bombSprite(); break;
      case "chest": spr = chestSprite(); break;
    }
    if (p.kind === "chest") {
      // beacon for chests
      ctx.fillStyle = `rgba(240,199,94,${0.12 + Math.sin(p.bob * 2) * 0.05})`;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, TAU);
      ctx.fill();
    }
    ctx.drawImage(spr, x - spr.width / 2, y - spr.height / 2);
  }

  // ---- enemies (sorted slightly by y for depth feel? skip for perf, fine)
  for (const e of g.enemies) {
    if (!e.active) continue;
    const x = e.x + ox;
    const y = e.y + oy;
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
    const frozen = e.slowT > 0 && e.slowF === 0;
    const spr = frozen ? enemyFrozenSprite(e.def, e.elite) : enemySprite(e.def, e.elite);
    const bob = settings.reducedMotion ? 1 : 1 + Math.sin(e.wobble) * 0.05;
    const spriteScale = e.miniBossId ? e.radius / (e.def.radius * (e.elite ? 1.9 : 1)) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((e.faceX < 0 ? -bob : bob) * spriteScale, (2 - bob) * spriteScale);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    if (e.hitFlash > 0 && settings.screenFlash && !settings.reducedMotion) {
      // Frequent area hits must not turn the horde into an opaque white wall.
      const flash = enemyFlashSprite(e.def, e.elite);
      ctx.globalAlpha = 0.28;
      ctx.drawImage(flash, -flash.width / 2, -flash.height / 2);
      ctx.globalAlpha = 1;
    }
    if (!frozen && e.slowT > 0 && e.hitFlash <= 0) {
      // chilled (not frozen): light ice tint
      ctx.globalAlpha = 0.4;
      ctx.drawImage(enemyFrozenSprite(e.def, e.elite), -spr.width / 2, -spr.height / 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (e.miniBossId) {
      // Stable double rim and crown distinguish named threats even without color.
      ctx.strokeStyle = "#0b0c15"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(x, y + e.radius * .5, e.radius + 5, e.radius * .45, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = settings.highContrast ? "#fff" : "#f2bfff"; ctx.lineWidth = 2; ctx.stroke();
      const crownY = y - e.radius - 3;
      ctx.beginPath(); ctx.moveTo(x - 10, crownY); ctx.lineTo(x - 10, crownY - 9); ctx.lineTo(x - 5, crownY - 5);
      ctx.lineTo(x, crownY - 13); ctx.lineTo(x + 5, crownY - 5); ctx.lineTo(x + 10, crownY - 9); ctx.lineTo(x + 10, crownY); ctx.closePath();
      ctx.fillStyle = "#f2bfff"; ctx.fill(); ctx.strokeStyle = "#0b0c15"; ctx.lineWidth = 2; ctx.stroke();
    }
    // Elite HP is local; mini-boss names are painted in CSS pixels above effects below.
    if (e.elite && !e.miniBossId) {
      const w = 44;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x - w / 2, y - e.radius - 14, w, 5);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(x - w / 2, y - e.radius - 14, (w * e.hp) / e.maxHp, 5);
    }
  }

  // ---- boss
  if (g.boss) {
    const b = g.boss;
    const x = b.x + ox;
    const y = b.y + oy;
    const spr = (b.hitFlash > 0 && settings.screenFlash && !settings.reducedMotion) || b.windup > 0 ? bossFlashSprite(b.def) : bossSprite(b.def);
    const bob = 1 + Math.sin(now * 3) * 0.03;
    // ground shadow ring
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(x, y + b.def.radius * 0.85, b.def.radius * 0.9, b.def.radius * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(b.faceX < 0 ? -bob : bob, 2 - bob);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    ctx.restore();
    if (b.enraged) {
      ctx.strokeStyle = `rgba(255,40,40,${settings.screenFlash && !settings.reducedMotion ? 0.4 + Math.sin(now * 10) * 0.2 : 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, b.def.radius + 12, 0, TAU);
      ctx.stroke();
    }
  }

  // ---- orbital daggers
  const dag = g.weapons.find((w) => w.id === "daggers");
  if (dag) {
    const L = g.levelStats(dag);
    const n = dag.evolved ? 8 : L.amount;
    const orbitR = (62 + 10 * L.area) * g.stats.area * (dag.evolved ? 1.5 : 1);
    for (let i = 0; i < n; i++) {
      const a = g.orbAngle + (i * TAU) / n;
      const x = g.px + Math.cos(a) * orbitR + ox;
      const y = g.py + Math.sin(a) * orbitR + oy;
      const dspr = daggerSprite(dag.evolved);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.drawImage(dspr, -dspr.width / 2, -dspr.height / 2);
      ctx.restore();
    }
    if (dag.evolved) {
      ctx.strokeStyle = "rgba(143,208,255,0.18)";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(g.px + ox, g.py + oy, orbitR, 0, TAU);
      ctx.stroke();
    }
  }

  // ---- player bullets
  for (const b of g.bullets) {
    if (!b.active) continue;
    const x = b.x + ox;
    const y = b.y + oy;
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
    ctx.save();
    ctx.translate(x, y);
    switch (b.kind) {
      case "arrow": {
        ctx.rotate(b.angle);
        const spr = arrowSprite(b.evolved);
        ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
        break;
      }
      case "orb": {
        const r = b.radius;
        const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
        if (b.evolved) {
          grad.addColorStop(0, "#0a0314");
          grad.addColorStop(0.65, "#4c1d95");
          grad.addColorStop(1, "rgba(139,92,246,0.25)");
        } else {
          grad.addColorStop(0, "#efe1ff");
          grad.addColorStop(0.6, "#a855f7");
          grad.addColorStop(1, "rgba(168,85,247,0.2)");
        }
        ctx.shadowColor = "#a855f7";
        ctx.shadowBlur = 16;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        // swirl
        ctx.strokeStyle = "rgba(220,200,255,0.5)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.65, b.angle, b.angle + 1.8);
        ctx.stroke();
        if (b.evolved) {
          ctx.strokeStyle = "rgba(168,85,247,0.3)";
          ctx.setLineDash([6, 10]);
          ctx.lineDashOffset = -now * 60;
          ctx.beginPath();
          ctx.arc(0, 0, b.aoe, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case "shard": {
        ctx.rotate(b.angle);
        const spr = shardSprite();
        ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
        break;
      }
      case "fireball": {
        const spr = fireballSprite(b.radius);
        ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
        break;
      }
      case "meteor": {
        ctx.shadowColor = "#ff5500";
        ctx.shadowBlur = 18;
        ctx.rotate(Math.atan2(b.vy, b.vx));
        const grad = ctx.createLinearGradient(-26, 0, 8, 0);
        grad.addColorStop(0, "rgba(255,120,20,0)");
        grad.addColorStop(1, "#ffd9a8");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(-8, 0, 20, 6, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#fff0c9";
        ctx.beginPath();
        ctx.arc(6, 0, 8, 0, TAU);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  // ---- enemy bullets
  for (const b of g.enemyBullets) {
    if (!b.active) continue;
    const x = b.x + ox;
    const y = b.y + oy;
    const spr = enemyBulletSprite(b.color);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(b.spin);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    ctx.restore();
  }

  // ---- player
  {
    const x = g.px + ox;
    const y = g.py + oy;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(x, y + 16, 12, 4.5, 0, 0, TAU);
    ctx.fill();
    const spr = playerSprite(g.charId);
    const bob = g.moving ? Math.sin(g.walkT) * 0.07 : Math.sin(now * 2.2) * 0.02;
    const blink = settings.screenFlash && !settings.reducedMotion && g.iframes > 0 && Math.floor(now * 14) % 2 === 0;
    ctx.save();
    ctx.translate(x, y + (g.moving ? Math.abs(Math.sin(g.walkT)) * -2.5 : 0));
    ctx.scale(g.faceX < 0 ? -(1 + bob) : 1 + bob, 1 - bob);
    if (blink) ctx.globalAlpha = 0.45;
    if (settings.screenFlash && !settings.reducedMotion && g.hurtFlash > 0) ctx.filter = "brightness(2) sepia(0.8) hue-rotate(-50deg) saturate(3)";
    else if (settings.screenFlash && !settings.reducedMotion && g.healFlash > 0) ctx.filter = "brightness(1.5) hue-rotate(60deg)";
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2 - 4);
    ctx.restore();
    if (g.reviveFx > 0) {
      ctx.strokeStyle = `rgba(255,233,168,${g.reviveFx})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, (1.2 - g.reviveFx) * 220, 0, TAU);
      ctx.stroke();
    }
  }

  // ---- particles
  for (let particleIndex = 0; particleIndex < g.particles.length; particleIndex++) {
    const p = g.particles[particleIndex];
    if (!p.active || (settings.effectsIntensity === "reduced" && particleIndex % 3 !== 0)) continue;
    const x = p.x + ox;
    const y = p.y + oy;
    const k = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.globalAlpha = k;
    ctx.fillStyle = p.color;
    if (p.kind === "spark") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillRect(-p.size * 2, -p.size * 0.4, p.size * 4, p.size * 0.8);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.01, p.size * k), 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // ---- fx
  for (const f of g.fx) {
    const k = f.t / f.dur;
    const x = f.x + ox;
    const y = f.y + oy;
    switch (f.kind) {
      case "slash": {
        ctx.save();
        ctx.translate(g.px + ox, g.py + oy);
        ctx.rotate(f.angle);
        ctx.globalAlpha = 1 - k;
        const r = f.radius * (0.6 + k * 0.4);
        ctx.shadowColor = f.color;
        ctx.shadowBlur = calmEffects ? 0 : 14;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 9 * (1 - k * 0.5);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, r, -f.arc / 2, f.arc / 2);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = calmEffects ? f.color : "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.92, -f.arc / 2.4, f.arc / 2.4);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "ring":
      case "nova": {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = calmEffects ? 0 : 16;
        ctx.lineWidth = f.kind === "nova" ? 7 : 4;
        ctx.beginPath();
        ctx.arc(x, y, f.radius * k, 0, TAU);
        ctx.stroke();
        if (f.kind === "nova" && !calmEffects) {
          ctx.globalAlpha = (1 - k) * 0.25;
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.arc(x, y, f.radius * k, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case "bolt": {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = calmEffects ? f.color : "#cdf2ff";
        ctx.shadowColor = f.color;
        ctx.shadowBlur = calmEffects ? 0 : 16;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        // jagged bolt from (x2,y2) to (x,y)
        const sx = f.x2 + ox;
        const sy = f.y2 + oy;
        ctx.moveTo(sx, sy);
        const segs = 5;
        for (let i = 1; i <= segs; i++) {
          const tt = i / segs;
          const jx = (f.x - f.x2) * tt + (i < segs ? (hash2(i * 31, calmEffects ? 0 : Math.floor(g.time * 30)) - 0.5) * 34 : 0);
          const jy = (f.y - f.y2) * tt;
          ctx.lineTo(f.x2 + jx + ox, f.y2 + jy + oy);
        }
        ctx.stroke();
        // impact glow
        if (!calmEffects) {
          ctx.fillStyle = f.color;
          ctx.globalAlpha = (1 - k) * 0.5;
          ctx.beginPath();
          ctx.arc(x, y, f.radius * 0.55, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case "explosion": {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        if (calmEffects) {
          ctx.strokeStyle = f.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, f.radius, 0, TAU); ctx.stroke(); ctx.restore();
          break;
        }
        const grad = ctx.createRadialGradient(x, y, 1, x, y, f.radius * (0.4 + k * 0.6));
        grad.addColorStop(0, "rgba(255,243,201,0.9)");
        grad.addColorStop(0.4, "rgba(255,159,91,0.7)");
        grad.addColorStop(1, "rgba(200,60,20,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, f.radius * (0.4 + k * 0.6), 0, TAU);
        ctx.fill();
        ctx.restore();
        break;
      }
      case "summon": {
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.strokeStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        // magic circle
        ctx.beginPath();
        ctx.arc(x, y, f.radius * (0.5 + k * 0.5), 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const rotation = settings.reducedMotion ? 0 : now * 2;
          const a = (i / 5) * TAU + rotation + (i % 2 ? Math.PI : 0);
          const a2 = (((i + 2) % 5) / 5) * TAU + rotation + ((i + 2) % 2 ? Math.PI : 0);
          const rr = f.radius * (0.5 + k * 0.5);
          ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          ctx.lineTo(x + Math.cos(a2) * rr, y + Math.sin(a2) * rr);
        }
        ctx.stroke();
        ctx.restore();
        break;
      }
    }
  }

  // ---- damage numbers

  ctx.textAlign = "center";
  for (const d of g.dmgNums) {
    if (!d.active || settings.damageNumbers === "off" || (settings.damageNumbers === "critical" && !d.crit && !d.heal)) continue;
    const x = d.x + ox;
    const y = d.y + oy;
    ctx.globalAlpha = Math.min(1, d.life * 2.4);
    if (d.heal) {
      ctx.font = "700 15px system-ui, sans-serif";
      ctx.fillStyle = "#6ee7b7";
      ctx.fillText(`+${d.value}`, x, y);
    } else if (d.crit) {
      ctx.font = "800 19px system-ui, sans-serif";
      ctx.fillStyle = "#ffd166";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeText(`${d.value}`, x, y);
      ctx.fillText(`${d.value}`, x, y);
    } else {
      ctx.font = "700 13.5px system-ui, sans-serif";
      ctx.fillStyle = "#f1f0ff";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 2.5;
      ctx.strokeText(`${d.value}`, x, y);
      ctx.fillText(`${d.value}`, x, y);
    }
  }
  ctx.globalAlpha = 1;

  // ---- ambient overlay: shifts from cold blue to blood red over 30 min
  // (cached offscreen — only regenerated when time bucket / size changes)
  const prog = Math.min(1, now / (30 * 60));
  ctx.drawImage(getVignette(W, H, prog), 0, 0);

  // final boss red pulse
  if (g.finalPhase && g.boss && settings.screenFlash && !settings.reducedMotion) {
    ctx.fillStyle = `rgba(140,16,16,${0.05 + Math.sin(now * 3) * 0.03})`;
    ctx.fillRect(0, 0, W, H);
  }

  // low hp vignette
  const hpFrac = g.hp / g.stats.maxHp;
  if (hpFrac < 0.35) {
    const a = (0.35 - hpFrac) / 0.35;
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.6);
    vg.addColorStop(0, "rgba(180,0,0,0)");
    vg.addColorStop(1, `rgba(180,10,10,${0.2 * a + (!settings.screenFlash || settings.reducedMotion ? 0 : Math.sin(now * 6) * 0.03 * a)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // Critical threat outlines remain visible above friendly effects and ambience.
  for (const f of g.fx) {
    if (f.kind !== "telegraph") continue;
    ctx.save();
    ctx.strokeStyle = settings.highContrast ? "#ffffff" : "#ffb892";
    ctx.lineWidth = settings.highContrast ? 4 : 2;
    ctx.setLineDash([9, 6]);
    ctx.beginPath();
    if (f.shape === "line") {
      ctx.moveTo(f.x + ox, f.y + oy);
      ctx.lineTo(f.x2 + ox, f.y2 + oy);
    } else ctx.arc(f.x + ox, f.y + oy, f.radius, 0, TAU);
    ctx.stroke(); ctx.restore();
  }
  // A stable locator is deliberately drawn after friendly spell effects.
  ctx.beginPath(); ctx.ellipse(g.px + ox, g.py + oy + 15, 16, 7, 0, 0, TAU);
  ctx.strokeStyle = "#080910";
  ctx.lineWidth = settings.highContrast ? 7 : 5;
  ctx.stroke();
  ctx.strokeStyle = settings.highContrast ? "#ffffff" : "#fff0bc";
  ctx.lineWidth = settings.highContrast ? 3 : 1.5;
  ctx.stroke();
  ctx.restore();

  // Small named plates follow visible mini-bosses instead of stacking global HUD bars.
  // CSS-pixel text stays readable in narrow portrait and short landscape views.
  for (const enemy of g.enemies) {
    if (!enemy.active || !enemy.miniBossId || enemy.hp <= 0) continue;
    const definition = MINI_BOSSES.find(b => b.id === enemy.miniBossId);
    if (!definition) continue;
    const x = (enemy.x - camX) * viewport.scale + screenW / 2;
    const y = (enemy.y - camY) * viewport.scale + screenH / 2;
    const radius = enemy.radius * viewport.scale;
    if (x + radius < 0 || x - radius > screenW || y + radius < 0 || y - radius > screenH) continue;
    const plateWidth = 96, plateHeight = 29;
    const plateX = Math.max(3, Math.min(screenW - plateWidth - 3, x - plateWidth / 2));
    const plateY = Math.max(3, Math.min(screenH - plateHeight - 3, y - radius - 39));
    ctx.save();
    ctx.fillStyle = "#0b0c15"; ctx.fillRect(plateX, plateY, plateWidth, plateHeight);
    ctx.strokeStyle = settings.highContrast ? "#ffffff" : "#f2bfff"; ctx.lineWidth = 1;
    ctx.strokeRect(plateX, plateY, plateWidth, plateHeight);
    ctx.fillStyle = "#f9e5ff"; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(definition.name, plateX + plateWidth / 2, plateY + 9, plateWidth - 8);
    ctx.fillStyle = "#3e2949"; ctx.fillRect(plateX + 5, plateY + 19, plateWidth - 10, 5);
    ctx.fillStyle = "#f2bfff"; ctx.fillRect(plateX + 5, plateY + 19, (plateWidth - 10) * Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)), 5);
    ctx.restore();
  }
  drawObjectiveMarkers(ctx, offscreenMarkers(g, screenW, screenH, settings), settings.highContrast);

  // Joystick is in CSS pixels, independent of camera/world scale.
  const actualJoystick = g.input.joystick;
  const showFixed = settings.joystickMode === "fixed" && g.phase === "playing";
  const fixedX = settings.joystickSide === "left" ? 86 : screenW - 86;
  const j = actualJoystick.active ? actualJoystick : { active: showFixed, originX: fixedX, originY: screenH - 100, stickX: fixedX, stickY: screenH - 100 };
  if (j.active) {
    const dx = j.stickX - j.originX;
    const dy = j.stickY - j.originY;
    const d = Math.hypot(dx, dy);
    const max = JOYSTICK_RADIUS;
    const kx = d > max ? (dx / d) * max : dx;
    const ky = d > max ? (dy / d) * max : dy;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(j.originX, j.originY, max, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.fillStyle = "rgba(240,199,94,0.55)";
    ctx.shadowColor = "#f0c75e";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(j.originX + kx, j.originY + ky, 22, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
