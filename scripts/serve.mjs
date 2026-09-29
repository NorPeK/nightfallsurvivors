import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const policy = "default-src 'none'; script-src 'self' 'unsafe-inline' https://www.youtube.com/game_api/v1 https://www.youtube.com/game_api/v1/; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' blob: data:; object-src 'none'; base-uri 'self'; sandbox allow-same-origin allow-scripts";
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
const inside = (root, path) => path === root || path.startsWith(root + sep);

export async function createPreviewServer({ directory = 'out', csp = false } = {}) {
  const root = await realpath(resolve(directory));
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
    }
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (!inside(root, path)) { res.writeHead(403).end(); return; }
      path = await realpath(path);
      if (!inside(root, path)) { res.writeHead(403).end(); return; }
      if ((await stat(path)).isDirectory()) path = await realpath(resolve(path, 'index.html'));
      if (!inside(root, path)) { res.writeHead(403).end(); return; }
      const data = await readFile(path);
      res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      if (csp) res.setHeader('Content-Security-Policy', policy);
      res.writeHead(200).end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => args.includes(flag) ? args[args.lastIndexOf(flag) + 1] : fallback;
  const directory = resolve(value('--dir', 'out'));
  const port = Number(value('--port', '3000'));
  const host = value('--host', '127.0.0.1');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be between 1 and 65535.');
  if (!['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(host)) throw new Error('Use a loopback host, or explicitly use 0.0.0.0 for phone testing.');
  const server = await createPreviewServer({ directory, csp: args.includes('--csp') });
  server.listen(port, host, () => {
    console.log(`Serving ${directory} at http://${host === '::1' ? '[::1]' : host}:${port}${args.includes('--csp') ? ' with restricted CSP' : ''}`);
    if (host === '0.0.0.0') {
      console.log('Phone preview: use the same trusted Wi-Fi as this Mac. Stop with Ctrl-C when finished.');
      for (const addresses of Object.values(networkInterfaces())) for (const address of addresses ?? []) {
        if (address.family === 'IPv4' && !address.internal) console.log(`Phone URL: http://${address.address}:${port}/`);
      }
    }
  });
}
