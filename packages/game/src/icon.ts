import { Draw, rgba, type Scene, type TVG } from '@cosmo-merge/engine';
import { MAX_TIER, PlanetFactory } from './planets';
import { FONT, loadFont } from './shared';

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
  const icon = skyOnly || sky ? paintSky(TVG, draw, size, size) : new TVG.Scene();
  if (!skyOnly) icon.add(paintSun(TVG, draw, size * sun).translate(size / 2, size / 2));
  return icon;
}

/** The link preview image (og:image): the Sun next to the game's title. */
export function drawCard(TVG: TVG, width: number, height: number): Scene {
  loadFont(TVG);
  const draw = new Draw(TVG);
  const card = paintSky(TVG, draw, width, height);
  const u = height / 630;
  card.add(paintSun(TVG, draw, 340 * u).translate(290 * u, height / 2));
  const text = (value: string, size: number, color: [number, number, number], y: number, outline = 0) => {
    const make = (c: [number, number, number]) =>
      new TVG.Text().font(FONT).fontSize(size * u).fill(...c).text(value)
        // Centered in a card-sized box whose middle sits at (right column, y).
        .layout(width, height).align(0.5, 0.5).translate(790 * u - width / 2, y * u - height / 2);
    const dark: [number, number, number] = [42, 22, 64];
    if (outline) card.add(make(dark).outline(outline * u, ...dark));
    card.add(make(color));
  };
  text('COSMO', 118, [255, 216, 74], 225, 13);
  text('MERGE', 118, [255, 138, 216], 345, 13);
  text('Drop planets. Merge them. Make a Sun!', 28, [220, 210, 255], 450);
  return card;
}

function paintSky(TVG: TVG, draw: Draw, w: number, h: number): Scene {
  const sky = new TVG.Scene();
  const bg = draw.rect(0, 0, w, h);
  bg.fill(draw.linear(0, 0, 0, h, [[0, '#120a3a'], [0.55, '#2a1466'], [1, '#4a1f7a']]));
  sky.add(bg);
  for (const [cx, cy, r, color] of [
    [0.1, 0.2, 0.75, '#ff4fa3'],
    [0.95, 0.7, 0.8, '#3f6bff'],
    [0.5, 1.05, 0.7, '#ff8a3d'],
  ] as const) {
    const glow = draw.circle(cx * w, cy * h, r * Math.max(w, h));
    glow.fill(draw.radial(cx * w, cy * h, r * Math.max(w, h), [[0, rgba(color, 0.3)], [1, rgba(color, 0)]]));
    sky.add(glow);
  }
  const m = Math.min(w, h);
  for (const [x, y, r] of [[0.14, 0.13, 0.03], [0.86, 0.17, 0.022], [0.12, 0.82, 0.02], [0.84, 0.86, 0.028]] as const) {
    sky.add(draw.star(x * w, y * h, 4, r * m, r * m * 0.3, '#fff6d6'));
  }
  return sky;
}

/** The game's Sun, centered on the origin, with flames `width` across. */
function paintSun(TVG: TVG, draw: Draw, width: number): Scene {
  // The art is built at radius 100; its flames reach 112.
  const art = new PlanetFactory(TVG, draw).art[MAX_TIER]!;
  const sun = new TVG.Scene();
  for (const layer of [art.back, art.spin, art.front]) if (layer) sun.add(layer.duplicate());
  return sun.scale(width / 224);
}
