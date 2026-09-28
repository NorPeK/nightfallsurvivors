import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8 } from 'fflate';
import { validateBundle } from '../scripts/validate-playables.mjs';

function files(html = '<script src="https://www.youtube.com/game_api/v1"></script><link href="./game.css" rel="stylesheet"><script src="./game.js"></script>') {
  return { 'index.html': strToU8(html), 'game.css': strToU8('body{color:white}'), 'game.js': strToU8('void 0;') };
}
test('Playables package requires SDK first, root entry, and local assets', () => {
  assert.equal(validateBundle(files()).fileCount, 3);
  assert.throws(() => validateBundle({ 'nested/index.html': strToU8('') }), /root/);
  assert.throws(() => validateBundle(files('<script src="./game.js"></script><script src="https://www.youtube.com/game_api/v1"></script>')), /before/);
  assert.throws(() => validateBundle(files('<script src="https://www.youtube.com/game_api/v1"></script><script src="/game.js"></script>')), /non-relative/);
  assert.throws(() => validateBundle(files('<script src="https://www.youtube.com/game_api/v1"></script><script src="./missing.js"></script>')), /Missing/);
});
test('Playables package rejects traversal and hidden external styles', () => {
  assert.throws(() => validateBundle({ ...files(), '../escape.js': strToU8('') }), /Invalid bundle path/);
  assert.throws(() => validateBundle({ ...files(), 'game.css': strToU8('@import "https://example.com/a.css";') }), /External/);
  assert.throws(() => validateBundle({ ...files(), 'game.css': strToU8('body{background:url(/image.png)}') }), /External/);
  assert.throws(() => validateBundle(files('<script src="https://www.youtube.com/game_api/v1"></script><script>alert(1)</script>')), /inline/);
});
