import test from "node:test";
import assert from "node:assert/strict";
import {
  beginRun, checkpointRun, createDefaultProfile, createProfileRepository, MAX_HISTORY, parseProfile,
  purchaseUpgrade, refundUpgrades, SaveConflictError, SaveDataError, settleRun, statsWithMeta,
  updateSettings, withRunSnapshot, type ProfileStorage,
} from "../app/game/meta";
import { DEFAULT_SETTINGS, normalizeSettings } from "../app/game/settings";
import type { RunStats } from "../app/game/types";
import { GamePlatform, SAVE_KEY, type PlayablesSdk } from "../app/game/platform";
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, BOSSES, MINI_BOSSES } from "../app/game/data";

function stats(overrides: Partial<RunStats> = {}): RunStats {
  return { time: 100, kills: 20, gold: 30.5, level: 4, damageDealt: 400, won: false, runId: "run-1", character: "knight",
    abandoned: false, cause: "Night Bat", finaleTime: 0, build: ["swordwave"],
    metrics: { damageByWeapon: { swordwave: 400 }, overkill: 0, damageTaken: 100, healing: 0, xpCollected: 20,
      goldBySource: { coin: 30.5 }, bossesDefeated: [], evolutions: [] }, ...overrides };
}

function memoryStorage(initial: string | null = null) {
  let raw = initial;
  const writes: string[] = [];
  const storage: ProfileStorage = {
    async loadData() { return raw; },
    async saveData(data) { raw = data; writes.push(data); },
  };
  return { storage, writes, read: () => raw, replace: (next: string | null) => { raw = next; } };
}

test("legacy profiles preserve progress, original purchase costs and mute preference", () => {
  const p = parseProfile(JSON.stringify({ gold: 1234, upgrades: { might: 3, magnetism: 2 }, bestTime: 1800, totalKills: 2345, wins: 2, runs: 8, muted: true }));
  assert.equal(p.version, 2);
  assert.equal(p.gold, 1234);
  assert.deepEqual(p.upgrades, { might: 3, magnetism: 2 });
  assert.deepEqual(p.paidCosts.might, [150, 285, 542]);
  assert.deepEqual(p.paidCosts.magnetism, [90, 162]);
  assert.equal(p.muted, true);
  assert.equal(p.settings.lastHunter, "knight");
  assert.ok(p.achievements.includes("first_dawn"));
  assert.ok(p.achievements.includes("thousand_slain"));
  assert.equal(refundUpgrades(p).refunded, 1229);
});

test("invalid financial data and future versions fail closed", () => {
  for (const bad of ["{", "null", "[]", '{"gold":-100,"upgrades":null}', '{"gold":"100"}', '{"gold":1e300}',
    '{"upgrades":{"haste":99}}', '{"upgrades":{"might":1.5}}', '{"version":999}', '{"version":2,"upgrades":{"might":1}}']) {
    assert.throws(() => parseProfile(bad), SaveDataError, bad);
  }
});

test("unknown content IDs are ignored without granting stats or losing valid items", () => {
  const p = parseProfile('{"gold":25,"upgrades":{"might":1,"unknown":999},"discoveries":{"weapons":["bow","unknown","bow"]}}');
  assert.deepEqual(p.upgrades, { might: 1 });
  assert.deepEqual(p.discoveries.weapons, ["bow"]);
  assert.equal(statsWithMeta(p).might, 1.05);
});

test("all new main and mini-boss victories survive checkpoint, settlement and profile reload", () => {
  const metrics = { ...stats().metrics, bossesDefeated: BOSSES.map(b => b.id), miniBossesDefeated: MINI_BOSSES.map(b => b.id) };
  const details = stats({ time: 1830, won: true, metrics });
  const pending = checkpointRun(beginRun(createDefaultProfile(), "run-1", "knight"), "run-1", details.gold, details);
  const reloaded = parseProfile(JSON.stringify(pending));
  assert.deepEqual(reloaded.rewardLedger?.latestStats.metrics.bossesDefeated, metrics.bossesDefeated);
  assert.deepEqual(reloaded.rewardLedger?.latestStats.metrics.miniBossesDefeated, metrics.miniBossesDefeated);
  const settled = parseProfile(JSON.stringify(settleRun(reloaded, "run-1", details)));
  assert.deepEqual(settled.history[0].metrics.bossesDefeated, metrics.bossesDefeated);
  assert.deepEqual(settled.history[0].metrics.miniBossesDefeated, metrics.miniBossesDefeated);
  assert.equal(settled.gold, details.gold);
  const oldDetails = stats();
  const old = parseProfile(JSON.stringify(settleRun(beginRun(createDefaultProfile(), "run-1", "knight"), "run-1", oldDetails)));
  assert.deepEqual(old.history[0].metrics.miniBossesDefeated, []);
});

test("settings normalize unsafe values and retain valid independent preferences", () => {
  const s = normalizeSettings({ musicVolume: 4, sfxVolume: -2, reducedMotion: true, damageNumbers: "off", lastHunter: "mage", joystickSide: "right", joystickMode: "fixed", effectsIntensity: "unknown" });
  assert.equal(s.musicVolume, 1); assert.equal(s.sfxVolume, 0);
  assert.equal(s.reducedMotion, true); assert.equal(s.damageNumbers, "off");
  assert.equal(s.lastHunter, "mage"); assert.equal(s.joystickMode, "fixed");
  assert.equal(s.effectsIntensity, DEFAULT_SETTINGS.effectsIntensity);
  assert.equal(normalizeSettings({ musicVolume: NaN }).musicVolume, DEFAULT_SETTINGS.musicVolume);
});

test("purchases spend once per actual rank and respec returns exact historical spend", () => {
  let p = { ...createDefaultProfile(), gold: 1000.25 };
  const first = purchaseUpgrade(p, "might");
  assert.equal(first.ok, true); p = first.profile;
  p = purchaseUpgrade(p, "might").profile;
  assert.equal(p.gold, 565.25);
  assert.deepEqual(p.paidCosts.might, [150, 285]);
  assert.equal(purchaseUpgrade(p, "unknown").ok, false);
  const refund = refundUpgrades(p);
  assert.equal(refund.refunded, 435); assert.equal(refund.profile.gold, 1000.25);
  assert.deepEqual(refund.profile.upgrades, {});
  assert.equal(refundUpgrades(refund.profile).refunded, 0);
});

test("respec is blocked during an active run", () => {
  const p = beginRun(purchaseUpgrade({ ...createDefaultProfile(), gold: 1000 }, "might").profile, "run-1", "mage");
  assert.equal(refundUpgrades(p).refunded, 0);
  assert.equal(refundUpgrades(p).profile, p);
});

test("fractional cumulative gold checkpoints are monotonic and only credit differences", () => {
  let p = beginRun(createDefaultProfile(), "run-1", "knight");
  p = checkpointRun(p, "run-1", 5.5, stats({ gold: 5.5 }));
  p = checkpointRun(p, "run-1", 11);
  p = checkpointRun(p, "run-1", 11);
  p = checkpointRun(p, "run-1", 5.5, stats({ time: 1, kills: 1 }));
  assert.equal(p.gold, 11);
  assert.equal(p.rewardLedger?.creditedGold, 11);
  assert.equal(p.rewardLedger?.latestStats.time, 100);
  assert.equal(p.rewardLedger?.latestStats.kills, 20);
});

test("crash after saved checkpoint before settlement keeps gold and pays remaining amount once", async () => {
  const memory = memoryStorage();
  const beforeCrash = createProfileRepository(memory.storage);
  const loaded = await beforeCrash.load();
  const checkpoint = checkpointRun(beginRun(loaded.profile!, "run-1", "knight"), "run-1", 20.25, stats({ gold: 20.25 }));
  await beforeCrash.save(checkpoint);
  const afterCrash = createProfileRepository(memory.storage);
  const recovered = (await afterCrash.load()).profile!;
  const settled = settleRun(recovered, "run-1", stats());
  await afterCrash.save(settled);
  assert.equal(settled.gold, 30.5);
  assert.equal(settled.runs, 1); assert.equal(settled.totalKills, 20);
  assert.equal(settleRun(settled, "run-1", stats({ won: true, gold: 999 })), settled);
  assert.equal(checkpointRun(settled, "run-1", 999), settled);
  const again = parseProfile(memory.read()!);
  assert.equal(settleRun(again, "run-1", stats()), again);
  assert.equal(again.gold, 30.5);
});

test("abandonment banks rewards, records stats and does not become a win", () => {
  const p = settleRun(beginRun(createDefaultProfile(), "run-1", "ranger"), "run-1", stats({ abandoned: true }));
  assert.equal(p.gold, 30.5); assert.equal(p.runs, 1); assert.equal(p.wins, 0);
  assert.equal(p.history[0].outcome, "abandoned"); assert.equal(p.history[0].hunter, "ranger");
  assert.equal(p.mastery.ranger.kills, 20);
});

test("new run finalizes an interrupted attempt using its last durable counters", () => {
  let p = checkpointRun(beginRun(createDefaultProfile(), "run-1", "mage"), "run-1", 20.5, stats());
  p = beginRun(p, "run-2", "reaper");
  assert.equal(p.gold, 20.5); assert.equal(p.runs, 1);
  assert.equal(p.history[0].outcome, "abandoned"); assert.equal(p.history[0].time, 100);
  assert.equal(p.rewardLedger?.runId, "run-2");
  assert.equal(settleRun(p, "run-1", stats({ gold: 999 })), p);
});

test("history stays bounded while stale settlements remain rejected", () => {
  let p = createDefaultProfile();
  for (let i = 0; i < MAX_HISTORY + 5; i++) p = settleRun(beginRun(p, `run-${i}`, "knight"), `run-${i}`, stats({ gold: 1 }));
  assert.equal(p.runs, MAX_HISTORY + 5); assert.equal(p.gold, MAX_HISTORY + 5);
  assert.equal(p.history.length, MAX_HISTORY);
  assert.equal(settleRun(p, "run-0", stats({ gold: 900 })), p);
  assert.equal(checkpointRun(p, "run-0", 900), p);
});

test("discoveries and mastery reward actual winning builds without locking original content", () => {
  let p = createDefaultProfile();
  const hunters = ["knight", "ranger", "mage", "reaper"] as const;
  for (const hunter of hunters) p = settleRun(beginRun(p, hunter, hunter), hunter, stats({ won: true, time: 1800, kills: 300 }), { evolutions: ["bow", "orb"], weapons: ["bow", "orb"] });
  assert.equal(p.wins, 4);
  assert.ok(p.achievements.includes("four_dawns")); assert.ok(p.achievements.includes("four_hunters"));
  assert.ok(p.achievements.includes("thousand_slain")); assert.ok(p.achievements.includes("first_evolution"));
  assert.deepEqual(p.discoveries.evolutions, ["bow", "orb"]);
});

test("snapshots detach mutable arrays and invalid snapshots do not erase permanent rewards", () => {
  const p = checkpointRun(beginRun(createDefaultProfile(), "run-1", "knight"), "run-1", 12.5);
  const state = { hp: 35, enemies: [{ hp: 4 }] };
  const snap = withRunSnapshot(p, "run-1", state);
  state.enemies[0].hp = 0;
  assert.equal((snap.activeRun?.state as typeof state).enemies[0].hp, 4);
  assert.throws(() => withRunSnapshot(p, "run-1", { hp: Infinity }), SaveDataError);
  assert.throws(() => withRunSnapshot(p, "run-1", { runId: "other-run", hp: 40 }), SaveDataError);
  assert.throws(() => withRunSnapshot(p, "run-1", { charId: "mage", hp: 40 }), SaveDataError);
  const invalid = parseProfile(JSON.stringify({ ...snap, activeRun: { ...snap.activeRun, version: 99 } }));
  assert.equal(invalid.activeRun, null); assert.equal(invalid.gold, 12.5);
  assert.equal(settleRun(snap, "run-1", stats()).activeRun, null);
});

test("engine rejects corrupted modal/content snapshots before changing the active run", () => {
  const makeGame = () => new Game(new Input(), { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onBossWarning() {}, onRunEnd() {} }, { autoStart: false, seed: 1 });
  const source = makeGame(); source.startRun("knight", { ...BASE_STATS });
  const original = source.exportSnapshot()!;
  const corruptions = [
    (s: Record<string, unknown>) => { (s.weapons as { id: string }[])[0].id = "constructor"; },
    (s: Record<string, unknown>) => { s.phase = "levelup"; s.currentDraft = [{ kind: "banana", id: "bow", name: { bad: true } }]; },
    (s: Record<string, unknown>) => { s.phase = "covenant"; s.covenant = { status: "complete", x: 0, y: 0, remaining: 0, progress: 12, target: 12, reward: "frost" }; },
  ];
  for (const corrupt of corruptions) {
    const target = makeGame(); target.startRun("ranger", { ...BASE_STATS });
    const identity = target.runId, snapshot = structuredClone(original);
    corrupt(snapshot);
    assert.equal(target.importSnapshot(snapshot), false);
    assert.equal(target.runId, identity); assert.equal(target.charId, "ranger");
    target.dispose();
  }
  source.dispose();
});

test("missing storage is ready/new; failed storage is error/unwritable", async () => {
  const missing = createProfileRepository(memoryStorage().storage);
  const fresh = await missing.load(); assert.equal(fresh.status, "ready"); assert.equal(fresh.isNew, true);
  let writes = 0;
  const failed = createProfileRepository({ async loadData() { throw new Error("Offline"); }, async saveData() { writes++; } });
  const result = await failed.load(); assert.equal(result.status, "error"); assert.equal(result.profile, null); assert.equal(result.isNew, false);
  await assert.rejects(failed.save(createDefaultProfile()), SaveDataError); assert.equal(writes, 0);
});

test("corrupt save exposes a valid backup without overwriting the corrupt original", async () => {
  const memory = memoryStorage("{");
  memory.storage.loadBackup = async () => JSON.stringify({ gold: 123, upgrades: {} });
  const repository = createProfileRepository(memory.storage);
  const result = await repository.load();
  assert.equal(result.status, "error"); assert.equal(result.backup?.gold, 123);
  await assert.rejects(repository.save(result.backup!), SaveDataError);
  assert.equal(memory.read(), "{"); assert.equal(memory.writes.length, 0);
});

test("explicit backup recovery restores verified progress and preserves the recovery copy", async () => {
  const memory = memoryStorage("{");
  memory.storage.loadBackup = async () => JSON.stringify({ gold: 123, upgrades: { might: 1 } });
  let preserveBackup = false;
  const write = memory.storage.saveData;
  memory.storage.saveData = async (raw, options) => { preserveBackup = options?.preserveBackup === true; await write(raw); };
  const repository = createProfileRepository(memory.storage);
  assert.equal((await repository.load()).status, "error");
  const recovered = await repository.recoverBackup();
  assert.equal(recovered.status, "ready"); assert.equal(recovered.profile?.gold, 123);
  assert.equal(parseProfile(memory.read()!).upgrades.might, 1); assert.equal(preserveBackup, true);
  await repository.save(updateSettings(recovered.profile!, { highContrast: true }));
});

test("backup recovery cannot overwrite data changed after the failed load", async () => {
  const memory = memoryStorage("{");
  memory.storage.loadBackup = async () => JSON.stringify({ gold: 123, upgrades: {} });
  const repository = createProfileRepository(memory.storage);
  await repository.load();
  memory.replace(JSON.stringify({ gold: 999, upgrades: {} }));
  assert.equal((await repository.recoverBackup()).status, "error");
  assert.equal(parseProfile(memory.read()!).gold, 999); assert.equal(memory.writes.length, 0);
});

test("an unreadable primary cannot authorize backup recovery", async () => {
  let writes = 0;
  const repository = createProfileRepository({ async loadData() { throw new Error("offline"); },
    async loadBackup() { return '{"gold":50,"upgrades":{}}'; }, async saveData() { writes++; } });
  const result = await repository.load();
  assert.equal(result.backup, undefined, "failed primary reads must not offer an unusable recovery action");
  assert.equal((await repository.recoverBackup()).status, "error"); assert.equal(writes, 0);
});

test("future-version progress never offers an older recovery that could erase newer content", async () => {
  const memory = memoryStorage('{"version":999,"gold":5000}');
  memory.storage.loadBackup = async () => '{"gold":50,"upgrades":{}}';
  const repository = createProfileRepository(memory.storage);
  const result = await repository.load();
  assert.equal(result.status, "error"); assert.equal(result.backup, undefined);
  assert.equal((await repository.recoverBackup()).status, "error"); assert.equal(memory.writes.length, 0);
});

test("browser recovery retains the last good backup even when the primary write fails", async () => {
  const backup = JSON.stringify({ gold: 123, upgrades: {} });
  const entries = new Map([[SAVE_KEY, "{"], [`${SAVE_KEY}-backup`, backup]]);
  let fail = true;
  const browser = new GamePlatform({ target: "web", storage: {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { if (key === SAVE_KEY && fail) throw new Error("quota"); entries.set(key, value); },
  } });
  const repository = createProfileRepository(browser);
  assert.equal((await repository.load()).status, "error");
  assert.equal((await repository.recoverBackup()).status, "error");
  assert.equal(entries.get(`${SAVE_KEY}-backup`), backup); assert.equal(entries.get(SAVE_KEY), "{");
  fail = false;
  assert.equal((await repository.recoverBackup()).status, "ready");
  assert.equal(entries.get(`${SAVE_KEY}-backup`), backup);
  assert.equal(parseProfile(entries.get(SAVE_KEY)!).gold, 123);
});

test("human-readable builds survive settlement and reload while discoveries use stable IDs", () => {
  const result = stats({ build: ["Sword Wave Lv.8", "Whetstone Lv.5"], weaponIds: ["swordwave"] });
  const p = settleRun(beginRun(createDefaultProfile(), "run-1", "knight"), "run-1", result);
  const loaded = parseProfile(JSON.stringify(p));
  assert.deepEqual(loaded.history[0].build, result.build);
  assert.deepEqual(loaded.discoveries.weapons, ["swordwave"]);
});

test("an actual engine snapshot older than the gold ledger cannot farm a repeated pickup", () => {
  let profile = createDefaultProfile();
  const makeGame = () => new Game(new Input(), {
    onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onBossWarning() {},
    onRunStart(runId, hunter) { profile = beginRun(profile, runId, hunter); },
    onProgress(s) { profile = checkpointRun(profile, s.runId, s.gold, s); },
    onRunEnd(s) { profile = settleRun(profile, s.runId, s); },
  }, { autoStart: false, seed: 1 });
  const original = makeGame();
  original.startRun("knight", { ...BASE_STATS, goldGain: 1.1 });
  original.spawnTimer = 10000;
  original.dropPickup("coin", 0, 0, 5);
  const olderSnapshot = original.exportSnapshot()!;
  original.step(1 / 60);
  assert.equal(profile.gold, 5.5);
  profile = parseProfile(JSON.stringify(withRunSnapshot(profile, original.runId, olderSnapshot)));
  const restored = makeGame();
  assert.equal(restored.importSnapshot(profile.activeRun!.state), true);
  restored.step(1 / 60);
  assert.equal(profile.gold, 5.5, "repeated saved coin is already credited");
  restored.dropPickup("coin", 0, 0, 5);
  restored.step(1 / 60);
  assert.equal(profile.gold, 11, "new earned value is credited");
  restored.abandonRun();
  assert.equal(profile.gold, 11); assert.equal(profile.runs, 1); assert.equal(profile.activeRun, null);
  original.dispose(); restored.dispose();
});

test("queued writes cannot finish out of order or read later mutations from callers", async () => {
  const memory = memoryStorage();
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const original = memory.storage.saveData;
  let calls = 0;
  memory.storage.saveData = async (data) => { if (++calls === 1) await blocked; await original(data); };
  const repository = createProfileRepository(memory.storage);
  const p = (await repository.load()).profile!;
  const first = updateSettings(p, { musicVolume: 0.2 });
  const second = updateSettings(first, { musicVolume: 0.7 });
  const one = repository.save(first), two = repository.save(second);
  second.settings.musicVolume = 0.99;
  release(); await Promise.all([one, two]);
  assert.equal(memory.writes.length, 1);
  assert.equal(parseProfile(memory.read()!).settings.musicVolume, 0.7);
  await assert.rejects(repository.save(first), SaveConflictError);
});

test("bursts coalesce behind an in-flight write and promises wait for their covering revision", async () => {
  const memory = memoryStorage();
  let releaseFirst!: () => void, releaseLatest!: () => void, firstStarted!: () => void, latestStarted!: () => void;
  const firstGate = new Promise<void>((r) => { releaseFirst = r; });
  const latestGate = new Promise<void>((r) => { releaseLatest = r; });
  const beganFirst = new Promise<void>((r) => { firstStarted = r; });
  const beganLatest = new Promise<void>((r) => { latestStarted = r; });
  const write = memory.storage.saveData;
  let call = 0;
  memory.storage.saveData = async (raw) => {
    if (++call === 1) { firstStarted(); await firstGate; } else { latestStarted(); await latestGate; }
    await write(raw);
  };
  const repository = createProfileRepository(memory.storage);
  let p = updateSettings((await repository.load()).profile!, { musicVolume: 0.1 });
  const first = repository.save(p);
  await beganFirst;
  const promises: Promise<void>[] = [];
  let settled = 0;
  for (let i = 0; i < 25; i++) { p = updateSettings(p, { musicVolume: i / 25 }); promises.push(repository.save(p).then(() => { settled++; })); }
  releaseFirst(); await first; await beganLatest;
  assert.equal(settled, 0); assert.equal(memory.writes.length, 1);
  const remountLoad = repository.load();
  releaseLatest(); await Promise.all(promises);
  assert.equal(settled, 25); assert.equal(memory.writes.length, 2);
  assert.equal((await remountLoad).profile?.revision, p.revision);
  assert.equal(parseProfile(memory.read()!).settings.musicVolume, 24 / 25);
});

test("idle pause checkpoints write once without loading and ordinary saves await resume", async () => {
  let pause!: () => void, resume!: () => void, raw = "", reads = 0;
  const writes: { raw: string; paused: boolean }[] = [];
  let paused = false;
  const sdk: PlayablesSdk = { IN_PLAYABLES_ENV: true, game: {
    firstFrameReady() {}, gameReady() {}, async loadData() { assert.equal(paused, false); reads++; return raw; },
    async saveData(data) { raw = data; writes.push({ raw: data, paused }); },
  }, system: { isAudioEnabled: () => true, onAudioEnabledChange: () => () => {},
    onPause(cb) { pause = cb; return () => {}; }, onResume(cb) { resume = cb; return () => {}; } } };
  const adapter = new GamePlatform({ target: "playables", sdk });
  const repository = createProfileRepository(adapter);
  let p = (await repository.load()).profile!;
  paused = true; pause();
  p = updateSettings(p, { musicVolume: 0.2 });
  const boundary = repository.saveOnPause(p);
  assert.equal(writes.length, 1, "boundary API invoked before returning to the caller");
  assert.equal(reads, 1, "boundary never performs another load");
  await boundary;
  p = updateSettings(p, { musicVolume: 0.7 });
  const queued = repository.save(p);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(reads, 1); assert.equal(writes.length, 1);
  paused = false; resume(); await queued;
  assert.equal(writes.length, 2); assert.equal(writes[1].paused, false);
  assert.equal(parseProfile(raw).settings.musicVolume, 0.7);
  adapter.dispose();
});

test("pause during an in-flight write queues the latest checkpoint without overlapping requests", async () => {
  let pause!: () => void, resume!: () => void, raw = "", reads = 0, writes = 0, paused = false;
  let started!: () => void, release!: () => void;
  const began = new Promise<void>((r) => { started = r; });
  const held = new Promise<void>((r) => { release = r; });
  const sdk: PlayablesSdk = { IN_PLAYABLES_ENV: true, game: {
    firstFrameReady() {}, gameReady() {}, async loadData() { assert.equal(paused, false); reads++; return raw; },
    async saveData(data) { assert.equal(paused, false, "no new network save while paused"); if (++writes === 1) { started(); await held; } raw = data; },
  }, system: { isAudioEnabled: () => true, onAudioEnabledChange: () => () => {},
    onPause(cb) { pause = cb; return () => {}; }, onResume(cb) { resume = cb; return () => {}; } } };
  const adapter = new GamePlatform({ target: "playables", sdk });
  const repository = createProfileRepository(adapter);
  let p = updateSettings((await repository.load()).profile!, { musicVolume: 0.2 });
  const first = repository.save(p); await began;
  paused = true; pause();
  p = updateSettings(p, { musicVolume: 0.7 });
  const checkpoint = repository.saveOnPause(p);
  release(); await first;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(reads, 2); assert.equal(writes, 1);
  paused = false; resume(); await checkpoint;
  assert.equal(writes, 2); assert.equal(parseProfile(raw).settings.musicVolume, 0.7);
  adapter.dispose();
});

test("a failed write can be retried and does not poison subsequent writes", async () => {
  const memory = memoryStorage();
  const write = memory.storage.saveData;
  let fail = true;
  memory.storage.saveData = async (raw) => { if (fail) { fail = false; throw new Error("quota"); } await write(raw); };
  const repository = createProfileRepository(memory.storage);
  const p = updateSettings((await repository.load()).profile!, { highContrast: true });
  await assert.rejects(repository.save(p), /quota/);
  await assert.rejects(repository.flush(), /quota/);
  await repository.save(p);
  await repository.flush();
  assert.equal(parseProfile(memory.read()!).settings.highContrast, true);
});

test("another writer's data is preserved and saving stops until reloaded", async () => {
  const memory = memoryStorage();
  const repository = createProfileRepository(memory.storage);
  const p = (await repository.load()).profile!;
  memory.replace(JSON.stringify({ gold: 500, upgrades: {} }));
  await assert.rejects(repository.save(updateSettings(p, { highContrast: true })), SaveConflictError);
  assert.equal(repository.getStatus(), "conflict"); assert.equal(memory.writes.length, 0);
  const reloaded = await repository.load();
  assert.equal(reloaded.profile?.gold, 500);
});

test("malformed snapshot timestamps discard the run without invalidating permanent progress", async () => {
  const profile = beginRun(createDefaultProfile(), "run-1", "knight");
  profile.gold = 321;
  for (const savedAt of [-1, "yesterday", null, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const raw = JSON.stringify({ ...profile, activeRun: { version: 1, runId: "run-1", savedAt, state: { runId: "run-1", charId: "knight" } } });
    const repository = createProfileRepository(memoryStorage(raw).storage);
    const loaded = await repository.load();
    assert.equal(loaded.status, "ready"); assert.equal(loaded.profile?.gold, 321);
    assert.equal(loaded.profile?.activeRun, null); assert.match(loaded.warning ?? "", /cannot be resumed/);
  }
});

test("a conflict between read and write locks every coalesced caller until explicit reload", async () => {
  const memory = memoryStorage();
  let entered!: () => void, release!: () => void;
  const began = new Promise<void>(resolve => { entered = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  memory.storage.saveData = async () => {
    entered(); await held;
    memory.replace(JSON.stringify({ gold: 999, upgrades: {} }));
    const error = new Error("Another window changed progress"); error.name = "SaveConflictError"; throw error;
  };
  const repository = createProfileRepository(memory.storage);
  const initial = (await repository.load()).profile!;
  const first = updateSettings(initial, { musicVolume: 0.2 });
  const firstSave = repository.save(first);
  const firstRejected = assert.rejects(firstSave, { name: "SaveConflictError" });
  await began;
  const latest = updateSettings(first, { musicVolume: 0.3 });
  const latestSave = repository.save(latest);
  const latestRejected = assert.rejects(latestSave, SaveConflictError);
  release(); await Promise.all([firstRejected, latestRejected]);
  assert.equal(repository.getStatus(), "conflict");
  await assert.rejects(repository.save(updateSettings(latest, { musicVolume: 0.4 })), SaveConflictError);
  assert.equal((await repository.load()).profile?.gold, 999, "reload must read the other writer, not return the cached profile");
});

test("a lost write acknowledgement does not turn the next queued revision into a false conflict", async () => {
  const memory = memoryStorage(); const write = memory.storage.saveData;
  let entered!: () => void, release!: () => void;
  const began = new Promise<void>(resolve => { entered = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  let first = true;
  memory.storage.saveData = async raw => {
    await write(raw);
    if (first) { first = false; entered(); await held; throw new Error("Acknowledgement lost"); }
  };
  const repository = createProfileRepository(memory.storage);
  const earlier = updateSettings((await repository.load()).profile!, { musicVolume: 0.2 });
  const saveEarlier = repository.save(earlier);
  const failure = assert.rejects(saveEarlier, /Acknowledgement lost/); await began;
  const latest = updateSettings(earlier, { musicVolume: 0.7 });
  const saveLatest = repository.save(latest);
  release(); await failure; await saveLatest;
  assert.equal(repository.getStatus(), "ready");
  assert.equal(parseProfile(memory.read()!).settings.musicVolume, 0.7);
  assert.equal(memory.writes.length, 2); await repository.flush();
});

test("an externally deleted primary is a conflict, not an acknowledged empty save", async () => {
  const memory = memoryStorage('{"gold":500,"upgrades":{}}');
  const repository = createProfileRepository(memory.storage);
  const profile = (await repository.load()).profile!;
  memory.replace(null);
  await assert.rejects(repository.save(updateSettings(profile, { highContrast: true })), SaveConflictError);
  assert.equal(repository.getStatus(), "conflict"); assert.equal(memory.writes.length, 0);
});

test("a lost pause-checkpoint acknowledgement can be reconciled on the next normal save", async () => {
  const memory = memoryStorage(); const write = memory.storage.saveData;
  memory.storage.saveData = async (raw, options) => {
    await write(raw);
    if (options?.pauseCheckpoint) throw new Error("Pause checkpoint acknowledgement lost");
  };
  const repository = createProfileRepository(memory.storage);
  const checkpoint = updateSettings((await repository.load()).profile!, { musicVolume: 0.2 });
  await assert.rejects(repository.saveOnPause(checkpoint), /acknowledgement lost/);
  await repository.save(updateSettings(checkpoint, { musicVolume: 0.8 }));
  assert.equal(repository.getStatus(), "ready");
  assert.equal(parseProfile(memory.read()!).settings.musicVolume, 0.8);
  await repository.flush();
});
