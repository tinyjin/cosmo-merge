import { Button, Ease, Label, Node, decodeBase64, rgba, type Engine, type LabelOptions, type Rect, type Screen, type TVG } from '@cosmo-merge/engine';
import { FONT_BASE64, FONT_NAME } from './assets/font';
import { PlanetFactory } from './planets';

export const FONT = FONT_NAME;
export const BEST_KEY = 'cosmo-merge.best';

/** Screen constructors, registered in index.ts so screens can switch without importing each other. */
export const screens = {} as Record<'title' | 'play', () => Screen>;

/** Autoplay drops planets by itself and restarts after game over. Used for demos and benchmarks. */
export const settings = { autoplay: false };

const fontsLoaded = new WeakSet<object>();

export function loadFont(TVG: TVG): void {
  if (fontsLoaded.has(TVG.Font)) return;
  TVG.Font.load(FONT_NAME, decodeBase64(FONT_BASE64), { type: 'ttf' });
  fontsLoaded.add(TVG.Font);
}

const factories = new WeakMap<Engine, PlanetFactory>();

/** One planet factory per engine, shared by every screen. */
export function planets(engine: Engine): PlanetFactory {
  let f = factories.get(engine);
  if (!f) {
    f = new PlanetFactory(engine.TVG, engine.draw);
    factories.set(engine, f);
  }
  return f;
}

export function label(screen: Screen, text: string, size: number, o: Partial<LabelOptions> = {}): Label {
  return new Label(screen.TVG, text, { font: FONT, size, ...o });
}

export function button(screen: Screen, text: string, width: number, height: number, onTap: () => void, colors?: { color: string; shade: string; textColor: string }): Button {
  const b = new Button(screen.TVG, text, screen.tweens, { width, height, font: FONT, ...colors });
  b.onTap = onTap;
  screen.buttons.push(b);
  return b;
}

/**
 * Deep-space backdrop sized to the visible area: gradient sky, nebula glows, a static star field
 * in one shape, and a few twinkling stars as separate nodes.
 */
export class Space {
  node: Node | null = null;
  #cancel: Array<() => void> = [];

  constructor(private screen: Screen) {}

  build(view: Rect): Node {
    const { draw, TVG, tweens } = this.screen;
    const rng = this.screen.engine.rng;
    this.destroy();
    const node = Node.group(TVG);
    const { x, y, width: w, height: h } = view;

    const sky = draw.rect(x, y, w, h);
    sky.fill(draw.linear(0, y, 0, y + h, [[0, '#120a3a'], [0.55, '#2a1466'], [1, '#4a1f7a']]));
    node.draw(sky);

    for (const [cx, cy, r, color] of [
      [x + w * 0.15, y + h * 0.3, w * 0.7, '#ff4fa3'],
      [x + w * 0.9, y + h * 0.65, w * 0.8, '#3f6bff'],
      [x + w * 0.5, y + h * 1.05, w * 0.9, '#ff8a3d'],
    ] as const) {
      const glow = draw.circle(cx, cy, r);
      glow.fill(draw.radial(cx, cy, r, [[0, rgba(color, 0.22)], [1, rgba(color, 0)]]));
      node.draw(glow);
    }

    const field = new TVG.Shape();
    for (let i = 0; i < 90; i++) {
      field.appendCircle(x + rng.next() * w, y + rng.next() * h, rng.range(0.5, 1.4));
    }
    field.fill(255, 255, 255, 150);
    node.draw(field);

    for (let i = 0; i < 14; i++) {
      const star = node.add(new Node(draw.star(0, 0, 4, 4, 1.2, '#fff6d6')));
      star.setPosition(x + rng.next() * w, y + rng.next() * h);
      star.scale = rng.range(0.6, 1.3);
      star.opacity = rng.range(0.2, 0.9);
      this.#cancel.push(
        tweens.to(star, { opacity: 0.1, scale: star.scale * 0.5 }, {
          duration: rng.range(0.8, 2.2), delay: rng.range(0, 2), yoyo: true, ease: Ease.inOutQuad,
        }).cancel
      );
    }

    this.node = node;
    return node;
  }

  destroy(): void {
    for (const c of this.#cancel) c();
    this.#cancel.length = 0;
    this.node?.destroy();
    this.node = null;
  }
}

/** A short-lived text that floats up and fades, e.g. "+21". */
export function floatText(screen: Screen, parent: Node, text: string, x: number, y: number, size: number, color: [number, number, number]): void {
  const l = parent.add(label(screen, text, size, { color, outline: { width: 3, color: [42, 22, 64] } }));
  l.setPosition(x, y);
  l.scale = 0.4;
  screen.tweens.to(l, { scale: 1 }, { duration: 0.35, ease: Ease.outBack });
  screen.tweens.to(l, { y: y - 46 }, { duration: 0.9, ease: Ease.outCubic });
  screen.tweens.to(l, { opacity: 0 }, { duration: 0.35, delay: 0.6, onComplete: () => l.destroy() });
}
