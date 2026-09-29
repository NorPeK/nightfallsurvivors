// Independent bundles from the same source as the Next.js site.
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { validateBundle } from './validate-playables.mjs';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = process.argv[2] ?? 'standalone';
if (!['standalone', 'playables', 'qa'].includes(target)) throw new Error('Target must be standalone, playables or qa.');
const licenses = await Promise.all(['react', 'react-dom', 'scheduler'].map(async (name) => `${name}\n${await readFile(join(root, 'node_modules', name, 'LICENSE'), 'utf8')}`));
const notices = `NORPEK: Nightfall Survivors — bundled runtime notices\n\n${licenses.join('\n\n')}`;
const cssFile = join(root, 'app/globals.css');
const compiledCss = await postcss([tailwind({ base: root, optimize: true })]).process(await readFile(cssFile, 'utf8'), { from: cssFile });
if (!compiledCss.css.trim() || /@import\s+["']tailwindcss/.test(compiledCss.css)) throw new Error('Styles did not compile. No bundle was written.');
const result = await build({
  entryPoints: [join(root, 'app/standalone.tsx')], bundle: true, minify: true, format: 'iife', jsx: 'automatic',
  target: ['es2020'], charset: 'utf8', legalComments: 'inline',
  banner: { js: `/*!\n${notices.replace(/\*\//g, '* /')}\n*/` },
  define: { 'process.env.NODE_ENV': JSON.stringify(target === 'qa' ? 'development' : 'production'), 'process.env.NEXT_PUBLIC_GAME_TARGET': JSON.stringify(target === 'playables' ? 'playables' : 'web'), 'process.env.NEXT_PUBLIC_GAME_DEBUG': '"false"' },
  write: false, logLevel: 'warning', metafile: true,
});
const js = result.outputFiles[0].text;
const css = compiledCss.css;
const icon = await readFile(join(root, 'app/icon.svg'), 'utf8');
const iconLink = `<link rel="icon" type="image/svg+xml" href="${target === 'playables' ? './icon.svg' : `data:image/svg+xml,${encodeURIComponent(icon)}`}">`;
const sdk = target === 'playables' ? '<script src="https://www.youtube.com/game_api/v1"></script>' : '';
const styles = target === 'playables' ? '<link rel="stylesheet" href="./game.css">' : `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
const script = target === 'playables' ? '<script src="./game.js"></script>' : `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#080912"><title>NORPEK: Nightfall Survivors</title>
${sdk}${iconLink}${styles}</head><body><div id="root"><p style="color:#f5e9ce;background:#080912;padding:2rem;font:18px Georgia,serif">Preparing the night…</p></div>${script}</body></html>`;
if (target === 'qa') {
  const output = join(root, 'qa-output/browser');
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'index.html'), html);
  console.log(`Development QA only: qa-output/browser/index.html (${Buffer.byteLength(html).toLocaleString()} bytes). Open with ?debug=1; never submit this artifact.`);
} else if (target === 'standalone') {
  await writeFile(join(root, 'game.html'), html);
  console.log(`Standalone game.html: ${Buffer.byteLength(html).toLocaleString()} bytes`);
} else {
  const files = { 'index.html': strToU8(html), 'game.css': strToU8(css), 'game.js': strToU8(js), 'icon.svg': strToU8(icon), 'THIRD_PARTY_NOTICES.txt': strToU8(notices) };
  const report = validateBundle(files);
  const output = join(root, 'dist/playables');
  await mkdir(output, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) await writeFile(join(output, name), bytes);
  // ZIP stores a local-calendar DOS timestamp; avoid timezone-dependent UTC conversion.
  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, [bytes, { mtime: new Date(1980, 0, 1, 0, 0, 0) }]])), { level: 9 });
  await writeFile(join(root, 'dist/nightfall-survivors-playables.zip'), zipped);
  await writeFile(join(root, 'dist/playables-manifest.json'), JSON.stringify({ ...report, zipBytes: zipped.length,
    sha256: createHash('sha256').update(zipped).digest('hex'),
    files: Object.entries(files).map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })),
    status: 'Local candidate; device and YouTube verification required. Not certified.',
  }, null, 2) + '\n');
  console.log(`Playables ZIP: ${zipped.length.toLocaleString()} bytes; ${report.fileCount} validated files.`);
}
