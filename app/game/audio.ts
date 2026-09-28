// WebAudio synthesized SFX + a dark procedural music loop.
// No audio assets needed — everything is generated.

type SfxName =
  | "hit"
  | "shoot"
  | "slash"
  | "zap"
  | "fire"
  | "frost"
  | "pickup"
  | "gold"
  | "levelup"
  | "chest"
  | "hurt"
  | "death"
  | "bossSpawn"
  | "bossDie"
  | "explosion"
  | "heal"
  | "click"
  | "victory"
  | "evolve";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  muted = false;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private musicStep = 0;
  private lastSfx: Record<string, number> = {};
  private platformEnabled = true;
  private suspended = false;
  private unlocked = false;
  private musicWanted = false;
  private musicVolume = 0.65;
  private effectsVolume = 0.8;
  private intensity: "menu" | "hunt" | "boss" | "dawn" = "hunt";
  private nextMusicTime = 0;
  private voices = new Map<AudioScheduledSourceNode, { nodes: AudioNode[]; music: boolean }>();
  private noiseBuffers = new Map<number, AudioBuffer>();

  get isAudible() { return !this.muted && this.platformEnabled && !this.suspended; }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[], music = false) {
    this.voices.set(source, { nodes, music });
    source.onended = () => {
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
      this.voices.delete(source);
    };
  }

  private stopVoices(musicOnly = false) {
    for (const [source, voice] of this.voices) {
      if (musicOnly && !voice.music) continue;
      try { source.stop(); } catch { /* already ended */ }
      source.disconnect();
      voice.nodes.forEach((node) => node.disconnect());
      this.voices.delete(source);
    }
  }

  private applyGate() {
    if (!this.ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setValueAtTime(this.isAudible ? 0.55 : 0, this.ctx.currentTime);
    if (!this.isAudible) {
      this.cancelMusic();
      this.stopVoices();
      void this.ctx.suspend().catch(() => {});
    } else if (this.unlocked) {
      void this.ctx.resume().then(() => this.scheduleMusic()).catch(() => {});
    }
  }

  setVolumes(music: number, effects: number) {
    this.musicVolume = Number.isFinite(music) ? Math.max(0, Math.min(1, music)) : 0.65;
    this.effectsVolume = Number.isFinite(effects) ? Math.max(0, Math.min(1, effects)) : 0.8;
    if (this.ctx) {
      this.musicGain?.gain.setTargetAtTime(this.musicVolume * 0.38, this.ctx.currentTime, 0.03);
      this.sfxGain?.gain.setTargetAtTime(this.effectsVolume, this.ctx.currentTime, 0.03);
    }
    if (!this.musicVolume) { this.cancelMusic(); this.stopVoices(true); }
    else this.scheduleMusic();
  }

  setPlatformEnabled(enabled: boolean) { this.platformEnabled = enabled; this.applyGate(); }
  setSuspended(suspended: boolean) { this.suspended = suspended; this.applyGate(); }
  setIntensity(intensity: "menu" | "hunt" | "boss" | "dawn") { this.intensity = intensity; }


  init() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.isAudible ? 0.55 : 0;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.effectsVolume;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume * 0.38;
      this.musicGain.connect(this.master);
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.unlocked = true;
    this.init();
    this.applyGate();
  }

  setMuted(muted: boolean) { this.muted = muted; this.applyGate(); }

  // ----------------------------------------------------------- SFX

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.sfxGain || !this.isAudible || this.voices.size >= 64) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.sfxGain);
    this.track(osc, [g]);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq = 1200, delay = 0) {
    if (!this.ctx || !this.sfxGain || !this.isAudible || this.voices.size >= 64) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    let buf = this.noiseBuffers.get(len);
    if (!buf) {
      buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      if (this.noiseBuffers.size >= 8) this.noiseBuffers.clear();
      this.noiseBuffers.set(len, buf);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.sfxGain);
    this.track(src, [filter, g]);
    src.start(t0);
  }

  sfx(name: SfxName) {
    if (!this.ctx || !this.isAudible || this.effectsVolume <= 0) return;
    // rate-limit identical sfx to avoid clipping with hundreds of hits
    const now = performance.now();
    const minGap: Record<string, number> = { hit: 45, shoot: 60, pickup: 35, slash: 70, zap: 70, gold: 50, explosion: 80, fire: 70, frost: 70, heal: 80 };
    const gap = minGap[name] ?? 0;
    if (gap && now - (this.lastSfx[name] ?? 0) < gap) return;
    this.lastSfx[name] = now;

    switch (name) {
      case "hit":
        this.tone(180 + Math.random() * 60, 0.07, "square", 0.05, 80);
        break;
      case "shoot":
        this.tone(620, 0.08, "triangle", 0.06, 220);
        break;
      case "slash":
        this.noise(0.08, 0.07, 2600);
        break;
      case "zap":
        this.tone(900, 0.12, "sawtooth", 0.06, 120);
        this.noise(0.08, 0.04, 3500);
        break;
      case "fire":
        this.noise(0.18, 0.08, 900);
        this.tone(160, 0.18, "sawtooth", 0.05, 60);
        break;
      case "frost":
        this.tone(1100, 0.1, "sine", 0.05, 1600);
        break;
      case "pickup":
        this.tone(760, 0.07, "sine", 0.05, 1050);
        break;
      case "gold":
        this.tone(1180, 0.06, "square", 0.04, 1500);
        this.tone(1570, 0.07, "square", 0.03, 1800, 0.05);
        break;
      case "heal":
        this.tone(420, 0.15, "sine", 0.07, 700);
        this.tone(640, 0.2, "sine", 0.05, 900, 0.08);
        break;
      case "levelup":
        [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.16, "triangle", 0.08, undefined, i * 0.07));
        break;
      case "evolve":
        [262, 330, 392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.08, undefined, i * 0.07));
        this.noise(0.5, 0.05, 1800, 0.3);
        break;
      case "chest":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, "square", 0.05, undefined, i * 0.09));
        break;
      case "hurt":
        this.tone(140, 0.18, "sawtooth", 0.1, 60);
        this.noise(0.1, 0.06, 600);
        break;
      case "death":
        this.tone(220, 0.8, "sawtooth", 0.12, 40);
        this.noise(0.7, 0.1, 500);
        break;
      case "explosion":
        this.noise(0.4, 0.14, 700);
        this.tone(90, 0.35, "sine", 0.12, 30);
        break;
      case "bossSpawn":
        this.tone(70, 1.1, "sawtooth", 0.14, 45);
        this.noise(0.9, 0.08, 350);
        [110, 104, 98].forEach((f, i) => this.tone(f, 0.5, "square", 0.06, undefined, 0.25 * i));
        break;
      case "bossDie":
        this.noise(1.2, 0.14, 900);
        [523, 392, 330, 262].forEach((f, i) => this.tone(f, 0.4, "triangle", 0.08, undefined, 0.18 * i));
        break;
      case "victory":
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.1, undefined, i * 0.16));
        break;
      case "click":
        this.tone(880, 0.04, "square", 0.03);
        break;
    }
  }

  // ----------------------------------------------------------- Music
  // A brooding minor arpeggio loop with a slow bass pulse.

  startMusic() {
    if (!this.musicWanted) this.musicStep = 0;
    this.musicWanted = true;
    this.scheduleMusic();
  }

  private scheduleMusic() {
    if (!this.ctx || !this.musicGain || !this.musicWanted || !this.isAudible ||
        !this.unlocked || this.musicVolume <= 0 || this.musicTimer !== null) return;
    this.nextMusicTime = this.ctx.currentTime + 0.03;
    const tick = () => {
      this.musicTimer = null;
      if (!this.ctx || !this.musicGain || !this.musicWanted || !this.isAudible || this.musicVolume <= 0) return;
      const bpm = this.intensity === "boss" ? 144 : this.intensity === "dawn" ? 100 : 126;
      const stepDur = 60 / bpm / 2;
      const chords = this.intensity === "dawn"
        ? [[110, 220, 277.2, 329.6], [87.3, 174.6, 220, 261.6], [98, 196, 246.9, 293.7], [110, 220, 277.2, 329.6]]
        : [[110, 220, 261.6, 329.6], [87.3, 174.6, 220, 261.6], [73.4, 146.8, 220, 293.7], [82.4, 164.8, 246.9, 311.1]];
      // Schedule against AudioContext time; event-loop jitter does not shift the notes.
      this.nextMusicTime = Math.max(this.nextMusicTime, this.ctx.currentTime);
      while (this.nextMusicTime < this.ctx.currentTime + 0.12) {
        const chord = chords[Math.floor(this.musicStep / 16) % chords.length];
        const step = this.musicStep % 16;
        const t0 = this.nextMusicTime;
        if (step % 8 === 0) {
          const bass = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          bass.type = "triangle";
          bass.frequency.value = chord[0];
          gain.gain.setValueAtTime(0.14, t0);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur * 7);
          bass.connect(gain).connect(this.musicGain);
          this.track(bass, [gain], true);
          bass.start(t0);
          bass.stop(t0 + stepDur * 7);
        }
        const arp = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        arp.type = this.intensity === "dawn" ? "triangle" : "square";
        arp.frequency.value = chord[1 + step % 3] * (step % 6 === 5 ? 2 : 1);
        gain.gain.setValueAtTime(this.intensity === "boss" ? 0.045 : 0.03, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur * 0.95);
        filter.type = "lowpass";
        filter.frequency.value = this.intensity === "boss" ? 1700 : 1100;
        arp.connect(filter).connect(gain).connect(this.musicGain);
        this.track(arp, [filter, gain], true);
        arp.start(t0);
        arp.stop(t0 + stepDur);
        this.musicStep++;
        this.nextMusicTime += stepDur;
      }
      this.musicTimer = setTimeout(tick, 50);
    };
    tick();
  }

  private cancelMusic() {
    if (this.musicTimer !== null) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  stopMusic() {
    this.musicWanted = false;
    this.cancelMusic();
    this.stopVoices(true);
  }

  dispose() {
    this.stopMusic();
    this.stopVoices();
    const context = this.ctx;
    this.ctx = null;
    this.master = this.musicGain = this.sfxGain = null;
    this.noiseBuffers.clear();
    this.lastSfx = {};
    this.unlocked = false;
    if (context) void context.close().catch(() => {});
  }
}

export const audio = new AudioEngine();
