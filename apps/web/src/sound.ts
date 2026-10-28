import type { Sound } from '@cosmo-merge/engine';

/** Synthesized effects with Web Audio, so the game ships no audio files. */
export class WebSound implements Sound {
  #ctx: AudioContext | null = null;
  #master: GainNode | null = null;
  #noise: AudioBuffer | null = null;

  /** Browsers only allow audio after a user gesture. */
  unlock(): void {
    if (!this.#ctx) {
      const ctx = new AudioContext();
      this.#master = ctx.createGain();
      this.#master.gain.value = 0.5;
      this.#master.connect(ctx.destination);
      const noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.#noise = noise;
      this.#ctx = ctx;
    }
    if (this.#ctx.state === 'suspended') void this.#ctx.resume();
  }

  play(name: string, { pitch = 1, volume = 1 }: { pitch?: number; volume?: number } = {}): void {
    const ctx = this.#ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (name) {
      case 'tap': return this.#tone('sine', 880, 1320, 0.07, 0.25 * volume, t);
      case 'drop': return this.#tone('triangle', 520 * pitch, 300 * pitch, 0.12, 0.3 * volume, t);
      case 'pop': return this.#tone('sine', 700 * pitch, 1100 * pitch, 0.09, 0.25 * volume, t);
      case 'land': return this.#thump(0.35 * volume, 300 * pitch, t);
      case 'merge':
        this.#tone('sine', 420 * pitch, 840 * pitch, 0.16, 0.4 * volume, t);
        return this.#tone('triangle', 630 * pitch, 1260 * pitch, 0.12, 0.15 * volume, t + 0.02);
      case 'combo':
        this.#tone('square', 520 * pitch, 780 * pitch, 0.08, 0.12 * volume, t);
        this.#tone('sine', 780 * pitch, 1170 * pitch, 0.14, 0.35 * volume, t + 0.07);
        return;
      case 'best':
        [523, 659, 784, 1047].forEach((f, i) => this.#tone('triangle', f, f, 0.18, 0.3, t + i * 0.09));
        return;
      case 'gameover':
        [392, 330, 262].forEach((f, i) => this.#tone('triangle', f, f * 0.97, 0.3, 0.3, t + i * 0.16));
        return;
      case 'supernova':
        this.#thump(0.8, 900, t);
        return this.#tone('sawtooth', 90, 40, 0.9, 0.35, t);
    }
  }

  #tone(type: OscillatorType, from: number, to: number, dur: number, vol: number, at: number): void {
    const ctx = this.#ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(this.#master!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  #thump(vol: number, cutoff: number, at: number): void {
    const ctx = this.#ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.#noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    src.connect(filter).connect(gain).connect(this.#master!);
    src.start(at);
    src.stop(at + 0.15);
  }
}
