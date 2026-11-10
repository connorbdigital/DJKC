import { TRACKS, type Track } from "./data";

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * A tiny four-on-the-floor house engine built on Web Audio.
 * Synthesises kick / hats / clap / bass / chord stabs per track definition,
 * scheduled with a lookahead loop. No samples, no network, no autoplay.
 */
export class HouseEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private analyserNode!: AnalyserNode;
  private delaySend!: GainNode;
  private delay!: DelayNode;
  private noiseBuf!: AudioBuffer;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private startedAt = 0;
  private track: Track = TRACKS[0];
  private volume = 0.8;
  private muted = false;
  playing = false;

  get analyser(): AnalyserNode | null {
    return this.ctx ? this.analyserNode : null;
  }

  private ensure() {
    if (this.ctx) return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume * 0.9;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.82;

    this.master.connect(comp);
    comp.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);

    // dotted-eighth feedback delay for stabs / piano
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 1;
    this.delay = ctx.createDelay(1.5);
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2600;
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    this.delaySend.connect(this.delay);
    this.delay.connect(damp);
    damp.connect(fb);
    fb.connect(this.delay);
    damp.connect(wet);
    wet.connect(this.master);

    // 1s of white noise, reused by hats & clap
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  setTrack(i: number) {
    this.track = TRACKS[i] ?? TRACKS[0];
    if (this.ctx) {
      this.delay.delayTime.setTargetAtTime((60 / this.track.bpm) * 0.75, this.ctx.currentTime, 0.1);
      this.step = 0;
      this.startedAt = this.ctx.currentTime;
    }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && !this.muted)
      this.master.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.05);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx)
      this.master.gain.setTargetAtTime(m ? 0 : this.volume * 0.9, this.ctx.currentTime, 0.05);
  }

  getElapsed(): number {
    if (!this.ctx || !this.playing) return 0;
    return Math.max(0, this.ctx.currentTime - this.startedAt);
  }

  play(i: number) {
    this.ensure();
    const ctx = this.ctx!;
    if (ctx.state === "suspended") void ctx.resume();
    this.setTrack(i);
    this.delay.delayTime.value = (60 / this.track.bpm) * 0.75;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.startedAt = this.nextTime;
    this.playing = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop() {
    this.playing = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose() {
    this.stop();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const stepDur = 60 / this.track.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.14) {
      this.schedule(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 32;
    }
  }

  private schedule(step: number, t: number, stepDur: number) {
    const tr = this.track;
    const s = step % 16;
    const bar = Math.floor(step / 16) % tr.chords.length;

    if (s % 4 === 0) this.kick(t);
    if (s === 4 || s === 12) this.clap(t);
    if (s % 4 === 2) this.hat(t, 0.16, 0.11);
    if (tr.style === "tech" && s % 2 === 1) this.hat(t, 0.05, 0.03);

    const b = tr.bass[s];
    if (b) this.bass(t, b, stepDur * (tr.style === "tech" ? 1.6 : 3.2));

    const chord = tr.chords[bar];
    if (tr.style === "vocal") {
      if (s === 0 || s === 8) this.keys(t, chord, stepDur * 7);
      if (s === 0) this.pad(t, chord, stepDur * 16);
    } else if (tr.style === "club") {
      if (s === 2 || s === 10) this.stab(t, chord, 0.22);
    } else if (s === 6) {
      this.stab(t, chord, 0.16);
    }
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    g.gain.setValueAtTime(0.95, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  private hat(t: number, level: number, decay: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.4, decay + 0.05);
  }

  private clap(t: number) {
    const ctx = this.ctx!;
    for (let i = 0; i < 3; i++) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1700;
      bp.Q.value = 1.1;
      const g = ctx.createGain();
      const tt = t + i * 0.011;
      g.gain.setValueAtTime(i === 2 ? 0.34 : 0.16, tt);
      g.gain.exponentialRampToValueAtTime(0.001, tt + (i === 2 ? 0.2 : 0.04));
      src.connect(bp).connect(g).connect(this.master);
      src.start(tt, Math.random() * 0.4, 0.25);
    }
  }

  private bass(t: number, midi: number, len: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = this.track.style === "tech" ? "sawtooth" : "square";
    o.frequency.value = midiHz(midi);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = this.track.style === "tech" ? 8 : 2;
    if (this.track.style === "tech") {
      f.frequency.setValueAtTime(160, t);
      f.frequency.exponentialRampToValueAtTime(1100, t + 0.05);
      f.frequency.exponentialRampToValueAtTime(140, t + len);
    } else {
      f.frequency.value = 420;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  private stab(t: number, chord: number[], len: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.085, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1900;
    f.connect(g);
    g.connect(this.master);
    g.connect(this.delaySend);
    for (const m of chord) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midiHz(m);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + len + 0.05);
      }
    }
  }

  private keys(t: number, chord: number[], len: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    g.connect(this.master);
    g.connect(this.delaySend);
    for (const m of chord) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = midiHz(m + 12);
      const o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.value = midiHz(m);
      o.connect(g);
      o2.connect(g);
      o.start(t);
      o.stop(t + len + 0.05);
      o2.start(t);
      o2.stop(t + len + 0.05);
    }
  }

  private pad(t: number, chord: number[], len: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + len * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    f.connect(g);
    g.connect(this.master);
    for (const m of chord) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = midiHz(m + 12);
      o.detune.value = 8;
      o.connect(f);
      o.start(t);
      o.stop(t + len + 0.1);
    }
  }
}