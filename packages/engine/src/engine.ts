import { Draw } from './draw';
import { Random } from './math';
import { Node } from './node';
import { Particles } from './particles';
import { Timers, Tweens } from './tween';
import type { Button } from './ui';
import type { HapticKind, Host, PointerEvent, Rect, TVG } from './types';

/**
 * A game state (title, play, ...). The engine owns one at a time and gives it a fresh node layer.
 */
export abstract class Screen {
  /** Set by the engine before `enter()`. */
  engine!: Engine;
  layer!: Node;
  readonly buttons: Button[] = [];

  abstract enter(): void;
  update(_dt: number): void {}
  exit(): void {}
  /** The visible area changed (in design coordinates). */
  resize(_view: Rect): void {}
  pointerDown(_p: PointerEvent): void {}
  pointerMove(_p: PointerEvent): void {}
  pointerUp(_p: PointerEvent): void {}

  get TVG(): TVG { return this.engine.TVG; }
  get draw(): Draw { return this.engine.draw; }
  get tweens(): Tweens { return this.engine.tweens; }
  get timers(): Timers { return this.engine.timers; }
}

export interface EngineOptions {
  /** Design resolution. The game is laid out in these units and scaled to fit the view. */
  width: number;
  height: number;
  seed?: number;
}

export interface Stats {
  fps: number;
  /** JS time spent per frame on update + paint sync + render calls, in ms. */
  frameMs: number;
  nodes: number;
}

const MAX_DT = 1 / 20;

export class Engine {
  readonly TVG: TVG;
  readonly draw: Draw;
  readonly tweens = new Tweens();
  readonly timers = new Timers();
  readonly rng: Random;
  /** Maps design space onto the view (letterboxed). */
  readonly root: Node;
  /** The layer for the current screen. */
  readonly world: Node;
  /** Effects above the screen, shared across screens. */
  readonly particles: Particles;
  /** Always on top, e.g. stats. */
  readonly overlay: Node;
  readonly width: number;
  readonly height: number;
  readonly stats: Stats = { fps: 60, frameMs: 0, nodes: 0 };
  /** The visible area in design coordinates. Wider or taller than width/height when letterboxed. */
  view: Rect;

  #host: Host;
  #screen: Screen | null = null;
  #frame = 0;
  #last = 0;
  #running = false;
  #viewW = 1;
  #viewH = 1;
  #shake = { amount: 0, time: 0, duration: 0 };
  #pressedButton: Button | null = null;
  #timeScale = 1;

  constructor(host: Host, options: EngineOptions) {
    this.#host = host;
    this.TVG = host.TVG;
    this.draw = new Draw(host.TVG);
    this.width = options.width;
    this.height = options.height;
    this.view = { x: 0, y: 0, width: options.width, height: options.height };
    this.rng = new Random(options.seed);
    this.root = Node.group(this.TVG);
    this.world = this.root.add(Node.group(this.TVG));
    this.particles = new Particles(this.TVG, this.rng);
    this.root.add(this.particles.node);
    this.overlay = this.root.add(Node.group(this.TVG));
    host.canvas.add(this.root.paint);
  }

  get host(): Host { return this.#host; }
  get screen(): Screen | null { return this.#screen; }
  get timeScale() { return this.#timeScale; }
  /** Slow motion: 1 is normal speed. */
  set timeScale(v: number) { this.#timeScale = v; }

  /** Tells the engine the size of the view in host pixels (CSS px or RN points). */
  resize(width: number, height: number): void {
    this.#viewW = Math.max(1, width);
    this.#viewH = Math.max(1, height);
    const s = Math.min(this.#viewW / this.width, this.#viewH / this.height);
    const ox = (this.#viewW - this.width * s) / 2;
    const oy = (this.#viewH - this.height * s) / 2;
    this.root.scale = s;
    this.root.x = ox;
    this.root.y = oy;
    this.view = { x: -ox / s, y: -oy / s, width: this.#viewW / s, height: this.#viewH / s };
    this.#screen?.resize(this.view);
  }

  start(screen: Screen): void {
    this.show(screen);
    if (this.#running) return;
    this.#running = true;
    this.#last = this.#host.now();
    const loop = (time: number) => {
      if (!this.#running) return;
      this.#tick(time);
      this.#frame = this.#host.requestFrame(loop);
    };
    this.#frame = this.#host.requestFrame(loop);
  }

  stop(): void {
    this.#running = false;
    this.#host.cancelFrame(this.#frame);
  }

  /** Swaps the current screen. The old screen's layer is destroyed with everything on it. */
  show(screen: Screen): void {
    const old = this.#screen;
    if (old) {
      old.exit();
      this.tweens.clear();
      this.timers.clear();
      old.layer.destroy();
    }
    this.particles.clear();
    this.#pressedButton = null;
    screen.engine = this;
    screen.layer = this.world.add(Node.group(this.TVG));
    this.#screen = screen;
    screen.enter();
    screen.resize(this.view);
  }

  destroy(): void {
    this.stop();
    this.#screen?.exit();
    this.#screen = null;
    this.tweens.clear();
    this.timers.clear();
    this.#host.canvas.remove(this.root.paint);
    this.root.destroy();
  }

  shake(amount: number, duration = 0.3): void {
    if (amount < this.#shake.amount * (1 - this.#shake.time / Math.max(this.#shake.duration, 1e-6))) return;
    this.#shake = { amount, time: 0, duration };
  }

  sound(name: string, options?: { pitch?: number; volume?: number }): void {
    this.#host.sound?.play(name, options);
  }

  haptic(kind: HapticKind): void {
    this.#host.haptics?.impact(kind);
  }

  load(key: string): string | null {
    return this.#host.storage?.get(key) ?? null;
  }

  save(key: string, value: string): void {
    this.#host.storage?.set(key, value);
  }

  // Input from the host, in view coordinates.

  pointerDown(x: number, y: number, id = 0): void {
    const p = this.#toDesign(x, y, id);
    const screen = this.#screen;
    if (!screen) return;
    const button = [...screen.buttons].reverse().find((b) => !b.destroyed && b.hit(p));
    if (button) {
      this.#pressedButton = button;
      button.press(true);
      return;
    }
    screen.pointerDown(p);
  }

  pointerMove(x: number, y: number, id = 0): void {
    const p = this.#toDesign(x, y, id);
    if (this.#pressedButton) {
      this.#pressedButton.press(this.#pressedButton.hit(p));
      return;
    }
    this.#screen?.pointerMove(p);
  }

  pointerUp(x: number, y: number, id = 0): void {
    const p = this.#toDesign(x, y, id);
    const button = this.#pressedButton;
    if (button) {
      this.#pressedButton = null;
      button.press(false);
      if (button.hit(p)) {
        this.sound('tap');
        this.haptic('light');
        button.onTap();
      }
      return;
    }
    this.#screen?.pointerUp(p);
  }

  #toDesign(x: number, y: number, id: number): PointerEvent {
    return { x: (x - this.root.x) / this.root.scale, y: (y - this.root.y) / this.root.scale, id };
  }

  #tick(time: number): void {
    const begin = this.#host.now();
    const raw = Math.min(Math.max((time - this.#last) / 1000, 0), MAX_DT);
    this.#last = time;
    if (raw > 0) this.stats.fps += (1 / raw - this.stats.fps) * 0.05;
    const dt = raw * this.#timeScale;

    this.timers.update(dt);
    this.tweens.update(dt);
    this.#screen?.update(dt);
    this.particles.update(dt);
    this.#updateShake(raw);

    if (Node.flush()) this.#host.canvas.update().render();
    this.stats.frameMs += (this.#host.now() - begin - this.stats.frameMs) * 0.1;
  }

  #updateShake(dt: number): void {
    const s = this.#shake;
    if (s.amount <= 0) return;
    s.time += dt;
    const k = 1 - s.time / s.duration;
    if (k <= 0) {
      s.amount = 0;
      this.world.x = 0;
      this.world.y = 0;
      return;
    }
    this.world.x = (this.rng.next() * 2 - 1) * s.amount * k;
    this.world.y = (this.rng.next() * 2 - 1) * s.amount * k;
  }
}
