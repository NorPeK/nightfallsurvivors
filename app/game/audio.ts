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

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  muted = false;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private musicStep = 0;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.master);
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.init();
    this.ctx?.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
    }
  }

  // ----------------------------------------------------------- SFX

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq = 1200, delay = 0) {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.sfxGain);
    src.start(t0);
  }

  sfx(name: SfxName) {
    if (!this.ctx || this.muted) return;
    // rate-limit identical sfx to avoid clipping with hundreds of hits
    const now = performance.now();
    const minGap: Record<string, number> = { hit: 45, shoot: 60, pickup: 35, slash: 70, zap: 70, gold: 50 };
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
    if (!this.ctx || this.musicTimer) return;
    this.musicStep = 0;
    const bpm = 132;
    const stepDur = 60 / bpm / 2; // 8th notes
    // A harmonic-minor flavored progression: Am, F, Dm, E
    const chords = [
      [110, 220, 261.6, 329.6], // A
      [87.3, 174.6, 220, 261.6], // F
      [73.4, 146.8, 220, 293.7], // D
      [82.4, 164.8, 246.9, 311.1], // E
    ];
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      const stepsPerChord = 16;
      const chord = chords[Math.floor(this.musicStep / stepsPerChord) % chords.length];
      const s = this.musicStep % stepsPerChord;
      const t0 = this.ctx.currentTime;

      // bass on beat
      if (s % 8 === 0) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = "triangle";
        o.frequency.value = chord[0];
        g.gain.setValueAtTime(0.16, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur * 7);
        o.connect(g).connect(this.musicGain);
        o.start(t0);
        o.stop(t0 + stepDur * 7);
      }
      // arpeggio
      const arpNote = chord[1 + (s % 3)];
      const o2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      o2.type = "square";
      o2.frequency.value = arpNote * (s % 6 === 5 ? 2 : 1);
      g2.gain.setValueAtTime(0.035, t0);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur * 0.95);
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 1400;
      o2.connect(f).connect(g2).connect(this.musicGain);
      o2.start(t0);
      o2.stop(t0 + stepDur);

      this.musicStep++;
      this.musicTimer = setTimeout(tick, stepDur * 1000);
    };
    tick();
  }

  stopMusic() {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new AudioEngine();
