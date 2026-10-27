export type RGBA = [number, number, number, number];

const cache = new Map<string, RGBA>();

/** Parses '#rgb', '#rrggbb' or '#rrggbbaa'. */
export function rgba(hex: string, alpha?: number): RGBA {
  let c = cache.get(hex);
  if (!c) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.replace(/./g, (x) => x + x);
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
    cache.set(hex, c);
  }
  return alpha === undefined ? c : [c[0], c[1], c[2], Math.round(alpha * 255)];
}

export function mix(a: string, b: string, t: number): RGBA {
  const x = rgba(a);
  const y = rgba(b);
  return [0, 1, 2, 3].map((i) => Math.round(x[i]! + (y[i]! - x[i]!) * t)) as RGBA;
}
