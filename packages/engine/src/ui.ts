import { rgba } from './color';
import { Draw } from './draw';
import { Label, Node } from './node';
import { Ease, type Tweens } from './tween';
import type { PointerEvent, TVG } from './types';

export interface ButtonOptions {
  width: number;
  height: number;
  font: string;
  fontSize?: number;
  color?: string;
  shade?: string;
  textColor?: string;
}

/** A pill button drawn with ThorVG, with a pressed state and a tap callback. */
export class Button extends Node {
  readonly label: Label;
  onTap: () => void = () => {};
  #w: number;
  #h: number;
  #pressed = false;

  constructor(TVG: TVG, text: string, private tweens: Tweens, o: ButtonOptions) {
    super(new TVG.Scene());
    const draw = new Draw(TVG);
    const { width: w, height: h, color = '#ffcc4d', shade = '#e08a1e', textColor = '#5a2d0c' } = o;
    this.#w = w;
    this.#h = h;
    const r = h / 2;
    this.draw(draw.rect(-w / 2, -h / 2 + 5, w, h, r, shade));
    const face = draw.rect(-w / 2, -h / 2, w, h, r);
    face.fill(draw.linear(0, -h / 2, 0, h / 2, [[0, '#fff3b0'], [0.45, color], [1, color]]));
    this.draw(face);
    this.draw(draw.rect(-w / 2 + r * 0.6, -h / 2 + 5, w - r * 1.2, h * 0.22, h * 0.11, rgba('#ffffff', 0.45)));
    const c = rgba(textColor);
    this.label = this.add(new Label(TVG, text, { font: o.font, size: o.fontSize ?? h * 0.42, color: [c[0], c[1], c[2]] }));
    this.label.y = 1;
  }

  hit(p: PointerEvent): boolean {
    if (!this.visible || this.opacity < 0.5) return false;
    let n: Node | null = this;
    let x = 0;
    let y = 0;
    let s = 1;
    // Buttons are placed with translation and uniform scale only, which keeps hit testing simple.
    while (n) {
      x = x * n.scale + n.x;
      y = y * n.scale + n.y;
      s *= n.scale;
      n = n.parent;
      if (n && !n.parent) break; // stop below the engine root, which maps design space to the view
    }
    return Math.abs(p.x - x) <= (this.#w / 2) * s && Math.abs(p.y - y) <= (this.#h / 2 + 5) * s;
  }

  press(down: boolean): void {
    if (down === this.#pressed) return;
    this.#pressed = down;
    this.tweens.kill(this);
    this.tweens.to(this as Node, { scale: down ? 0.92 : 1 }, { duration: down ? 0.08 : 0.25, ease: down ? Ease.outQuad : Ease.outBack });
  }
}
