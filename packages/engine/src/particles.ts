import { rgba } from './color';
import { Draw } from './draw';
import { Node } from './node';
import type { Random } from './math';
import type { TVG } from './types';

interface Particle {
  node: Node;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  life: number;
  max: number;
  size: number;
  gravity: number;
  drag: number;
  shrink: boolean;
  color: string;
}

export interface BurstOptions {
  count?: number;
  colors?: string[];
  speed?: [number, number];
  life?: [number, number];
  size?: [number, number];
  gravity?: number;
  drag?: number;
  /** Direction in degrees, 0 = right, 90 = down. Omit for a full circle. */
  angle?: number;
  spread?: number;
  shrink?: boolean;
  kind?: 'dot' | 'star';
}

/**
 * Pooled particles. Every paint is created up front and recycled by toggling visibility, so a
 * burst never allocates native objects mid-game.
 */
export class Particles {
  readonly node: Node;
  #pool: Record<'dot' | 'star', Particle[]> = { dot: [], star: [] };

  constructor(TVG: TVG, private rng: Random, capacity = 160) {
    const draw = new Draw(TVG);
    this.node = Node.group(TVG);
    for (const kind of ['dot', 'star'] as const) {
      const count = kind === 'dot' ? capacity : Math.ceil(capacity / 3);
      for (let i = 0; i < count; i++) {
        // Unit-sized art, scaled per particle.
        const shape = kind === 'dot' ? draw.circle(0, 0, 1, '#ffffff') : draw.star(0, 0, 4, 1.4, 0.5, '#ffffff');
        const node = this.node.add(new Node(shape));
        node.visible = false;
        this.#pool[kind].push({
          node, alive: false, x: 0, y: 0, vx: 0, vy: 0, spin: 0, life: 0, max: 1, size: 1,
          gravity: 0, drag: 0, shrink: true, color: '',
        });
      }
    }
  }

  burst(x: number, y: number, o: BurstOptions = {}): void {
    const {
      count = 16, colors = ['#ffffff'], speed = [80, 260], life = [0.4, 0.9], size = [2, 5],
      gravity = 300, drag = 1.5, angle, spread = 360, shrink = true, kind = 'dot',
    } = o;
    const pool = this.#pool[kind];
    const r = this.rng;
    for (let n = 0; n < count; n++) {
      // Reuse the oldest-looking slot when the pool is full rather than dropping the burst.
      const p = pool.find((q) => !q.alive) ?? pool.reduce((a, b) => (a.life > b.life ? a : b));
      const dir = ((angle ?? 0) + (angle === undefined ? r.range(0, 360) : r.range(-spread / 2, spread / 2))) * (Math.PI / 180);
      const v = r.range(speed[0], speed[1]);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(dir) * v;
      p.vy = Math.sin(dir) * v;
      p.spin = r.range(-360, 360);
      p.life = 0;
      p.max = r.range(life[0], life[1]);
      p.size = r.range(size[0], size[1]);
      p.gravity = gravity;
      p.drag = drag;
      p.shrink = shrink;
      const color = r.pick(colors);
      if (color !== p.color) {
        p.color = color;
        (p.node.paint as ReturnType<Draw['circle']>).fill(...rgba(color));
      }
      p.node.opacity = 1;
      p.node.visible = true;
    }
  }

  get active(): number {
    let n = 0;
    for (const kind of ['dot', 'star'] as const) for (const p of this.#pool[kind]) if (p.alive) n++;
    return n;
  }

  update(dt: number): void {
    for (const kind of ['dot', 'star'] as const) {
      for (const p of this.#pool[kind]) {
        if (!p.alive) continue;
        p.life += dt;
        if (p.life >= p.max) {
          p.alive = false;
          p.node.visible = false;
          continue;
        }
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy = p.vy * k + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const t = p.life / p.max;
        const n = p.node;
        n.x = p.x;
        n.y = p.y;
        n.rotation += p.spin * dt;
        n.scale = p.size * (p.shrink ? 1 - t * t : 1);
        n.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      }
    }
  }

  clear(): void {
    for (const kind of ['dot', 'star'] as const) {
      for (const p of this.#pool[kind]) {
        p.alive = false;
        p.node.visible = false;
      }
    }
  }
}
