import { Draw, rgba, type Scene, type TVG } from '@cosmo-merge/engine';
import { MAX_TIER, PlanetFactory } from './planets';

export interface IconOptions {
  /** Paint the space backdrop. Off for layers the platform backs itself (Android adaptive foreground, favicon). */
  sky?: boolean;
  /** Paint only the backdrop (Android adaptive background). */
  skyOnly?: boolean;
  /** Width of the Sun's flames as a fraction of the icon. */
  sun?: number;
  /** Rounded tile with a drop shadow, for macOS, which shows icons unmasked. */
  tile?: boolean;
}

/** The app icon: the game's smiling Sun on its deep-space sky, drawn at `size` x `size`. */
export function drawIcon(TVG: TVG, size: number, { sky = true, skyOnly = false, sun = 0.66, tile = false }: IconOptions = {}): Scene {
  const draw = new Draw(TVG);
  if (tile) {
    // Apple's grid: an 824 tile on a 1024 canvas, corner radius 185.
    const inner = size * 0.805;
    const body = drawIcon(TVG, inner, { sky, skyOnly, sun });
    body.clip(draw.rect(0, 0, inner, inner, inner * 0.225));
    const icon = new TVG.Scene();
    icon.add(body);
    icon.translate((size - inner) / 2, (size - inner) / 2);
    icon.dropShadow(0, 0, 0, 110, 90, size * 0.01, size * 0.012, 100);
    return icon;
  }
  const icon = new TVG.Scene();
  const s = size;

  if (sky || skyOnly) {
    const bg = draw.rect(0, 0, s, s);
    bg.fill(draw.linear(0, 0, 0, s, [[0, '#120a3a'], [0.55, '#2a1466'], [1, '#4a1f7a']]));
    icon.add(bg);
    for (const [cx, cy, r, color] of [
      [0.1, 0.2, 0.75, '#ff4fa3'],
      [0.95, 0.7, 0.8, '#3f6bff'],
      [0.5, 1.05, 0.7, '#ff8a3d'],
    ] as const) {
      const glow = draw.circle(cx * s, cy * s, r * s);
      glow.fill(draw.radial(cx * s, cy * s, r * s, [[0, rgba(color, 0.3)], [1, rgba(color, 0)]]));
      icon.add(glow);
    }
    for (const [x, y, r] of [[0.14, 0.13, 0.03], [0.86, 0.17, 0.022], [0.12, 0.82, 0.02], [0.84, 0.86, 0.028]] as const) {
      icon.add(draw.star(x * s, y * s, 4, r * s, r * s * 0.3, '#fff6d6'));
    }
    if (skyOnly) return icon;
  }

  // The Sun's art is built at radius 100; its flames reach 112.
  const art = new PlanetFactory(TVG, draw).art[MAX_TIER]!;
  const body = new TVG.Scene();
  for (const layer of [art.back, art.spin, art.front]) if (layer) body.add(layer.duplicate());
  body.scale((s * sun) / 224).translate(s / 2, s / 2);
  icon.add(body);
  return icon;
}
