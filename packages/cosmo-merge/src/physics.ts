export interface Body {
  id: number;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Degrees. */
  angle: number;
  /** Degrees per second. */
  spin: number;
  mass: number;
  /** Seconds since the body was dropped. */
  age: number;
  /** Touched the floor or another body at least once. */
  landed: boolean;
  dead: boolean;
}

export interface Contact {
  a: Body;
  b: Body;
  /** Closing speed along the normal, for impact sounds. */
  speed: number;
}

export interface Bounds {
  left: number;
  right: number;
  floor: number;
}

const GRAVITY = 1500;
const SUBSTEPS = 6;
const ITERATIONS = 3;
const RESTITUTION = 0.12;
const FRICTION = 0.08;
const DAMPING = 0.12;

/**
 * Circle physics tuned for stacking: substepped integration, iterative position correction
 * weighted by mass, and impulse response with a little bounce and friction. Bodies roll, so their
 * spin follows their horizontal speed while they rest on something.
 */
export class World {
  readonly bodies: Body[] = [];
  #nextId = 1;
  /** Same-tier pairs that touched during the last step. */
  readonly touches: Contact[] = [];
  /** Hard impacts during the last step. */
  readonly impacts: Contact[] = [];

  constructor(public bounds: Bounds) {}

  add(tier: number, r: number, x: number, y: number): Body {
    const body: Body = {
      id: this.#nextId++, tier, x, y, vx: 0, vy: 0, r, angle: 0, spin: 0,
      mass: r * r, age: 0, landed: false, dead: false,
    };
    this.bodies.push(body);
    return body;
  }

  remove(body: Body): void {
    body.dead = true;
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  clear(): void {
    this.bodies.length = 0;
  }

  step(dt: number): void {
    this.touches.length = 0;
    this.impacts.length = 0;
    const h = dt / SUBSTEPS;
    const list = this.bodies;
    const { left, right, floor } = this.bounds;
    const seen = new Set<string>();
    const grounded = new Set<Body>();

    for (let s = 0; s < SUBSTEPS; s++) {
      for (const b of list) {
        b.vy += GRAVITY * h;
        const damp = 1 - DAMPING * h;
        b.vx *= damp;
        b.vy *= damp;
        b.x += b.vx * h;
        b.y += b.vy * h;
      }

      for (let it = 0; it < ITERATIONS; it++) {
        const solveVelocity = it === 0;
        for (let i = 0; i < list.length; i++) {
          const a = list[i]!;
          for (let j = i + 1; j < list.length; j++) {
            const b = list[j]!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const rr = a.r + b.r;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            const d = Math.sqrt(d2) || 0.0001;
            const nx = dx / d;
            const ny = dy / d;
            const overlap = rr - d;
            const total = a.mass + b.mass;
            const pa = (overlap * b.mass) / total;
            const pb = (overlap * a.mass) / total;
            a.x -= nx * pa;
            a.y -= ny * pa;
            b.x += nx * pb;
            b.y += ny * pb;
            a.landed = true;
            b.landed = true;
            if (ny > 0.3) grounded.add(b);
            if (ny < -0.3) grounded.add(a);

            if (a.tier === b.tier) {
              const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
              if (!seen.has(key)) {
                seen.add(key);
                this.touches.push({ a, b, speed: 0 });
              }
            }

            if (!solveVelocity) continue;
            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const vn = rvx * nx + rvy * ny;
            if (vn >= 0) continue;
            if (-vn > 260 && s === 0) this.impacts.push({ a, b, speed: -vn });
            const inv = 1 / a.mass + 1 / b.mass;
            const jn = (-(1 + RESTITUTION) * vn) / inv;
            a.vx -= (jn * nx) / a.mass;
            a.vy -= (jn * ny) / a.mass;
            b.vx += (jn * nx) / b.mass;
            b.vy += (jn * ny) / b.mass;
            // Coulomb-ish friction on the tangent.
            const tx = -ny;
            const ty = nx;
            const vt = rvx * tx + rvy * ty;
            const jt = Math.max(-FRICTION * jn, Math.min(FRICTION * jn, -vt / inv));
            a.vx -= (jt * tx) / a.mass;
            a.vy -= (jt * ty) / a.mass;
            b.vx += (jt * tx) / b.mass;
            b.vy += (jt * ty) / b.mass;
          }
        }

        for (const b of list) {
          if (b.x - b.r < left) {
            b.x = left + b.r;
            if (b.vx < 0) b.vx *= -RESTITUTION;
          } else if (b.x + b.r > right) {
            b.x = right - b.r;
            if (b.vx > 0) b.vx *= -RESTITUTION;
          }
          if (b.y + b.r > floor) {
            if (solveVelocity && b.vy > 260 && s === 0) this.impacts.push({ a: b, b, speed: b.vy });
            b.y = floor - b.r;
            if (b.vy > 0) b.vy *= -RESTITUTION;
            b.vx *= 1 - 4 * h;
            b.landed = true;
            grounded.add(b);
          }
        }
      }
    }

    for (const b of list) {
      b.age += dt;
      // Roll without slipping while supported, keep spinning freely in the air.
      if (grounded.has(b)) b.spin += ((b.vx / b.r) * (180 / Math.PI) - b.spin) * Math.min(1, 12 * dt);
      else b.spin *= 1 - 0.5 * dt;
      b.angle += b.spin * dt;
      // Settle tiny jitter so stacks come to rest.
      if (Math.abs(b.vx) < 2) b.vx *= 0.8;
    }
  }
}
