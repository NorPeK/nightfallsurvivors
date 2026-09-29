// Procedural sprite factory — every entity is drawn once to an offscreen
// canvas (with baked-in glow) then blitted each frame. This is what lets
// us render hundreds of enemies at 60fps, VS-style.

import type { EnemyDef, BossDef, CharacterId } from "./types";

export type Sprite = HTMLCanvasElement;

const cache = new Map<string, Sprite>();

function make(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void): Sprite {
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const c = cv.getContext("2d")!;
  c.translate(size / 2, size / 2);
  draw(c, size);
  return cv;
}

function glowCircle(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, glow: string, blur = 12) {
  c.save();
  c.shadowColor = glow;
  c.shadowBlur = blur;
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function eyes(c: CanvasRenderingContext2D, x: number, y: number, gap: number, r: number, color = "#ff4d4d") {
  c.save();
  c.shadowColor = color;
  c.shadowBlur = 6;
  c.fillStyle = color;
  c.beginPath();
  c.arc(x - gap, y, r, 0, Math.PI * 2);
  c.arc(x + gap, y, r, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// ---------------------------------------------------------------- enemies

export function enemySprite(def: EnemyDef, elite: boolean): Sprite {
  const key = `e:${def.id}:${elite ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const scale = elite ? 1.9 : 1;
  const R = def.radius * scale;
  const pad = 18;
  const size = Math.ceil((R + pad) * 2);
  const color = elite ? "#ffd166" : def.color;
  const glow = elite ? "#f0a800" : def.glow;

  const spr = make(size, (c) => {
    c.save();
    if (elite) {
      c.shadowColor = glow;
      c.shadowBlur = 16;
    }
    switch (def.shape) {
      case "bat": {
        c.fillStyle = color;
        c.shadowColor = glow;
        c.shadowBlur = 10;
        // wings
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(-R * 1.5, -R * 1.2, -R * 1.7, R * 0.2);
        c.quadraticCurveTo(-R * 0.8, -R * 0.1, 0, R * 0.5);
        c.quadraticCurveTo(R * 0.8, -R * 0.1, R * 1.7, R * 0.2);
        c.quadraticCurveTo(R * 1.5, -R * 1.2, 0, 0);
        c.fill();
        glowCircle(c, 0, 0, R * 0.55, color, glow, 8);
        eyes(c, 0, -R * 0.1, R * 0.22, R * 0.13);
        break;
      }
      case "ghoul": {
        c.fillStyle = color;
        c.shadowColor = glow;
        c.shadowBlur = 10;
        // hunched body
        c.beginPath();
        c.ellipse(0, R * 0.18, R * 0.78, R * 0.85, 0, 0, Math.PI * 2);
        c.fill();
        // head
        glowCircle(c, 0, -R * 0.55, R * 0.45, color, glow, 8);
        // arms
        c.strokeStyle = color;
        c.lineWidth = R * 0.22;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(-R * 0.6, 0);
        c.lineTo(-R * 0.95, R * 0.6);
        c.moveTo(R * 0.6, 0);
        c.lineTo(R * 0.95, R * 0.6);
        c.stroke();
        eyes(c, 0, -R * 0.6, R * 0.18, R * 0.1, "#d9ffb0");
        break;
      }
      case "skeleton": {
        c.fillStyle = color;
        c.shadowColor = glow;
        c.shadowBlur = 8;
        // skull
        glowCircle(c, 0, -R * 0.45, R * 0.5, color, glow, 8);
        c.fillStyle = "#111";
        c.beginPath();
        c.arc(-R * 0.18, -R * 0.5, R * 0.12, 0, Math.PI * 2);
        c.arc(R * 0.18, -R * 0.5, R * 0.12, 0, Math.PI * 2);
        c.fill();
        // ribs
        c.strokeStyle = color;
        c.lineWidth = R * 0.13;
        c.lineCap = "round";
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(-R * 0.45, R * (0.05 + i * 0.3));
          c.lineTo(R * 0.45, R * (0.05 + i * 0.3));
          c.stroke();
        }
        c.beginPath();
        c.moveTo(0, -R * 0.05);
        c.lineTo(0, R * 0.75);
        c.stroke();
        break;
      }
      case "spider": {
        c.strokeStyle = color;
        c.lineWidth = R * 0.16;
        c.lineCap = "round";
        c.shadowColor = glow;
        c.shadowBlur = 8;
        for (let i = 0; i < 4; i++) {
          const a = -0.7 + i * 0.47;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(a + Math.PI) * R * 1.5, Math.sin(a + Math.PI) * R * 1.1);
          c.moveTo(0, 0);
          c.lineTo(Math.cos(-a) * R * 1.5, Math.sin(-a) * R * 1.1);
          c.stroke();
        }
        glowCircle(c, 0, R * 0.15, R * 0.55, color, glow, 8);
        glowCircle(c, 0, -R * 0.45, R * 0.38, color, glow, 8);
        eyes(c, 0, -R * 0.5, R * 0.16, R * 0.1);
        break;
      }
      case "wraith": {
        const grd = c.createLinearGradient(0, -R, 0, R);
        grd.addColorStop(0, color);
        grd.addColorStop(1, "rgba(50,80,120,0)");
        c.fillStyle = grd;
        c.shadowColor = glow;
        c.shadowBlur = 14;
        c.beginPath();
        c.moveTo(0, -R);
        c.quadraticCurveTo(R * 0.9, -R * 0.2, R * 0.7, R * 0.5);
        c.quadraticCurveTo(R * 0.45, R * 0.25, R * 0.3, R * 0.8);
        c.quadraticCurveTo(0, R * 0.45, -R * 0.3, R * 0.8);
        c.quadraticCurveTo(-R * 0.45, R * 0.25, -R * 0.7, R * 0.5);
        c.quadraticCurveTo(-R * 0.9, -R * 0.2, 0, -R);
        c.fill();
        eyes(c, 0, -R * 0.35, R * 0.2, R * 0.11, "#bfffff");
        break;
      }
      case "cultist": {
        // hooded robe
        c.fillStyle = color;
        c.shadowColor = glow;
        c.shadowBlur = 10;
        c.beginPath();
        c.moveTo(0, -R);
        c.quadraticCurveTo(R * 0.95, -R * 0.1, R * 0.75, R * 0.9);
        c.lineTo(-R * 0.75, R * 0.9);
        c.quadraticCurveTo(-R * 0.95, -R * 0.1, 0, -R);
        c.fill();
        // hood shadow
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.beginPath();
        c.arc(0, -R * 0.35, R * 0.42, 0, Math.PI * 2);
        c.fill();
        eyes(c, 0, -R * 0.38, R * 0.17, R * 0.09, "#ffd166");
        break;
      }
      case "brute": {
        c.fillStyle = color;
        c.shadowColor = glow;
        c.shadowBlur = 12;
        // massive torso
        c.beginPath();
        c.ellipse(0, 0, R * 0.95, R * 0.8, 0, 0, Math.PI * 2);
        c.fill();
        // shoulders / arms
        glowCircle(c, -R * 0.85, -R * 0.15, R * 0.38, color, glow, 8);
        glowCircle(c, R * 0.85, -R * 0.15, R * 0.38, color, glow, 8);
        // head (small)
        glowCircle(c, 0, -R * 0.7, R * 0.3, color, glow, 8);
        // stitches
        c.strokeStyle = "rgba(0,0,0,0.4)";
        c.lineWidth = R * 0.07;
        c.beginPath();
        c.moveTo(-R * 0.4, -R * 0.2);
        c.lineTo(R * 0.2, R * 0.4);
        c.stroke();
        eyes(c, 0, -R * 0.72, R * 0.13, R * 0.08);
        break;
      }
      case "hound": {
        c.fillStyle = color;
        c.shadowColor = glow;
        c.shadowBlur = 12;
        // body lunging forward
        c.beginPath();
        c.ellipse(0, R * 0.1, R * 1.1, R * 0.55, -0.15, 0, Math.PI * 2);
        c.fill();
        // head
        glowCircle(c, R * 0.85, -R * 0.25, R * 0.42, color, glow, 8);
        // ears
        c.beginPath();
        c.moveTo(R * 0.7, -R * 0.55);
        c.lineTo(R * 0.55, -R * 1.0);
        c.lineTo(R * 0.9, -R * 0.6);
        c.fill();
        // flame mane
        c.fillStyle = "#ffb84d";
        c.shadowColor = "#ff7b00";
        c.shadowBlur = 10;
        c.beginPath();
        c.moveTo(-R * 0.2, -R * 0.4);
        c.quadraticCurveTo(0, -R * 0.95, R * 0.3, -R * 0.45);
        c.quadraticCurveTo(0, -R * 0.55, -R * 0.2, -R * 0.4);
        c.fill();
        eyes(c, R * 0.92, -R * 0.3, R * 0.12, R * 0.08, "#ffe14d");
        break;
      }
      case "gargoyle": {
        c.fillStyle = color;
        c.shadowColor = glow;
        c.shadowBlur = 10;
        // wings
        c.beginPath();
        c.moveTo(0, -R * 0.2);
        c.lineTo(-R * 1.4, -R * 0.9);
        c.lineTo(-R * 1.0, 0);
        c.lineTo(-R * 1.3, R * 0.5);
        c.lineTo(0, R * 0.3);
        c.lineTo(R * 1.3, R * 0.5);
        c.lineTo(R * 1.0, 0);
        c.lineTo(R * 1.4, -R * 0.9);
        c.closePath();
        c.fill();
        // body
        glowCircle(c, 0, 0, R * 0.6, color, glow, 8);
        // horns
        c.beginPath();
        c.moveTo(-R * 0.3, -R * 0.5);
        c.lineTo(-R * 0.45, -R * 0.95);
        c.lineTo(-R * 0.1, -R * 0.55);
        c.moveTo(R * 0.3, -R * 0.5);
        c.lineTo(R * 0.45, -R * 0.95);
        c.lineTo(R * 0.1, -R * 0.55);
        c.fill();
        eyes(c, 0, -R * 0.2, R * 0.2, R * 0.1, "#9ff");
        break;
      }
      case "demon": {
        c.fillStyle = color;
        c.shadowColor = glow;
        c.shadowBlur = 14;
        // body
        c.beginPath();
        c.ellipse(0, R * 0.1, R * 0.8, R * 0.85, 0, 0, Math.PI * 2);
        c.fill();
        // head
        glowCircle(c, 0, -R * 0.55, R * 0.45, color, glow, 10);
        // big horns
        c.strokeStyle = "#f5d8a8";
        c.lineWidth = R * 0.16;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(-R * 0.35, -R * 0.8);
        c.quadraticCurveTo(-R * 0.75, -R * 1.25, -R * 0.45, -R * 1.5);
        c.moveTo(R * 0.35, -R * 0.8);
        c.quadraticCurveTo(R * 0.75, -R * 1.25, R * 0.45, -R * 1.5);
        c.stroke();
        eyes(c, 0, -R * 0.6, R * 0.18, R * 0.11, "#ffe14d");
        break;
      }
      case "golem": {
        c.fillStyle = color;
        c.shadowColor = glow;
        c.shadowBlur = 10;
        // blocky bone armor
        c.beginPath();
        const pts = 8;
        for (let i = 0; i <= pts; i++) {
          const a = (i / pts) * Math.PI * 2;
          const rr = R * (0.85 + (i % 2) * 0.18);
          if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
        c.fill();
        c.fillStyle = "rgba(0,0,0,0.35)";
        c.beginPath();
        c.arc(0, 0, R * 0.45, 0, Math.PI * 2);
        c.fill();
        eyes(c, 0, -R * 0.05, R * 0.22, R * 0.12, "#aef");
        break;
      }
      case "shadow": {
        const grd = c.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.2);
        grd.addColorStop(0, color);
        grd.addColorStop(1, "rgba(20,10,50,0)");
        c.fillStyle = grd;
        c.shadowColor = glow;
        c.shadowBlur = 18;
        // jagged shade
        c.beginPath();
        for (let i = 0; i <= 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const rr = R * (0.7 + (i % 2) * 0.45);
          if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
        c.fill();
        eyes(c, 0, -R * 0.15, R * 0.24, R * 0.13, "#ff2d78");
        break;
      }
    }
    c.restore();
    if (elite) {
      // elite crown
      c.save();
      c.fillStyle = "#ffd166";
      c.shadowColor = "#f0a800";
      c.shadowBlur = 8;
      const cy = -R - 8;
      c.beginPath();
      c.moveTo(-8, cy + 6);
      c.lineTo(-8, cy - 2);
      c.lineTo(-4, cy + 2);
      c.lineTo(0, cy - 4);
      c.lineTo(4, cy + 2);
      c.lineTo(8, cy - 2);
      c.lineTo(8, cy + 6);
      c.closePath();
      c.fill();
      c.restore();
    }
  });

  cache.set(key, spr);
  return spr;
}

// ---------------------------------------------------------------- bosses

export function bossSprite(def: BossDef): Sprite {
  const key = `b:${def.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const R = def.radius;
  const size = Math.ceil((R + 30) * 2);

  const spr = make(size, (c) => {
    c.shadowColor = def.glow;
    c.shadowBlur = 24;
    switch (def.shape) {
      case "colossus": {
        c.fillStyle = def.color;
        // huge segmented bone body
        c.beginPath();
        c.ellipse(0, R * 0.15, R * 0.9, R * 0.75, 0, 0, Math.PI * 2);
        c.fill();
        glowCircle(c, -R * 0.85, -R * 0.2, R * 0.42, def.color, def.glow, 14);
        glowCircle(c, R * 0.85, -R * 0.2, R * 0.42, def.color, def.glow, 14);
        glowCircle(c, 0, -R * 0.62, R * 0.4, def.color, def.glow, 14);
        // rib plates
        c.strokeStyle = "rgba(60,50,30,0.6)";
        c.lineWidth = R * 0.08;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.arc(0, R * 0.1, R * (0.35 + i * 0.2), Math.PI * 0.15, Math.PI * 0.85);
          c.stroke();
        }
        // horns
        c.fillStyle = "#e8dcc0";
        c.beginPath();
        c.moveTo(-R * 0.3, -R * 0.85);
        c.lineTo(-R * 0.55, -R * 1.35);
        c.lineTo(-R * 0.1, -R * 0.9);
        c.moveTo(R * 0.3, -R * 0.85);
        c.lineTo(R * 0.55, -R * 1.35);
        c.lineTo(R * 0.1, -R * 0.9);
        c.fill();
        eyes(c, 0, -R * 0.65, R * 0.16, R * 0.1, "#ff8c2d");
        break;
      }
      case "lich": {
        // tattered floating robe
        const grd = c.createLinearGradient(0, -R, 0, R * 1.2);
        grd.addColorStop(0, `${def.glow}b3`);
        grd.addColorStop(0.5, `${def.glow}55`);
        grd.addColorStop(1, `${def.glow}00`);
        c.fillStyle = grd;
        c.beginPath();
        c.moveTo(0, -R);
        c.quadraticCurveTo(R, -R * 0.3, R * 0.8, R * 0.5);
        c.lineTo(R * 0.5, R * 1.1);
        c.lineTo(R * 0.2, R * 0.7);
        c.lineTo(0, R * 1.15);
        c.lineTo(-R * 0.2, R * 0.7);
        c.lineTo(-R * 0.5, R * 1.1);
        c.lineTo(-R * 0.8, R * 0.5);
        c.quadraticCurveTo(-R, -R * 0.3, 0, -R);
        c.fill();
        // skull face
        glowCircle(c, 0, -R * 0.45, R * 0.38, def.color, def.glow, 18);
        c.fillStyle = "#04201c";
        c.beginPath();
        c.arc(-R * 0.14, -R * 0.5, R * 0.1, 0, Math.PI * 2);
        c.arc(R * 0.14, -R * 0.5, R * 0.1, 0, Math.PI * 2);
        c.fill();
        eyes(c, 0, -R * 0.5, R * 0.14, R * 0.06, def.color);
        // crown
        c.fillStyle = "#ffd166";
        c.shadowColor = "#f0a800";
        c.beginPath();
        const cy = -R * 0.85;
        c.moveTo(-R * 0.3, cy + R * 0.12);
        c.lineTo(-R * 0.3, cy - R * 0.1);
        c.lineTo(-R * 0.15, cy);
        c.lineTo(0, cy - R * 0.18);
        c.lineTo(R * 0.15, cy);
        c.lineTo(R * 0.3, cy - R * 0.1);
        c.lineTo(R * 0.3, cy + R * 0.12);
        c.closePath();
        c.fill();
        break;
      }
      case "death": {
        // the final reaper
        const grd = c.createLinearGradient(0, -R, 0, R * 1.2);
        grd.addColorStop(0, `${def.glow}b3`);
        grd.addColorStop(0.5, `${def.glow}55`);
        grd.addColorStop(1, `${def.glow}00`);
        c.fillStyle = grd;
        c.shadowColor = def.glow;
        c.shadowBlur = 30;
        c.beginPath();
        c.moveTo(0, -R * 1.05);
        c.quadraticCurveTo(R * 1.1, -R * 0.2, R * 0.85, R * 0.6);
        c.lineTo(R * 0.55, R * 1.15);
        c.lineTo(R * 0.25, R * 0.75);
        c.lineTo(0, R * 1.2);
        c.lineTo(-R * 0.25, R * 0.75);
        c.lineTo(-R * 0.55, R * 1.15);
        c.lineTo(-R * 0.85, R * 0.6);
        c.quadraticCurveTo(-R * 1.1, -R * 0.2, 0, -R * 1.05);
        c.fill();
        // hood void
        c.fillStyle = "#000";
        c.beginPath();
        c.arc(0, -R * 0.45, R * 0.4, 0, Math.PI * 2);
        c.fill();
        eyes(c, 0, -R * 0.45, R * 0.17, R * 0.09, def.id === "death" ? "#ff2222" : def.color);
        // scythe
        c.strokeStyle = "#8a8d96";
        c.lineWidth = R * 0.1;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(R * 0.7, R * 0.9);
        c.lineTo(R * 1.0, -R * 0.9);
        c.stroke();
        c.fillStyle = "#cdd2dd";
        c.shadowColor = "#fff";
        c.shadowBlur = 10;
        c.beginPath();
        c.moveTo(R * 1.0, -R * 0.9);
        c.quadraticCurveTo(R * 0.1, -R * 1.5, -R * 0.55, -R * 1.15);
        c.quadraticCurveTo(R * 0.2, -R * 1.18, R * 0.85, -R * 0.72);
        c.closePath();
        c.fill();
        break;
      }
    }
  });
  cache.set(key, spr);
  return spr;
}

// ---------------------------------------------------------------- player

const CHARACTER_COLORS: Record<CharacterId, { main: string; trim: string; glow: string }> = {
  knight: { main: "#cdd3e0", trim: "#f0c75e", glow: "#9fb6ff" },
  ranger: { main: "#5f8e4a", trim: "#c8e6a0", glow: "#9ee37d" },
  mage: { main: "#5b3fa8", trim: "#caa8ff", glow: "#b78cff" },
  reaper: { main: "#3a4256", trim: "#8fd0ff", glow: "#8fd0ff" },
};

export function playerSprite(id: CharacterId): Sprite {
  const key = `p:${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const R = 16;
  const size = 72;
  const { main, trim, glow } = CHARACTER_COLORS[id];

  const spr = make(size, (c) => {
    c.shadowColor = glow;
    c.shadowBlur = 12;
    switch (id) {
      case "knight": {
        // cloak
        c.fillStyle = "#27407a";
        c.beginPath();
        c.moveTo(-R * 0.7, -R * 0.3);
        c.quadraticCurveTo(-R * 1.05, R * 0.6, -R * 0.55, R * 1.05);
        c.lineTo(R * 0.55, R * 1.05);
        c.quadraticCurveTo(R * 1.05, R * 0.6, R * 0.7, -R * 0.3);
        c.fill();
        // armor body
        c.fillStyle = main;
        c.beginPath();
        c.ellipse(0, R * 0.25, R * 0.62, R * 0.72, 0, 0, Math.PI * 2);
        c.fill();
        // helmet
        glowCircle(c, 0, -R * 0.55, R * 0.5, main, glow, 8);
        c.fillStyle = "#0a1024";
        c.fillRect(-R * 0.38, -R * 0.72, R * 0.76, R * 0.22);
        // plume
        c.fillStyle = "#c43a3a";
        c.beginPath();
        c.moveTo(0, -R * 1.05);
        c.quadraticCurveTo(R * 0.5, -R * 1.35, R * 0.65, -R * 0.85);
        c.quadraticCurveTo(R * 0.3, -R * 0.95, 0, -R * 0.78);
        c.fill();
        // trim
        c.strokeStyle = trim;
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(0, R * 0.25, R * 0.62, R * 0.72, 0, 0, Math.PI * 2);
        c.stroke();
        break;
      }
      case "ranger": {
        // cloak
        c.fillStyle = "#2e4d26";
        c.beginPath();
        c.moveTo(-R * 0.65, -R * 0.4);
        c.quadraticCurveTo(-R, R * 0.6, -R * 0.5, R * 1.05);
        c.lineTo(R * 0.5, R * 1.05);
        c.quadraticCurveTo(R, R * 0.6, R * 0.65, -R * 0.4);
        c.fill();
        c.fillStyle = main;
        c.beginPath();
        c.ellipse(0, R * 0.25, R * 0.55, R * 0.68, 0, 0, Math.PI * 2);
        c.fill();
        // hooded head
        glowCircle(c, 0, -R * 0.5, R * 0.48, "#3c5e30", glow, 8);
        c.fillStyle = "#e8c9a0"; // face
        c.beginPath();
        c.arc(0, -R * 0.42, R * 0.27, 0, Math.PI * 2);
        c.fill();
        // quiver strap
        c.strokeStyle = trim;
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(-R * 0.45, -R * 0.1);
        c.lineTo(R * 0.4, R * 0.7);
        c.stroke();
        break;
      }
      case "mage": {
        // robe
        c.fillStyle = main;
        c.beginPath();
        c.moveTo(0, -R * 0.5);
        c.quadraticCurveTo(R * 0.85, R * 0.1, R * 0.62, R * 1.05);
        c.lineTo(-R * 0.62, R * 1.05);
        c.quadraticCurveTo(-R * 0.85, R * 0.1, 0, -R * 0.5);
        c.fill();
        // head
        c.fillStyle = "#e8d4f5";
        c.beginPath();
        c.arc(0, -R * 0.5, R * 0.32, 0, Math.PI * 2);
        c.fill();
        // wizard hat
        c.fillStyle = main;
        c.beginPath();
        c.moveTo(-R * 0.62, -R * 0.62);
        c.lineTo(R * 0.62, -R * 0.62);
        c.lineTo(R * 0.18, -R * 0.78);
        c.lineTo(R * 0.32, -R * 1.5);
        c.lineTo(-R * 0.25, -R * 0.82);
        c.closePath();
        c.fill();
        // stars on robe
        c.fillStyle = trim;
        c.shadowBlur = 6;
        [[-R * 0.25, R * 0.35], [R * 0.3, R * 0.6], [0, R * 0.85]].forEach(([x, y]) => {
          c.beginPath();
          c.arc(x, y, 1.8, 0, Math.PI * 2);
          c.fill();
        });
        break;
      }
      case "reaper": {
        // dark shroud
        const grd = c.createLinearGradient(0, -R, 0, R * 1.1);
        grd.addColorStop(0, main);
        grd.addColorStop(1, "rgba(20,24,40,0.1)");
        c.fillStyle = grd;
        c.beginPath();
        c.moveTo(0, -R * 0.85);
        c.quadraticCurveTo(R * 0.85, -R * 0.1, R * 0.6, R * 0.7);
        c.lineTo(R * 0.35, R * 1.05);
        c.lineTo(0, R * 0.75);
        c.lineTo(-R * 0.35, R * 1.05);
        c.lineTo(-R * 0.6, R * 0.7);
        c.quadraticCurveTo(-R * 0.85, -R * 0.1, 0, -R * 0.85);
        c.fill();
        // hood
        c.fillStyle = "#10131f";
        c.beginPath();
        c.arc(0, -R * 0.42, R * 0.36, 0, Math.PI * 2);
        c.fill();
        eyes(c, 0, -R * 0.42, R * 0.15, R * 0.07, trim);
        break;
      }
    }
  });
  cache.set(key, spr);
  return spr;
}

// ---------------------------------------------------------------- pickups

export function gemSprite(tier: number): Sprite {
  const key = `gem:${tier}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const colors = ["#5eead4", "#60a5fa", "#c084fc", "#fb7185"];
  const glows = ["#14b8a6", "#2563eb", "#9333ea", "#e11d48"];
  const r = 5 + tier * 1.5;
  const spr = make(Math.ceil(r * 2 + 16), (c) => {
    c.shadowColor = glows[tier];
    c.shadowBlur = 9;
    c.fillStyle = colors[tier];
    c.beginPath();
    c.moveTo(0, -r);
    c.lineTo(r * 0.8, 0);
    c.lineTo(0, r);
    c.lineTo(-r * 0.8, 0);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.moveTo(0, -r * 0.55);
    c.lineTo(r * 0.35, 0);
    c.lineTo(0, r * 0.2);
    c.lineTo(-r * 0.35, 0);
    c.closePath();
    c.fill();
  });
  cache.set(key, spr);
  return spr;
}

export function coinSprite(): Sprite {
  const hit = cache.get("coin");
  if (hit) return hit;
  const spr = make(26, (c) => {
    c.shadowColor = "#b8860b";
    c.shadowBlur = 8;
    c.fillStyle = "#f0c75e";
    c.beginPath();
    c.arc(0, 0, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#a8771a";
    c.font = "bold 8px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("$", 0, 0.5);
  });
  cache.set("coin", spr);
  return spr;
}

export function meatSprite(): Sprite {
  const hit = cache.get("meat");
  if (hit) return hit;
  const spr = make(34, (c) => {
    c.shadowColor = "#7a1f1f";
    c.shadowBlur = 8;
    // bone
    c.strokeStyle = "#f5f0e0";
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-7, 7);
    c.lineTo(7, -7);
    c.stroke();
    // meat
    c.fillStyle = "#c4503a";
    c.beginPath();
    c.ellipse(-2, 2, 8, 6.5, -0.7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e07a5f";
    c.beginPath();
    c.ellipse(-3, 1, 4.5, 3.5, -0.7, 0, Math.PI * 2);
    c.fill();
  });
  cache.set("meat", spr);
  return spr;
}

export function chestSprite(): Sprite {
  const hit = cache.get("chest");
  if (hit) return hit;
  const spr = make(56, (c) => {
    c.shadowColor = "#f0a800";
    c.shadowBlur = 14;
    // body
    c.fillStyle = "#7a4a1f";
    c.fillRect(-15, -6, 30, 16);
    // lid
    c.fillStyle = "#9a6228";
    c.beginPath();
    c.moveTo(-15, -6);
    c.quadraticCurveTo(0, -18, 15, -6);
    c.closePath();
    c.fill();
    // gold trim
    c.strokeStyle = "#f0c75e";
    c.lineWidth = 2.5;
    c.strokeRect(-15, -6, 30, 16);
    c.beginPath();
    c.moveTo(-15, -6);
    c.quadraticCurveTo(0, -18, 15, -6);
    c.stroke();
    // lock
    c.fillStyle = "#f0c75e";
    c.fillRect(-3, -7, 6, 8);
  });
  cache.set("chest", spr);
  return spr;
}

export function magnetSprite(): Sprite {
  const hit = cache.get("magnet");
  if (hit) return hit;
  const spr = make(36, (c) => {
    c.shadowColor = "#c9b6ff";
    c.shadowBlur = 10;
    c.strokeStyle = "#c43a3a";
    c.lineWidth = 5;
    c.lineCap = "butt";
    c.beginPath();
    c.arc(0, -1, 7, Math.PI, 0, false);
    c.stroke();
    c.strokeStyle = "#e8e3d4";
    c.beginPath();
    c.moveTo(-7, -1);
    c.lineTo(-7, 6);
    c.moveTo(7, -1);
    c.lineTo(7, 6);
    c.stroke();
  });
  cache.set("magnet", spr);
  return spr;
}

export function bombSprite(): Sprite {
  const hit = cache.get("bomb");
  if (hit) return hit;
  const spr = make(36, (c) => {
    c.shadowColor = "#444";
    c.shadowBlur = 8;
    c.fillStyle = "#23262e";
    c.beginPath();
    c.arc(0, 2, 8, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#9aa0ae";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(3, -5);
    c.quadraticCurveTo(7, -10, 5, -12);
    c.stroke();
    c.fillStyle = "#ffb84d";
    c.shadowColor = "#ff7b00";
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(5, -12, 2.5, 0, Math.PI * 2);
    c.fill();
  });
  cache.set("bomb", spr);
  return spr;
}

// ------------------------------------------------------- tinted variants
// (precomputed so we never use ctx.filter / shadowBlur in the hot loop)

function tintOf(base: Sprite, key: string, color: string, alpha: number): Sprite {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = base.width;
  cv.height = base.height;
  const c = cv.getContext("2d")!;
  c.drawImage(base, 0, 0);
  c.globalCompositeOperation = "source-atop";
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.fillRect(0, 0, cv.width, cv.height);
  cache.set(key, cv);
  return cv;
}

export function enemyFlashSprite(def: EnemyDef, elite: boolean): Sprite {
  return tintOf(enemySprite(def, elite), `ef:${def.id}:${elite ? 1 : 0}`, "#ffffff", 0.85);
}
export function enemyFrozenSprite(def: EnemyDef, elite: boolean): Sprite {
  return tintOf(enemySprite(def, elite), `ez:${def.id}:${elite ? 1 : 0}`, "#9adcff", 0.6);
}
export function bossFlashSprite(def: BossDef): Sprite {
  return tintOf(bossSprite(def), `bf:${def.id}`, "#ffffff", 0.75);
}

// ------------------------------------------------------- bullet sprites

export function arrowSprite(evolved: boolean): Sprite {
  const key = `arrow:${evolved ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const spr = make(36, (c) => {
    c.shadowColor = evolved ? "#ffd166" : "#9ee37d";
    c.shadowBlur = 7;
    c.strokeStyle = evolved ? "#ffe6a8" : "#cdebb8";
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-9, 0);
    c.lineTo(7, 0);
    c.stroke();
    c.fillStyle = evolved ? "#ffd166" : "#9ee37d";
    c.beginPath();
    c.moveTo(11, 0);
    c.lineTo(4, -3.4);
    c.lineTo(4, 3.4);
    c.closePath();
    c.fill();
  });
  cache.set(key, spr);
  return spr;
}

export function shardSprite(): Sprite {
  const hit = cache.get("shard");
  if (hit) return hit;
  const spr = make(30, (c) => {
    c.shadowColor = "#7dd9ff";
    c.shadowBlur = 7;
    c.fillStyle = "#cdf2ff";
    c.beginPath();
    c.moveTo(8, 0);
    c.lineTo(-5, -3.4);
    c.lineTo(-2, 0);
    c.lineTo(-5, 3.4);
    c.closePath();
    c.fill();
  });
  cache.set("shard", spr);
  return spr;
}

export function fireballSprite(radius: number): Sprite {
  const key = `fb:${Math.round(radius)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const spr = make(Math.ceil(radius * 2 + 28), (c) => {
    c.shadowColor = "#ff7b00";
    c.shadowBlur = 14;
    const grad = c.createRadialGradient(0, 0, 1, 0, 0, radius + 3);
    grad.addColorStop(0, "#fff3c9");
    grad.addColorStop(0.5, "#ffb84d");
    grad.addColorStop(1, "rgba(255,90,20,0.3)");
    c.fillStyle = grad;
    c.beginPath();
    c.arc(0, 0, radius + 2, 0, Math.PI * 2);
    c.fill();
  });
  cache.set(key, spr);
  return spr;
}

export function enemyBulletSprite(color: string): Sprite {
  const key = `eb:${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const spr = make(34, (c) => {
    c.shadowColor = color;
    c.shadowBlur = 10;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(8, 0);
    c.quadraticCurveTo(0, -7, -8, 0);
    c.quadraticCurveTo(0, 7, 8, 0);
    c.fill();
  });
  cache.set(key, spr);
  return spr;
}

export function daggerSprite(evolved: boolean): Sprite {
  const key = `dg:${evolved ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = evolved ? 1.35 : 1;
  const spr = make(40, (c) => {
    c.shadowColor = evolved ? "#7df" : "#8fd0ff";
    c.shadowBlur = 9;
    c.fillStyle = evolved ? "#cfeaff" : "#a8d8ff";
    c.beginPath();
    c.moveTo(0, -10 * s);
    c.lineTo(3.5 * s, 4 * s);
    c.lineTo(0, 8 * s);
    c.lineTo(-3.5 * s, 4 * s);
    c.closePath();
    c.fill();
  });
  cache.set(key, spr);
  return spr;
}

export function clearSpriteCache() {
  cache.clear();
}
