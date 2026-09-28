import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
export function validateBundle(files) {
  const names = Object.keys(files);
  if (!names.includes('index.html')) throw new Error('ZIP needs index.html at its root.');
  if (names.length > 8000) throw new Error('Too many bundle files.');
  let totalBytes = 0;
  for (const name of names) {
    if (!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(name) || name.split('/').some((part) => part === '..')) throw new Error(`Invalid bundle path: ${name}`);
    const size = files[name].length;
    if (size >= 30 * 1024 * 1024) throw new Error(`File exceeds 30 MiB: ${name}`);
    totalBytes += size;
  }
  if (totalBytes >= 250 * 1024 * 1024) throw new Error('Bundle exceeds 250 MiB.');
  // All game files load initially; uncompressed bytes give a conservative check.
  if (totalBytes >= 30 * 1024 * 1024) throw new Error('Initial files exceed 30 MiB.');
  const html = strFromU8(files['index.html']);
  const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  if (scripts[0] !== 'https://www.youtube.com/game_api/v1') throw new Error('Official SDK must load before the game.');
  if (/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(html)) throw new Error('Unexpected inline bootstrap in Playables HTML.');
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const reference of references) {
    if (reference === 'https://www.youtube.com/game_api/v1') continue;
    if (!reference.startsWith('./') || !files[reference.slice(2)]) throw new Error(`Missing/non-relative asset: ${reference}`);
  }
  const css = files['game.css'] ? strFromU8(files['game.css']) : '';
  if (/@import\b|url\(\s*["']?(?:https?:|\/)/i.test(css)) throw new Error('External or root-relative CSS dependency.');
  if (/fonts\.googleapis|fonts\.gstatic/.test(html + css)) throw new Error('Remote fonts are not bundled.');
  return { fileCount: names.length, totalBytes, sdkFirst: true, relativeAssets: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = process.argv[2] ?? 'dist/nightfall-survivors-playables.zip';
  readFile(file).then((bytes) => console.log(JSON.stringify(validateBundle(unzipSync(bytes)), null, 2)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
