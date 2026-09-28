import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../app/game/audio';

class Param {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime(value: number) { assert.ok(Number.isFinite(value)); this.value = value; }
  setTargetAtTime(value: number) { this.setValueAtTime(value); }
  exponentialRampToValueAtTime(value: number) { this.setValueAtTime(value); }
}
class Node {
  gain = new Param(); frequency = new Param(); type = ''; buffer: unknown;
  stopped = false; disconnected = false; onended: (() => void) | null = null;
  connect(target: Node) { return target; }
  disconnect() { this.disconnected = true; }
  start() {}
  stop(time?: number) { if (time === undefined) { this.stopped = true; this.onended?.(); } }
}
class Context {
  static latest: Context;
  currentTime = 1; sampleRate = 1000; destination = new Node(); nodes: Node[] = [];
  gains: Node[] = []; resumeCalls = 0; suspendCalls = 0; closeCalls = 0;
  constructor() { Context.latest = this; }
  createGain() { const n = new Node(); this.gains.push(n); return n; }
  createOscillator() { const n = new Node(); this.nodes.push(n); return n; }
  createBiquadFilter() { return new Node(); }
  createBufferSource() { return this.createOscillator(); }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  async resume() { this.resumeCalls++; }
  async suspend() { this.suspendCalls++; }
  async close() { this.closeCalls++; }
}
function setup(t: TestContext) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: { AudioContext: Context }, configurable: true });
  const audio = new AudioEngine();
  t.after(() => { audio.dispose(); if (prior) Object.defineProperty(globalThis, 'window', prior); else Reflect.deleteProperty(globalThis, 'window'); });
  return audio;
}
test('platform mute stops pending tones and dominates user unmute', async t => {
  const audio = setup(t); audio.resume(); await Promise.resolve(); audio.sfx('victory');
  const ctx = Context.latest; assert.equal(ctx.nodes.length, 5);
  audio.setPlatformEnabled(false); assert.ok(ctx.nodes.every(n => n.stopped && n.disconnected));
  audio.setMuted(false); audio.sfx('death'); assert.equal(ctx.nodes.length, 5);
  assert.equal(ctx.gains[0].gain.value, 0); assert.ok(ctx.suspendCalls > 0);
  audio.setPlatformEnabled(true); await Promise.resolve(); audio.sfx('click'); assert.equal(ctx.nodes.length, 6);
});
test('suspension cancels music and resume schedules only once', async t => {
  const audio = setup(t); audio.startMusic(); assert.equal(audio.isAudible, true);
  audio.resume(); await Promise.resolve(); const ctx = Context.latest; const first = ctx.nodes.length;
  assert.ok(first > 0); audio.startMusic(); audio.startMusic(); assert.equal(ctx.nodes.length, first);
  audio.setSuspended(true); assert.ok(ctx.nodes.every(n => n.stopped));
  audio.setPlatformEnabled(true); await Promise.resolve(); assert.equal(ctx.nodes.length, first);
  audio.setSuspended(false); await Promise.resolve(); assert.ok(ctx.nodes.length > first);
  audio.stopMusic(); assert.ok(ctx.nodes.every(n => n.stopped));
});
test('independent volume controls clamp invalid values and mute only their channel', async t => {
  const audio = setup(t); audio.resume(); await Promise.resolve(); const ctx = Context.latest;
  audio.setVolumes(0, 1); audio.startMusic(); assert.equal(ctx.nodes.length, 0);
  audio.sfx('click'); assert.equal(ctx.nodes.length, 1);
  audio.setVolumes(1, 0); const before = ctx.nodes.length; audio.sfx('click'); assert.equal(ctx.nodes.length, before);
  audio.setVolumes(NaN, Infinity); assert.ok(ctx.gains.every(n => Number.isFinite(n.gain.value)));
});
test('effect voice budget stays bounded and disposal releases every source', async t => {
  const audio = setup(t); audio.resume(); await Promise.resolve(); const ctx = Context.latest;
  for (let i = 0; i < 100; i++) audio.sfx('victory');
  assert.equal(ctx.nodes.length, 64); audio.dispose();
  assert.ok(ctx.nodes.every(n => n.stopped && n.disconnected)); assert.equal(ctx.closeCalls, 1);
  audio.dispose(); assert.equal(ctx.closeCalls, 1);
});
