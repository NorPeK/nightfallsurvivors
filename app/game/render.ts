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
import { WEAPONS } from "./data";

const TAU = Math.PI * 2;

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

export function renderGame(g: Game, ctx: CanvasRenderingContext2D, W: number, H: number) {
  const now = g.time;
  // camera with shake
  const shx = g.shake > 0 ? (Math.random() - 0.5) * g.shake * 14 : 0;
  const shy = g.shake > 0 ? (Math.random() - 0.5) * g.shake * 14 : 0;
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
        drawProp(ctx, p, cx * PROP_CELL + p.ox + ox, cy * PROP_CELL + p.oy + oy, now);
      }
    }
  }

  // ---- telegraphs (under everything else)
  for (const f of g.fx) {
    if (f.kind !== "telegraph") continue;
    const k = f.t / f.dur;
    ctx.save();
    if (f.x2 || f.y2) {
      // line telegraph (dash)
      ctx.strokeStyle = `rgba(255,40,40,${0.25 + k * 0.3})`;
      ctx.lineWidth = f.radius * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(f.x + ox, f.y + oy);
      const a = f.angle;
      ctx.lineTo(f.x + Math.cos(a) * 600 + ox, f.y + Math.sin(a) * 600 + oy);
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
      // pulsing rim
      ctx.strokeStyle = `rgba(255,140,60,${0.55 + 0.3 * Math.sin(now * 14)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tx, ty, f.radius, 0, TAU);
      ctx.stroke();
      // rotating dashed countdown ring closing inward
      ctx.strokeStyle = "rgba(255,190,100,0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.lineDashOffset = now * 60;
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
    const pulse = 1 + Math.sin(now * 5) * 0.025;
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
    ctx.lineDashOffset = -now * 40;
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
    const spr =
      e.hitFlash > 0
        ? enemyFlashSprite(e.def, e.elite)
        : frozen
          ? enemyFrozenSprite(e.def, e.elite)
          : enemySprite(e.def, e.elite);
    const bob = 1 + Math.sin(e.wobble) * 0.05;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(e.faceX < 0 ? -bob : bob, 2 - bob);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    if (!frozen && e.slowT > 0 && e.hitFlash <= 0) {
      // chilled (not frozen): light ice tint
      ctx.globalAlpha = 0.4;
      ctx.drawImage(enemyFrozenSprite(e.def, e.elite), -spr.width / 2, -spr.height / 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // elite hp bar
    if (e.elite) {
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
    const spr = b.hitFlash > 0 || b.windup > 0 ? bossFlashSprite(b.def) : bossSprite(b.def);
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
      ctx.strokeStyle = `rgba(255,40,40,${0.4 + Math.sin(now * 10) * 0.2})`;
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
    const blink = g.iframes > 0 && Math.floor(now * 14) % 2 === 0;
    ctx.save();
    ctx.translate(x, y + (g.moving ? Math.abs(Math.sin(g.walkT)) * -2.5 : 0));
    ctx.scale(g.faceX < 0 ? -(1 + bob) : 1 + bob, 1 - bob);
    if (blink) ctx.globalAlpha = 0.45;
    if (g.hurtFlash > 0) ctx.filter = "brightness(2) sepia(0.8) hue-rotate(-50deg) saturate(3)";
    else if (g.healFlash > 0) ctx.filter = "brightness(1.5) hue-rotate(60deg)";
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
  for (const p of g.particles) {
    if (!p.active) continue;
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
        ctx.shadowBlur = 14;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 9 * (1 - k * 0.5);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, r, -f.arc / 2, f.arc / 2);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
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
        ctx.shadowBlur = 16;
        ctx.lineWidth = f.kind === "nova" ? 7 : 4;
        ctx.beginPath();
        ctx.arc(x, y, f.radius * k, 0, TAU);
        ctx.stroke();
        if (f.kind === "nova") {
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
        ctx.strokeStyle = "#cdf2ff";
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        // jagged bolt from (x2,y2) to (x,y)
        const sx = f.x2 + ox;
        const sy = f.y2 + oy;
        ctx.moveTo(sx, sy);
        const segs = 5;
        for (let i = 1; i <= segs; i++) {
          const tt = i / segs;
          const jx = (f.x - f.x2) * tt + (i < segs ? (hash2(i * 31, Math.floor(g.time * 30)) - 0.5) * 34 : 0);
          const jy = (f.y - f.y2) * tt;
          ctx.lineTo(f.x2 + jx + ox, f.y2 + jy + oy);
        }
        ctx.stroke();
        // impact glow
        ctx.fillStyle = f.color;
        ctx.globalAlpha = (1 - k) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, f.radius * 0.55, 0, TAU);
        ctx.fill();
        ctx.restore();
        break;
      }
      case "explosion": {
        ctx.save();
        ctx.globalAlpha = 1 - k;
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
          const a = (i / 5) * TAU + now * 2 + (i % 2 ? Math.PI : 0);
          const a2 = (((i + 2) % 5) / 5) * TAU + now * 2 + ((i + 2) % 2 ? Math.PI : 0);
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
  g.updateDmgNums(1 / 60);
  ctx.textAlign = "center";
  for (const d of g.dmgNums) {
    if (!d.active) continue;
    const x = d.x + ox;
    const y = d.y + oy;
    ctx.globalAlpha = Math.min(1, d.life * 2.4);
    if (d.heal) {
      ctx.font = "700 15px Rajdhani, sans-serif";
      ctx.fillStyle = "#6ee7b7";
      ctx.fillText(`+${d.value}`, x, y);
    } else if (d.crit) {
      ctx.font = "800 19px Rajdhani, sans-serif";
      ctx.fillStyle = "#ffd166";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeText(`${d.value}`, x, y);
      ctx.fillText(`${d.value}`, x, y);
    } else {
      ctx.font = "700 13.5px Rajdhani, sans-serif";
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
  if (g.finalPhase && g.boss) {
    ctx.fillStyle = `rgba(140,16,16,${0.05 + Math.sin(now * 3) * 0.03})`;
    ctx.fillRect(0, 0, W, H);
  }

  // low hp vignette
  const hpFrac = g.hp / g.stats.maxHp;
  if (hpFrac < 0.35) {
    const a = (0.35 - hpFrac) / 0.35;
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.6);
    vg.addColorStop(0, "rgba(180,0,0,0)");
    vg.addColorStop(1, `rgba(180,10,10,${0.28 * a + Math.sin(now * 6) * 0.05 * a})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- virtual joystick (touch)
  const j = g.input.joystick;
  if (j.active) {
    const dx = j.stickX - j.originX;
    const dy = j.stickY - j.originY;
    const d = Math.hypot(dx, dy);
    const max = 56;
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
