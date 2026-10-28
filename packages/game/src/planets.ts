import { Node, rgba, type Draw, type Scene, type TVG } from '@cosmo-merge/engine';

export interface Tier {
  name: string;
  radius: number;
  score: number;
  /** Particle colors for its merge burst. */
  colors: string[];
}

export const TIERS: Tier[] = [
  { name: 'Comet', radius: 14, score: 1, colors: ['#bfe3ff', '#ffffff'] },
  { name: 'Moon', radius: 19, score: 3, colors: ['#f4f1e6', '#c9c3b3'] },
  { name: 'Mercury', radius: 25, score: 6, colors: ['#e6c49c', '#b8875a'] },
  { name: 'Mars', radius: 32, score: 10, colors: ['#ff8a5c', '#c8402a'] },
  { name: 'Venus', radius: 39, score: 15, colors: ['#ffe08a', '#f0a94a'] },
  { name: 'Earth', radius: 47, score: 21, colors: ['#5fb4ff', '#6fdc7a'] },
  { name: 'Neptune', radius: 56, score: 28, colors: ['#6f8dff', '#3048c8'] },
  { name: 'Uranus', radius: 65, score: 36, colors: ['#9ff5ee', '#4fc4c9'] },
  { name: 'Saturn', radius: 75, score: 45, colors: ['#ffe2a0', '#d9a55a'] },
  { name: 'Jupiter', radius: 87, score: 55, colors: ['#f2c29a', '#c46a45'] },
  { name: 'Sun', radius: 100, score: 66, colors: ['#fff27a', '#ffb02e', '#ff6a2e'] },
];

export const MAX_TIER = TIERS.length - 1;

/** Planet art split in layers: `back` and `front` stay upright, `spin` rolls with the body. */
export interface PlanetArt {
  back: Scene | null;
  spin: Scene;
  front: Scene;
}

/**
 * Builds each tier once. Bodies are made with `duplicate()`, a single native call per layer,
 * instead of rebuilding a dozen shapes every time a planet appears.
 */
export class PlanetFactory {
  readonly art: PlanetArt[];

  constructor(private TVG: TVG, private draw: Draw) {
    this.art = TIERS.map((t, i) => this.#build(i, t.radius));
  }

  /** A body node: outer node for position/scale, `spin` child for rolling. */
  create(tier: number): { node: Node; spin: Node } {
    const art = this.art[tier]!;
    const node = Node.group(this.TVG);
    if (art.back) node.add(new Node(art.back.duplicate()));
    const spin = node.add(new Node(art.spin.duplicate()));
    node.add(new Node(art.front.duplicate()));
    return { node, spin };
  }

  #build(tier: number, r: number): PlanetArt {
    const { TVG, draw } = this;
    const spin = new TVG.Scene();
    const front = new TVG.Scene();
    let back: Scene | null = null;

    const base = (inner: string, outer: string) => {
      const s = draw.circle(0, 0, r);
      s.fill(draw.radial(-r * 0.3, -r * 0.35, r * 1.35, [[0, inner], [1, outer]]));
      spin.add(s);
    };
    // Surface details are clipped to the disc so they can hang over the edge.
    const surface = () => {
      const g = new TVG.Scene();
      g.clip(draw.circle(0, 0, r));
      spin.add(g);
      return g;
    };
    const blob = (g: Scene, x: number, y: number, rx: number, ry: number, color: string, alpha = 1) =>
      g.add(draw.ellipse(x * r, y * r, rx * r, ry * r, rgba(color, alpha)));
    const band = (g: Scene, y: number, h: number, color: string, alpha = 1, wobble = 0) => {
      const top = y * r;
      const bot = (y + h) * r;
      const w = wobble * r;
      g.add(draw.path(['M', -r, top, 'C', -r * 0.3, top - w, r * 0.3, top + w, r, top, 'L', r, bot,
        'C', r * 0.3, bot + w, -r * 0.3, bot - w, -r, bot, 'Z'], rgba(color, alpha)));
    };
    const ring = (rx: number, ry: number, width: number, color: string, tilt: number) => {
      // Back half behind the planet, front half over it.
      back = new TVG.Scene();
      const full = draw.ellipse(0, 0, rx * r, ry * r);
      draw.stroke(full, width * r, rgba(color, 0.55));
      back.add(full);
      back.rotate(tilt);
      const k = 0.5523;
      const half = draw.path(['M', -rx * r, 0, 'C', -rx * r, ry * r * k, -rx * r * k, ry * r, 0, ry * r,
        'C', rx * r * k, ry * r, rx * r, ry * r * k, rx * r, 0]);
      draw.stroke(half, width * r, rgba(color, 0.95), { cap: 'round' });
      const frontRing = new TVG.Scene();
      frontRing.add(half);
      frontRing.rotate(tilt);
      return frontRing;
    };

    let frontRing: Scene | null = null;

    switch (tier) {
      case 0: { // icy comet
        base('#eaf7ff', '#7fb2d9');
        const g = surface();
        blob(g, 0.35, 0.3, 0.22, 0.18, '#5f93bd', 0.6);
        blob(g, -0.4, 0.45, 0.14, 0.12, '#5f93bd', 0.5);
        break;
      }
      case 1: { // moon
        base('#fffdf4', '#bdb6a3');
        const g = surface();
        for (const [x, y, s] of [[0.35, -0.2, 0.22], [-0.3, 0.42, 0.17], [0.15, 0.55, 0.1], [-0.55, -0.1, 0.1]] as const) {
          blob(g, x, y, s, s * 0.9, '#a39c88', 0.65);
          blob(g, x - s * 0.15, y - s * 0.2, s * 0.7, s * 0.6, '#d8d2c0', 0.7);
        }
        break;
      }
      case 2: { // mercury
        base('#f5dcbc', '#a9764a');
        const g = surface();
        for (const [x, y, s] of [[-0.4, 0.3, 0.2], [0.4, 0.45, 0.14], [0.45, -0.3, 0.12], [-0.1, 0.65, 0.12]] as const) {
          blob(g, x, y, s, s * 0.85, '#8a5c35', 0.45);
        }
        break;
      }
      case 3: { // mars
        base('#ff9e6b', '#b5371f');
        const g = surface();
        blob(g, -0.35, 0.25, 0.4, 0.25, '#8f2a17', 0.45);
        blob(g, 0.4, 0.5, 0.3, 0.18, '#8f2a17', 0.4);
        blob(g, 0, -1.02, 0.45, 0.22, '#fff3ec', 0.95);
        break;
      }
      case 4: { // venus
        base('#fff1b8', '#e39a3c');
        const g = surface();
        band(g, -0.55, 0.18, '#f7c76a', 0.7, 0.12);
        band(g, 0.15, 0.22, '#e8a04a', 0.55, -0.15);
        band(g, 0.55, 0.16, '#f7c76a', 0.6, 0.1);
        break;
      }
      case 5: { // earth
        base('#8fd0ff', '#1f64c4');
        const g = surface();
        g.add(draw.path(['M', -0.9 * r, -0.2 * r, 'C', -0.6 * r, -0.7 * r, -0.1 * r, -0.6 * r, -0.15 * r, -0.25 * r,
          'C', -0.2 * r, 0.05 * r, -0.55 * r, 0.1 * r, -0.5 * r, 0.45 * r, 'C', -0.7 * r, 0.5 * r, -0.95 * r, 0.2 * r, -0.9 * r, -0.2 * r, 'Z'],
        '#5fcf6d'));
        g.add(draw.path(['M', 0.25 * r, 0.1 * r, 'C', 0.5 * r, -0.15 * r, 0.95 * r, 0.05 * r, 0.85 * r, 0.45 * r,
          'C', 0.7 * r, 0.8 * r, 0.35 * r, 0.75 * r, 0.3 * r, 0.5 * r, 'C', 0.1 * r, 0.4 * r, 0.1 * r, 0.25 * r, 0.25 * r, 0.1 * r, 'Z'],
        '#4fbf5d'));
        blob(g, 0.25, -0.62, 0.32, 0.08, '#ffffff', 0.75);
        blob(g, -0.35, 0.72, 0.28, 0.07, '#ffffff', 0.65);
        break;
      }
      case 6: { // neptune
        base('#9fb4ff', '#2436b0');
        const g = surface();
        band(g, -0.35, 0.14, '#5d78f0', 0.6, 0.08);
        band(g, 0.25, 0.1, '#1c2c94', 0.45, -0.06);
        blob(g, 0.35, 0.05, 0.2, 0.1, '#1a2780', 0.6);
        break;
      }
      case 7: { // uranus
        base('#d9fffb', '#3ab3b9');
        const g = surface();
        band(g, -0.15, 0.3, '#7fe3dc', 0.45, 0);
        frontRing = ring(0.42, 1.38, 0.06, '#e8fffd', 8);
        break;
      }
      case 8: { // saturn
        base('#fff0c4', '#c98d43');
        const g = surface();
        band(g, -0.5, 0.14, '#e3b26a', 0.7, 0.05);
        band(g, -0.1, 0.12, '#d79f55', 0.6, 0.05);
        band(g, 0.3, 0.16, '#e8bc78', 0.7, 0.05);
        frontRing = ring(1.5, 0.42, 0.13, '#ffe6b0', -16);
        break;
      }
      case 9: { // jupiter
        base('#fbe2c8', '#b9643c');
        const g = surface();
        band(g, -0.7, 0.16, '#d99a6c', 0.8, 0.06);
        band(g, -0.35, 0.18, '#c97850', 0.75, -0.06);
        band(g, 0.05, 0.14, '#e8b88e', 0.8, 0.05);
        band(g, 0.38, 0.2, '#c26e48', 0.75, -0.05);
        blob(g, 0.35, 0.47, 0.26, 0.15, '#c8402a', 0.9);
        blob(g, 0.35, 0.47, 0.15, 0.08, '#e86a4a', 0.9);
        break;
      }
      default: { // sun
        const corona = draw.circle(0, 0, r * 1.25);
        corona.fill(draw.radial(0, 0, r * 1.25, [[0.7, rgba('#ffd84a', 0.5)], [1, rgba('#ffb02e', 0)]]));
        back = new TVG.Scene();
        back.add(corona);
        const flame = draw.star(0, 0, 14, r * 1.12, r * 0.9);
        flame.fill(draw.radial(0, 0, r * 1.12, [[0.75, '#ffb02e'], [1, rgba('#ff6a2e', 0.6)]]));
        spin.add(flame);
        base('#fffbd0', '#ffb02e');
        const g = surface();
        blob(g, -0.4, 0.4, 0.2, 0.14, '#ff9a2e', 0.35);
        blob(g, 0.45, -0.1, 0.16, 0.12, '#ff9a2e', 0.35);
      }
    }

    this.#face(spin, r, tier);

    // Light from the top left: highlight plus a soft terminator. Upright, so it never rolls.
    const shade = draw.circle(0, 0, r);
    shade.fill(draw.radial(-r * 0.35, -r * 0.4, r * 1.55, [
      [0, rgba('#ffffff', 0.28)], [0.45, rgba('#ffffff', 0)], [0.8, rgba('#0b0630', 0.12)], [1, rgba('#0b0630', 0.42)],
    ]));
    front.add(shade);
    front.add(draw.ellipse(0, 0, r * 0.22, r * 0.12, rgba('#ffffff', 0.55)).rotate(-35).translate(-r * 0.38, -r * 0.5));
    if (frontRing) front.add(frontRing);

    return { back, spin, front };
  }

  #face(spin: Scene, r: number, tier: number): void {
    const { draw } = this;
    const eyeY = -r * 0.02;
    const eyeX = r * 0.3;
    const eyeR = Math.max(2.4, r * 0.12);
    const sleepy = tier === 1 || tier === 7;
    for (const side of [-1, 1]) {
      const x = side * eyeX;
      if (sleepy) {
        // Closed, content eyes.
        const lid = draw.path(['M', x - eyeR, eyeY, 'C', x - eyeR * 0.5, eyeY + eyeR * 0.9, x + eyeR * 0.5, eyeY + eyeR * 0.9, x + eyeR, eyeY]);
        draw.stroke(lid, Math.max(1.6, r * 0.05), '#2a1640', { cap: 'round' });
        spin.add(lid);
      } else {
        spin.add(draw.ellipse(x, eyeY, eyeR, eyeR * 1.15, '#2a1640'));
        spin.add(draw.circle(x - eyeR * 0.3, eyeY - eyeR * 0.4, eyeR * 0.38, '#ffffff'));
      }
      spin.add(draw.ellipse(side * r * 0.5, r * 0.2, r * 0.13, r * 0.08, rgba('#ff6fa8', 0.45)));
    }
    const mw = r * 0.14;
    const my = r * 0.2;
    const mouth = draw.path(['M', -mw, my, 'C', -mw * 0.5, my + mw * 0.9, mw * 0.5, my + mw * 0.9, mw, my]);
    draw.stroke(mouth, Math.max(1.5, r * 0.045), '#2a1640', { cap: 'round' });
    spin.add(mouth);
  }
}
