import test from 'node:test';
import assert from 'node:assert/strict';
import { GamePlatform, SAVE_KEY, SaveConflictError, type PlayablesSdk } from '../app/game/platform';

function fixture(inEnvironment = true) {
  const events: string[] = [];
  const callbacks: { pause(): void; resume(): void; audio(enabled: boolean): void } = { pause: () => {}, resume: () => {}, audio: () => {} };
  const sdk: PlayablesSdk = {
    IN_PLAYABLES_ENV: inEnvironment,
    game: {
      firstFrameReady: () => { events.push('frame'); }, gameReady: () => { events.push('ready'); },
      loadData: async () => { events.push('load'); return '{"gold":2}'; },
      saveData: async (data) => { events.push(`save:${data}`); },
    },
    system: {
      isAudioEnabled: () => false,
      onPause: (cb) => { callbacks.pause = cb; return () => { events.push('off-pause'); }; },
      onResume: (cb) => { callbacks.resume = cb; return () => { events.push('off-resume'); }; },
      onAudioEnabledChange: (cb) => { callbacks.audio = cb; return () => { events.push('off-audio'); }; },
    },
    health: { logError: () => { events.push('error'); } },
  };
  return { sdk, events, callbacks };
}
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test('readiness is ordered and idempotent; missing SDK fails explicitly', () => {
  const { sdk, events } = fixture(); const p = new GamePlatform({ target: 'playables', sdk });
  assert.throws(() => p.gameReady(), /Loading/);
  p.firstFrameReady(); p.firstFrameReady(); p.gameReady(); p.gameReady();
  assert.deepEqual(events, ['frame', 'ready']); p.dispose();
  assert.throws(() => new GamePlatform({ target: 'playables' }).init(), /YouTube/);
});
test('SDK mute and pause are authoritative; subscriptions are disposed', () => {
  const { sdk, events, callbacks } = fixture(); const p = new GamePlatform({ sdk });
  let pauses = 0; let resumes = 0; let audio = true;
  p.onPause(() => pauses++); p.onResume(() => resumes++); p.onAudioChanged(value => { audio = value; }); p.init();
  assert.equal(p.audioEnabled, false); callbacks.pause(); callbacks.pause(); assert.equal(p.suspended, true);
  callbacks.resume(); callbacks.resume(); callbacks.audio(false);
  assert.deepEqual([pauses, resumes, audio], [1, 1, false]);
  p.reportError(); p.dispose();
  assert.deepEqual(events, ['error', 'off-pause', 'off-resume', 'off-audio']);
});
test('partial SDK initialization cleans up and can retry safely', () => {
  const { sdk, events, callbacks } = fixture();
  const onResume = sdk.system.onResume;
  sdk.system.onResume = () => { throw new Error('SDK temporarily unavailable'); };
  const p = new GamePlatform({ sdk });
  assert.throws(() => p.init(), /temporarily/);
  assert.deepEqual(events, ['off-pause']);
  sdk.system.onResume = onResume; p.init(); callbacks.pause(); assert.equal(p.suspended, true);
  callbacks.resume(); assert.equal(p.suspended, false); p.dispose();
  assert.deepEqual(events, ['off-pause', 'off-pause', 'off-resume', 'off-audio']);
});
test('cloud load failure locks saves even after an earlier successful load', async () => {
  const { sdk, events } = fixture(); const p = new GamePlatform({ sdk });
  await assert.rejects(p.saveData('{}'), /finish loading/);
  await p.loadData(); await p.saveData('{"gold":3}');
  sdk.game.loadData = async () => { throw new Error('offline'); };
  await assert.rejects(p.loadData(), /offline/);
  await assert.rejects(p.saveData('{}'), /finish loading/);
  assert.equal(events.filter(v => v.startsWith('save:')).length, 1); p.dispose();
});
test('Playables preview never falls back to browser storage', async () => {
  const { sdk, events } = fixture(false);
  const storage = { getItem: () => { throw new Error('must not read'); }, setItem: () => { throw new Error('must not write'); } };
  const p = new GamePlatform({ target: 'playables', sdk, storage });
  assert.equal(p.storageKind, 'preview'); assert.equal(await p.loadData(), null);
  await p.saveData('preview'); assert.equal(await p.loadData(), 'preview');
  assert.deepEqual(events, []); p.dispose();
});
test('browser saves retain previous value and reject another window’s changes', async () => {
  const storage = memory(); storage.setItem(SAVE_KEY, 'old');
  const p = new GamePlatform({ target: 'web', storage });
  assert.equal(await p.loadData(), 'old'); await p.saveData('new'); assert.equal(await p.loadBackup(), 'old');
  storage.setItem(SAVE_KEY, 'other-window');
  await assert.rejects(p.saveData('stale'), SaveConflictError);
  assert.equal(storage.getItem(SAVE_KEY), 'other-window'); p.dispose();
});
test('empty browser values remain invalid input while the SDK empty string means new player', async () => {
  const storage = memory(); storage.setItem(SAVE_KEY, '');
  const browser = new GamePlatform({ target: 'web', storage });
  assert.equal(await browser.loadData(), ''); browser.dispose();
  const { sdk } = fixture(); sdk.game.loadData = async () => '';
  const cloud = new GamePlatform({ sdk }); assert.equal(await cloud.loadData(), null); cloud.dispose();
});
test('oversized UTF-8 save is rejected before cloud write', async () => {
  const { sdk, events } = fixture(); const p = new GamePlatform({ sdk }); await p.loadData();
  await assert.rejects(p.saveData('界'.repeat(1024 * 1024)), /too large/);
  assert.deepEqual(events, ['load']); p.dispose();
});
test('pause stops new cloud operations; one explicit boundary checkpoint is permitted', async () => {
  const { sdk, events, callbacks } = fixture(); const p = new GamePlatform({ sdk }); await p.loadData();
  callbacks.pause(); await p.saveData('boundary', { pauseCheckpoint: true });
  const deferred = p.saveData('after-boundary', { pauseCheckpoint: true });
  await Promise.resolve(); assert.deepEqual(events, ['load', 'save:boundary']);
  callbacks.resume(); await deferred; assert.equal(events.at(-1), 'save:after-boundary');
  callbacks.pause(); const loading = p.loadData(); await Promise.resolve(); assert.equal(events.filter(e => e === 'load').length, 1);
  callbacks.resume(); await loading; p.dispose();
});
test('pause checkpoints cannot overtake an in-flight write', async () => {
  const { sdk, callbacks } = fixture(); const p = new GamePlatform({ sdk }); await p.loadData();
  let release: () => void = () => {}; const starts: string[] = [];
  sdk.game.saveData = async data => { starts.push(data); if (data === 'first') await new Promise<void>(resolve => { release = resolve; }); };
  const first = p.saveData('first'); callbacks.pause();
  const boundary = p.saveData('boundary', { pauseCheckpoint: true });
  release(); await first; await Promise.resolve(); assert.deepEqual(starts, ['first']);
  callbacks.resume(); await boundary; assert.deepEqual(starts, ['first', 'boundary']); p.dispose();
});
test('readiness is deferred during suspension and pending work rejects on disposal', async () => {
  const { sdk, events, callbacks } = fixture(); const p = new GamePlatform({ sdk }); p.init(); callbacks.pause();
  p.firstFrameReady(); p.gameReady(); assert.deepEqual(events, []);
  callbacks.resume(); assert.deepEqual(events, ['frame', 'ready']);
  callbacks.pause(); const loading = p.loadData(); p.dispose(); await assert.rejects(loading, /closed/);
});
test('a request beginning while active cannot cross a pause through a microtask gap', async () => {
  const { sdk, events, callbacks } = fixture(); const p = new GamePlatform({ sdk });
  const loading = p.loadData(); assert.deepEqual(events, ['load']); callbacks.pause(); await loading;
  callbacks.resume(); const saving = p.saveData('now'); assert.equal(events.at(-1), 'save:now');
  callbacks.pause(); await saving; p.dispose();
});

test('a late load cannot reopen saving after disposal or a newer failed load', async () => {
  const { sdk } = fixture(); let release!: (raw: string) => void;
  sdk.game.loadData = () => new Promise(resolve => { release = resolve; });
  const disposed = new GamePlatform({ sdk });
  const oldLoad = disposed.loadData(); disposed.dispose(); release('{"gold":999}');
  await assert.rejects(oldLoad, /closed/);
  await assert.rejects(disposed.saveData('{}'), /finish loading/); disposed.dispose();

  const p = new GamePlatform({ sdk }); const earlier = p.loadData();
  sdk.game.loadData = async () => { throw new Error('offline'); };
  await assert.rejects(p.loadData(), /offline/); release('{"gold":999}');
  await assert.rejects(earlier, /superseded/);
  await assert.rejects(p.saveData('{}'), /finish loading/); p.dispose();
});

test('disposal tolerates a broken unsubscribe and resets suspension for a new session', async () => {
  const { sdk, callbacks, events } = fixture();
  sdk.system.onPause = cb => { callbacks.pause = cb; return () => { events.push('off-pause'); throw new Error('SDK cleanup failed'); }; };
  const p = new GamePlatform({ sdk }); p.init();
  const stalePause = callbacks.pause;
  callbacks.pause(); const waiting = p.loadData();
  const rejected = assert.rejects(waiting, /closed/);
  assert.doesNotThrow(() => p.dispose()); await rejected;
  assert.deepEqual(events, ['off-pause', 'off-resume', 'off-audio']);
  assert.equal(p.suspended, false);
  assert.equal(await p.loadData(), '{"gold":2}');
  stalePause(); assert.equal(p.suspended, false, 'a retained callback from the old SDK session is inert');
  p.firstFrameReady(); p.gameReady(); p.dispose();
});

test('a completed old cloud write cannot mutate the new session after disposal', async () => {
  const { sdk, events } = fixture(); const p = new GamePlatform({ sdk }); await p.loadData();
  let release!: () => void;
  sdk.game.saveData = async () => { await new Promise<void>(resolve => { release = resolve; }); };
  const pending = p.saveData('old'); const rejected = assert.rejects(pending, /closed/);
  p.dispose(); await p.loadData(); release(); await rejected;
  // The old network request cannot be cancelled; its completion must not authorize a new stale local baseline.
  sdk.game.saveData = async raw => { events.push(`save:${raw}`); };
  await p.saveData('new'); assert.equal(events.at(-1), 'save:new'); p.dispose();
});

test('a failed SDK error report cannot interrupt game recovery or send during suspension', () => {
  const { sdk, callbacks } = fixture(); let reports = 0;
  sdk.health = { logError() { reports++; throw new Error('Diagnostic transport unavailable'); } };
  const p = new GamePlatform({ sdk }); p.init();
  assert.doesNotThrow(() => p.reportError()); assert.equal(reports, 1);
  callbacks.pause(); p.reportError(); assert.equal(reports, 1); p.dispose();
});
