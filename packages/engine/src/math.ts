export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const DEG = 180 / Math.PI;

/** Seedable PRNG (mulberry32) so a round can be replayed from its seed. */
export class Random {
  #state: number;

  constructor(seed = Date.now()) {
    this.#state = seed >>> 0;
  }

  next(): number {
    let t = (this.#state = (this.#state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  int(lo: number, hiInclusive: number): number {
    return Math.floor(this.range(lo, hiInclusive + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }
}

/** Decodes base64 without relying on `atob`, which not every JS runtime ships. */
export function decodeBase64(input: string): Uint8Array {
  const table = new Uint8Array(128);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < chars.length; i++) table[chars.charCodeAt(i)] = i;
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = table[clean.charCodeAt(i)]!;
    const b = table[clean.charCodeAt(i + 1)]!;
    const c = table[clean.charCodeAt(i + 2)] ?? 0;
    const d = table[clean.charCodeAt(i + 3)] ?? 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}
