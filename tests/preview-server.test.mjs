import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createPreviewServer } from '../scripts/serve.mjs';

test('phone preview serves only its artifact, including through symlinks, and never accepts writes', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'nightfall-preview-'));
  const directory = join(temp, 'public');
  await mkdir(directory); await writeFile(join(directory, 'index.html'), '<h1>Test game</h1>');
  await writeFile(join(temp, 'private.txt'), 'not a game asset');
  await symlink(join(temp, 'private.txt'), join(directory, 'leak.txt'));
  const server = await createPreviewServer({ directory, csp: true });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(origin);
    assert.equal(response.status, 200); assert.equal(await response.text(), '<h1>Test game</h1>');
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const head = await fetch(origin, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.equal((await fetch(`${origin}/leak.txt`)).status, 403);
    assert.equal((await fetch(`${origin}/%2e%2e%2fprivate.txt`)).status, 403);
    assert.equal((await fetch(`${origin}/%zz`)).status, 404);
    assert.equal((await fetch(origin, { method: 'POST', body: 'change' })).status, 405);
    assert.equal(await (await fetch(origin)).text(), '<h1>Test game</h1>');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(temp, { recursive: true }); }
});
