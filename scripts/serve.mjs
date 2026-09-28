import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const args = process.argv.slice(2);
const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const root = resolve(value('--dir', 'out'));
const port = Number(value('--port', '3000'));
const csp = "default-src 'none'; script-src 'self' 'unsafe-inline' https://www.youtube.com/game_api/v1 https://www.youtube.com/game_api/v1/; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' blob: data:; object-src 'none'; base-uri 'self'; sandbox allow-same-origin allow-scripts";
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.txt': 'text/plain' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const data = await readFile(path);
    res.setHeader('Content-Type', `${mime[extname(path)] ?? 'application/octet-stream'}; charset=utf-8`);
    res.setHeader('Cache-Control', 'no-store');
    if (args.includes('--csp')) res.setHeader('Content-Security-Policy', csp);
    res.writeHead(200).end(data);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}${args.includes('--csp') ? ' with restricted CSP' : ''}`));
