export type Easing = (t: number) => number;

export const Ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  },
  outElastic: (t: number) =>
    t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outBounce: (t: number) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
} satisfies Record<string, Easing>;

export interface TweenOptions {
  duration: number;
  delay?: number;
  ease?: Easing;
  /** Plays forward then backward forever. */
  yoyo?: boolean;
  repeat?: boolean;
  onUpdate?: (t: number) => void;
  onComplete?: () => void;
}

type Target = Record<string, any>;

interface Tween {
  target: Target;
  from: Record<string, number>;
  to: Record<string, number>;
  opts: TweenOptions;
  elapsed: number;
  dead: boolean;
}

export interface TweenHandle {
  cancel(): void;
  readonly done: Promise<void>;
}

/** Tweens numeric properties of any object, including Node's x/y/scale/rotation/opacity. */
export class Tweens {
  #list: Tween[] = [];

  to<T extends Target>(target: T, to: Partial<Record<keyof T, number>>, opts: TweenOptions): TweenHandle {
    let resolve!: () => void;
    const done = new Promise<void>((r) => (resolve = r));
    const onComplete = opts.onComplete;
    const tween: Tween = {
      target,
      from: {},
      to: to as Record<string, number>,
      opts: { ...opts, onComplete: () => { onComplete?.(); resolve(); } },
      elapsed: -(opts.delay ?? 0),
      dead: false,
    };
    this.#list.push(tween);
    return { cancel: () => { tween.dead = true; resolve(); }, done };
  }

  /** Cancels every tween running on `target`. */
  kill(target: Target): void {
    for (const t of this.#list) if (t.target === target) t.dead = true;
  }

  clear(): void {
    this.#list.length = 0;
  }

  update(dt: number): void {
    const list = this.#list;
    for (let i = 0; i < list.length; i++) {
      const tw = list[i]!;
      if (tw.dead) continue;
      const before = tw.elapsed;
      tw.elapsed += dt;
      if (tw.elapsed < 0) continue;
      if (before < 0 || Object.keys(tw.from).length === 0) {
        for (const k in tw.to) tw.from[k] = tw.target[k] as number;
      }
      const { duration, ease = Ease.outQuad, yoyo, repeat } = tw.opts;
      let p = duration > 0 ? tw.elapsed / duration : 1;
      let finished = false;
      if (yoyo || repeat) {
        const cycle = Math.floor(p);
        p -= cycle;
        if (yoyo && cycle % 2 === 1) p = 1 - p;
      } else if (p >= 1) {
        p = 1;
        finished = true;
      }
      const e = ease(p);
      for (const k in tw.to) tw.target[k] = tw.from[k]! + (tw.to[k]! - tw.from[k]!) * e;
      tw.opts.onUpdate?.(e);
      if (finished) {
        tw.dead = true;
        tw.opts.onComplete?.();
      }
    }
    if (list.some((t) => t.dead)) this.#list = list.filter((t) => !t.dead);
  }
}

interface Timer {
  at: number;
  every: number;
  fn: () => void;
  dead: boolean;
}

/** Game-time timers, paused with the game, unlike setTimeout. */
export class Timers {
  #time = 0;
  #list: Timer[] = [];

  after(seconds: number, fn: () => void): () => void {
    const t: Timer = { at: this.#time + seconds, every: 0, fn, dead: false };
    this.#list.push(t);
    return () => (t.dead = true);
  }

  every(seconds: number, fn: () => void): () => void {
    const t: Timer = { at: this.#time + seconds, every: seconds, fn, dead: false };
    this.#list.push(t);
    return () => (t.dead = true);
  }

  clear(): void {
    this.#list.length = 0;
  }

  update(dt: number): void {
    this.#time += dt;
    for (const t of [...this.#list]) {
      if (t.dead || t.at > this.#time) continue;
      t.fn();
      if (t.every > 0) t.at += t.every;
      else t.dead = true;
    }
    this.#list = this.#list.filter((t) => !t.dead);
  }
}
