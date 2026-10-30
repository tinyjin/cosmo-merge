import { Ease, Node, Screen, rgba, type Label, type Rect } from '@cosmo-merge/engine';
import { TIERS } from './planets';
import { BEST_KEY, Space, button, label, planets, screens } from './shared';

interface Orbiter {
  /** One copy behind the sun and one in front; only the one on the current side is visible. */
  copies: Array<{ node: Node; spin: Node }>;
  radius: number;
  speed: number;
  phase: number;
  scale: number;
}

const CX = 180;
const CY = 330;

export class TitleScreen extends Screen {
  #space!: Space;
  #backdrop!: Node;
  #orbiters: Orbiter[] = [];
  #sun!: { node: Node; spin: Node };
  #title!: Node;
  #footer!: Label;
  #time = 0;

  enter(): void {
    const { TVG, draw, layer, tweens } = this;
    this.#backdrop = layer.add(Node.group(TVG));
    this.#space = new Space(this);

    const system = layer.add(Node.group(TVG));
    for (const [rx, ry] of [[70, 26], [110, 40], [150, 56]] as const) {
      system.draw(draw.stroke(draw.ellipse(CX, CY, rx, ry), 1.5, rgba('#ffffff', 0.14), { dash: [4, 6] }));
    }

    // Orbiting planets go behind or in front of the sun depending on where they are on the ellipse.
    const behind = system.add(Node.group(TVG));
    this.#sun = planets(this.engine).create(10);
    system.add(this.#sun.node).setPosition(CX, CY);
    this.#sun.node.scale = 0.42;
    const front = system.add(Node.group(TVG));
    const picks = [1, 3, 5, 8, 6, 2];
    picks.forEach((tier, i) => {
      const copies = [behind, front].map((parent) => {
        const art = planets(this.engine).create(tier);
        parent.add(art.node);
        return art;
      });
      const orbit = [70, 110, 150][i % 3]!;
      this.#orbiters.push({
        copies, radius: orbit, speed: 0.9 - (i % 3) * 0.22, phase: (i * Math.PI * 2) / picks.length,
        scale: Math.min(0.55, 15 / TIERS[tier]!.radius),
      });
    });

    this.#title = layer.add(Node.group(TVG));
    this.#title.setPosition(180, 128);
    const outline = { width: 5, color: [42, 22, 64] as [number, number, number] };
    this.#title.add(label(this, 'COSMO', 64, { color: [255, 216, 74], outline })).setPosition(0, -30);
    this.#title.add(label(this, 'MERGE', 64, { color: [255, 138, 216], outline })).setPosition(0, 34);
    this.#title.scale = 0.2;
    tweens.to(this.#title, { scale: 1 }, { duration: 0.7, ease: Ease.outElastic });

    const best = Number(this.engine.load(BEST_KEY) ?? 0) || 0;
    layer.add(label(this, 'Drop and merge planets. Make a Sun!', 15, { color: [220, 210, 255] })).setPosition(180, 446);
    const play = layer.add(button(this, 'PLAY', 190, 64, () => this.engine.show(screens.play())));
    play.setPosition(180, 512);
    play.label.setSize(30);
    tweens.to(play, { scale: 1.05 }, { duration: 0.8, yoyo: true, ease: Ease.inOutQuad });
    if (best > 0) layer.add(label(this, `BEST ${best}`, 16, { color: [255, 216, 74] })).setPosition(180, 568);

    const { debug, label: host } = this.engine.host;
    this.#footer = layer.add(label(this, debug ? host ?? '' : '', 12, { color: [190, 180, 240] }));
    this.#footer.opacity = 0.75;
  }

  override resize(view: Rect): void {
    this.#backdrop.add(this.#space.build(view));
    this.#footer.setPosition(180, view.y + view.height - 18);
  }

  override exit(): void {
    this.#space.destroy();
  }

  override update(dt: number): void {
    this.#time += dt;
    const t = this.#time;
    this.#title.y = 128 + Math.sin(t * 1.6) * 5;
    this.#sun.spin.rotation = t * 12;
    for (const o of this.#orbiters) {
      const a = o.phase + t * o.speed;
      const x = CX + Math.cos(a) * o.radius;
      const y = CY + Math.sin(a) * o.radius * 0.37;
      const depth = Math.sin(a); // > 0 means the near side of the orbit
      o.copies.forEach(({ node, spin }, i) => {
        const shown = (depth > 0) === (i === 1);
        node.visible = shown;
        if (!shown) return;
        node.setPosition(x, y);
        node.scale = o.scale * (0.85 + (0.25 * (depth + 1)) / 2);
        spin.rotation = t * 60;
      });
    }
  }
}
