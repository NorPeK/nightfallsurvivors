import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import {
  beginRun, createDefaultProfile, createProfileRepository, parseProfile, purchaseUpgrade,
  refundUpgrades, SaveDataError, statsWithMeta, type ProfileSave, type ProfileStorage,
} from "../app/game/meta";

const prices = [1000, 2000, 4000, 8000, 16000];
function buyRanks(count: number, gold = 50_000.25): ProfileSave {
  let profile = { ...createDefaultProfile(), gold };
  for (let rank = 0; rank < count; rank++) {
    const result = purchaseUpgrade(profile, "evolutions");
    assert.equal(result.ok, true);
    profile = result.profile;
  }
  return profile;
}

test("Evolutions purchases unlock one additional slot per paid rank, through six total", () => {
  let profile = { ...createDefaultProfile(), gold: 31_000.25 };
  assert.equal(statsWithMeta(profile).evolutionSlots, 1);
  for (const [index, price] of prices.entries()) {
    const before = profile;
    const result = purchaseUpgrade(profile, "evolutions");
    assert.equal(result.ok, true);
    profile = result.profile;
    assert.equal(profile.gold, before.gold - price);
    assert.equal(profile.upgrades.evolutions, index + 1);
    assert.equal(statsWithMeta(profile).evolutionSlots, index + 2);
    assert.deepEqual(profile.paidCosts.evolutions, prices.slice(0, index + 1));
    assert.equal(before.upgrades.evolutions ?? 0, index, "a purchase does not mutate the old profile");
  }
  assert.equal(profile.gold, .25);
});

test("Evolutions cannot spend insufficient gold or buy beyond the fifth rank", () => {
  const poor = { ...createDefaultProfile(), gold: 999.99 };
  const declined = purchaseUpgrade(poor, "evolutions");
  assert.equal(declined.ok, false);
  assert.equal(declined.profile, poor);
  assert.equal(statsWithMeta(poor).evolutionSlots, 1);

  const maxed = buyRanks(5);
  const capped = purchaseUpgrade(maxed, "evolutions");
  assert.equal(capped.ok, false);
  assert.equal(capped.profile, maxed);
  assert.equal(statsWithMeta(maxed).evolutionSlots, 6);
  assert.equal(maxed.paidCosts.evolutions.length, 5);
});

test("Evolutions rank and exact paid prices survive durable profile reload and another purchase", async () => {
  let raw: string | null = null;
  const storage: ProfileStorage = {
    async loadData() { return raw; },
    async saveData(value) { raw = value; },
  };
  const original = createProfileRepository(storage);
  const loaded = await original.load();
  assert.equal(loaded.status, "ready");
  await original.save(buyRanks(3));
  const restarted = createProfileRepository(storage);
  const recovered = await restarted.load();
  assert.equal(recovered.status, "ready");
  assert.equal(recovered.profile!.upgrades.evolutions, 3);
  assert.equal(statsWithMeta(recovered.profile!).evolutionSlots, 4);
  assert.deepEqual(recovered.profile!.paidCosts.evolutions, prices.slice(0, 3));
  const next = purchaseUpgrade(recovered.profile!, "evolutions");
  assert.equal(next.ok, true);
  assert.equal(next.profile.gold, recovered.profile!.gold - 8000);
  assert.equal(statsWithMeta(next.profile).evolutionSlots, 5);
  await restarted.save(next.profile);
  assert.equal(parseProfile(raw!).upgrades.evolutions, 4);
});

test("refund returns the recorded Evolutions spend once and restores the default slot", () => {
  const originalGold = 31_000.25;
  const purchased = parseProfile(JSON.stringify(buyRanks(5, originalGold)));
  const refunded = refundUpgrades(purchased);
  assert.equal(refunded.refunded, 31_000);
  assert.equal(refunded.profile.gold, originalGold);
  assert.equal(refunded.profile.upgrades.evolutions ?? 0, 0);
  assert.equal(statsWithMeta(refunded.profile).evolutionSlots, 1);
  assert.deepEqual(refunded.profile.paidCosts, {});
  assert.equal(refundUpgrades(refunded.profile).refunded, 0);

  const historical = parseProfile(JSON.stringify({
    ...createDefaultProfile(), gold: 4000.125,
    upgrades: { evolutions: 3 }, paidCosts: { evolutions: [900, 1750, 3600] },
  }));
  const oldPriceRefund = refundUpgrades(historical);
  assert.equal(oldPriceRefund.refunded, 6250, "refund uses recorded prices, not today's shop prices");
  assert.equal(oldPriceRefund.profile.gold, 10_250.125);
  assert.equal(statsWithMeta(oldPriceRefund.profile).evolutionSlots, 1);
});

test("profiles made before Evolutions retain their progress and start with one slot", () => {
  for (const raw of [
    '{"gold":1234,"upgrades":{"might":1}}',
    JSON.stringify({ ...createDefaultProfile(), gold: 1234, upgrades: { might: 1 }, paidCosts: { might: [150] } }),
  ]) {
    const profile = parseProfile(raw);
    assert.equal(profile.gold, 1234);
    assert.equal(profile.upgrades.might, 1);
    assert.equal(profile.upgrades.evolutions ?? 0, 0);
    assert.equal(statsWithMeta(profile).evolutionSlots, 1);
    assert.equal(statsWithMeta(profile).might, 1.05);
  }
});

test("invalid saved Evolutions ranks fail closed while direct stat assembly bounds malformed ranks", () => {
  for (const rank of [-1, 6, 1.5, "1", null, true]) {
    assert.throws(() => parseProfile(JSON.stringify({
      ...createDefaultProfile(), upgrades: { evolutions: rank }, paidCosts: { evolutions: [1000] },
    })), SaveDataError);
  }
  for (const [rank, slots] of [[-1, 1], [0, 1], [2.9, 3], [99, 6], [NaN, 1], [Infinity, 1], ["5", 1], [undefined, 1]] as const) {
    const profile = { ...createDefaultProfile(), upgrades: { evolutions: rank } as unknown as Record<string, number> };
    assert.equal(statsWithMeta(profile).evolutionSlots, slots, `rank ${String(rank)}`);
  }
});

test("inherited and unknown upgrade keys cannot unlock Evolutions slots", () => {
  const inherited = { ...createDefaultProfile(), upgrades: Object.create({ evolutions: 5 }) as Record<string, number> };
  assert.equal(statsWithMeta(inherited).evolutionSlots, 1);
  const profile = parseProfile('{"gold":25,"upgrades":{"__proto__":{"evolutions":5},"constructor":5,"unknown":5}}');
  assert.equal(statsWithMeta(profile).evolutionSlots, 1);
  assert.deepEqual(profile.upgrades, {});
  assert.equal(Object.hasOwn(profile.upgrades, "__proto__"), false);
});

test("buying Evolutions leaves an active hunt's captured stats intact and applies to the next hunt", () => {
  const game = new Game(new Input(), {
    onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onBossWarning() {}, onRunEnd() {},
  }, { autoStart: false, seed: 1 });
  try {
    const profile = { ...createDefaultProfile(), gold: 1000 };
    const captured = statsWithMeta(profile);
    game.startRun("knight", captured);
    const active = beginRun(profile, game.runId, "knight");
    const upgraded = purchaseUpgrade(active, "evolutions");
    assert.equal(upgraded.ok, true);
    assert.equal(statsWithMeta(upgraded.profile).evolutionSlots, 2);
    assert.equal(game.stats.evolutionSlots, 1);
    assert.equal(game.exportSnapshot()!.stats.evolutionSlots, 1);
    assert.equal(captured.evolutionSlots, 1);
    assert.equal(refundUpgrades(upgraded.profile).profile, upgraded.profile, "active hunts still block refunds");
    game.startRun("knight", statsWithMeta(upgraded.profile));
    assert.equal(game.stats.evolutionSlots, 2);
  } finally {
    game.dispose();
  }
});
