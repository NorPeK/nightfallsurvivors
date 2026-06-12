// Builds a fully self-contained game.html (engine + React + styles inlined).
// Usage: node scripts/build-standalone.mjs   (run `next build` first so the
// exported Tailwind CSS exists in out/_next/static/chunks/*.css)

import { build } from "esbuild";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const result = await build({
  entryPoints: [join(root, "app/standalone.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
  logLevel: "warning",
});
const js = result.outputFiles[0].text;

// collect exported Tailwind CSS
let css = "";
try {
  const chunkDir = join(root, "out/_next/static/chunks");
  for (const f of readdirSync(chunkDir)) {
    if (f.endsWith(".css")) css += readFileSync(join(chunkDir, f), "utf8");
  }
} catch {
  console.warn("! No exported CSS found — run `npm run build` first for full styling.");
}

const html = `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#06060c" />
<title>NORPEK: Nightfall Survivors</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet" />
<style>${css}</style>
</head>
<body class="h-full overflow-hidden bg-[#06060c] text-zinc-100 antialiased select-none">
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;

writeFileSync(join(root, "game.html"), html);
console.log(`game.html written (${(html.length / 1024).toFixed(0)} KB)`);
