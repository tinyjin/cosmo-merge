import { Ease, Label, Node, Screen, clamp, rgba, type PointerEvent, type Rect, type Shape } from '@cosmo-merge/engine';
import { MAX_TIER, TIERS } from './planets';
import { World, type Body } from './physics';
import { BEST_KEY, Space, button, floatText, label, planets, screens, settings } from './shared';

// Layout in design units (360 x 640).
const LEFT = 22;
const RIGHT = 338;
const FLOOR = 612;
const RIM = 196;
const DROP_Y = 150;
const DROP_COOLDOWN = 0.5;
const DANGER_GRACE = 2.4;
/** Tiers that can be dropped, with weights. */
const DROPS = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4];

interface Live {
  body: Body;
  node: Node;
  spin: Node;
}

export class PlayScreen extends Screen {
  #world = new World({ left: LEFT, right: RIGHT, floor: FLOOR });
  #live = new Map<Body, Live>();
  #space!: Space;
  #backdrop!: Node;
  #bodies!: Node;
  #fx!: Node;
  #hud!: Node;
  #danger!: Node;
  #aim!: Node;
  #held: { tier: number; node: Node; spin: Node } | null = null;
  #heldX = 180;
  #next = 0;
  #nextNode: Node | null = null;
  #nextBadge!: Node;
  #cooldown = 0;
  #score = 0;
  #shownScore = 0;
  #best = 0;
  #scoreLabel!: Label;
  #bestLabel!: Label;
  #statsLabel!: Label;
  #statsTimer = 0;
  #combo = 0;
  #lastMerge = -10;
  #time = 0;
  #dangerTime = 0;
  #highest = 0;
  #over = false;
  #panel: Node | null = null;
  #dim: Node | null = null;
  #view: Rect = { x: 0, y: 0, width: 360, height: 640 };
  #autoTimer = 1;

  enter(): void {
    const { draw, TVG, layer } = this;
    this.#best = Number(this.engine.load(BEST_KEY) ?? 0) || 0;

    this.#backdrop = layer.add(Node.group(TVG));
    this.#space = new Space(this);

    // The jar.
    const jar = layer.add(Node.group(TVG));
    const glass = draw.path(['M', LEFT, RIM - 10, 'L', LEFT, FLOOR - 18, 'C', LEFT, FLOOR - 4, LEFT + 6, FLOOR, LEFT + 20, FLOOR,
      'L', RIGHT - 20, FLOOR, 'C', RIGHT - 6, FLOOR, RIGHT, FLOOR - 4, RIGHT, FLOOR - 18, 'L', RIGHT, RIM - 10]);
    glass.fill(draw.linear(0, RIM, 0, FLOOR, [[0, rgba('#9fd8ff', 0.02)], [1, rgba('#9fd8ff', 0.14)]]));
    jar.draw(glass);
    const rim = glass.duplicate() as Shape;
    draw.stroke(rim, 7, rgba('#c8ecff', 0.55), { cap: 'round' });
    rim.fill(0, 0, 0, 0);
    jar.draw(rim);
    jar.draw(draw.rect(LEFT + 8, RIM + 10, 6, FLOOR - RIM - 60, 3, rgba('#ffffff', 0.18)));
    jar.draw(draw.rect(LEFT - 10, FLOOR + 2, RIGHT - LEFT + 20, 14, 7, '#2a1466'));
    const floorGlow = draw.rect(LEFT - 10, FLOOR + 2, RIGHT - LEFT + 20, 6, 3);
    floorGlow.fill(draw.linear(LEFT, 0, RIGHT, 0, [[0, '#ff4fa3'], [0.5, '#ffd84a'], [1, '#3fd0ff']]));
    jar.draw(floorGlow);

    this.#danger = layer.add(Node.group(TVG));
    this.#danger.draw(draw.stroke(draw.path(['M', LEFT + 4, RIM, 'L', RIGHT - 4, RIM]), 3, '#ff5a7a', { dash: [10, 8] }));
    this.#danger.opacity = 0;

    this.#aim = layer.add(Node.group(TVG));
    this.#aim.draw(draw.stroke(draw.path(['M', 0, 0, 'L', 0, FLOOR - DROP_Y]), 2, rgba('#ffffff', 0.35), { dash: [6, 8], cap: 'round' }));
    this.#aim.y = DROP_Y;

    this.#bodies = layer.add(Node.group(TVG));
    this.#fx = layer.add(Node.group(TVG));
    this.#hud = layer.add(Node.group(TVG));
    this.#buildHud();

    this.#next = this.#roll();
    this.#hold();
    this.#updateNext();
  }

  override resize(view: Rect): void {
    this.#view = view;
    this.#backdrop.add(this.#space.build(view));
    this.#statsLabel.setPosition(view.x + 10, view.y + view.height - 12);
    if (this.#dim) this.#layoutDim();
  }

  override exit(): void {
    this.#space.destroy();
  }

  #buildHud(): void {
    const { draw, TVG } = this;
    const hud = this.#hud;
    const pill = hud.add(Node.group(TVG));
    pill.draw(draw.rect(16, 22, 150, 64, 20, rgba('#0b0630', 0.45)));
    pill.add(label(this, 'SCORE', 13, { color: [255, 216, 74], alignX: 0 })).setPosition(32, 40);
    this.#scoreLabel = pill.add(label(this, '0', 30, { alignX: 0 }));
    this.#scoreLabel.setPosition(31, 66);

    this.#bestLabel = hud.add(label(this, `BEST ${this.#best}`, 13, { color: [200, 190, 255], alignX: 0 }));
    this.#bestLabel.setPosition(32, 100);

    this.#nextBadge = hud.add(Node.group(TVG));
    this.#nextBadge.setPosition(300, 54);
    this.#nextBadge.draw(draw.circle(0, 0, 34, rgba('#0b0630', 0.45)));
    this.#nextBadge.draw(draw.stroke(draw.circle(0, 0, 34), 2, rgba('#ffffff', 0.25)));
    this.#nextBadge.add(label(this, 'NEXT', 12, { color: [255, 216, 74] })).setPosition(0, 46);

    const menu = hud.add(button(this, 'II', 44, 44, () => this.#quit(), { color: '#8f7bff', shade: '#4a35b8', textColor: '#ffffff' }));
    menu.setPosition(220, 54);
    menu.label.setSize(18);

    this.#statsLabel = hud.add(label(this, '', 11, { color: [190, 180, 240], alignX: 0, alignY: 1 }));
    this.#statsLabel.opacity = 0.7;
  }

  #roll(): number {
    // Never offer more than one tier above what is already in play, so the opening stays fair.
    const options = DROPS.filter((t) => t <= Math.max(1, this.#highest));
    return this.engine.rng.pick(options);
  }

  #hold(): void {
    const tier = this.#next;
    this.#next = this.#roll();
    const art = planets(this.engine).create(tier);
    this.#bodies.add(art.node);
    const r = TIERS[tier]!.radius;
    this.#heldX = clamp(this.#heldX, LEFT + r, RIGHT - r);
    art.node.setPosition(this.#heldX, DROP_Y);
    art.node.scale = 0.2;
    this.tweens.to(art.node, { scale: 1 }, { duration: 0.35, ease: Ease.outBack });
    this.#held = { tier, ...art };
    this.#aim.x = this.#heldX;
    this.tweens.to(this.#aim, { opacity: 1 }, { duration: 0.2 });
    this.#updateNext();
  }

  #updateNext(): void {
    this.#nextNode?.destroy();
    const art = planets(this.engine).create(this.#next);
    const r = TIERS[this.#next]!.radius;
    art.node.scale = 0.1;
    this.tweens.to(art.node, { scale: Math.min(1, 22 / r) }, { duration: 0.3, ease: Ease.outBack });
    this.#nextNode = this.#nextBadge.add(art.node);
  }

  #drop(): void {
    const held = this.#held;
    if (!held || this.#cooldown > 0 || this.#over) return;
    this.#held = null;
    this.tweens.kill(held.node);
    held.node.scale = 1;
    const tier = held.tier;
    const body = this.#world.add(tier, TIERS[tier]!.radius, this.#heldX, DROP_Y);
    body.vy = 60;
    this.#live.set(body, { body, node: held.node, spin: held.spin });
    this.#cooldown = DROP_COOLDOWN;
    this.tweens.to(this.#aim, { opacity: 0.25 }, { duration: 0.1 });
    this.engine.sound('drop', { pitch: 1.3 - tier * 0.08 });
    this.engine.haptic('light');
    this.timers.after(DROP_COOLDOWN, () => {
      this.#cooldown = 0;
      if (!this.#over) this.#hold();
    });
  }

  override pointerDown(p: PointerEvent): void {
    this.#aimAt(p.x);
  }

  override pointerMove(p: PointerEvent): void {
    this.#aimAt(p.x);
  }

  override pointerUp(p: PointerEvent): void {
    this.#aimAt(p.x);
    this.#drop();
  }

  #aimAt(x: number): void {
    if (this.#over) return;
    const r = this.#held ? TIERS[this.#held.tier]!.radius : 14;
    this.#heldX = clamp(x, LEFT + r, RIGHT - r);
  }

  override update(dt: number): void {
    this.#time += dt;

    if (this.#held) {
      const n = this.#held.node;
      n.x += (this.#heldX - n.x) * Math.min(1, dt * 22);
      n.y = DROP_Y + Math.sin(this.#time * 3) * 3;
      this.#held.spin.rotation = Math.sin(this.#time * 2) * 8;
      this.#aim.x = n.x;
    }

    if (settings.autoplay && this.#held && !this.#over && (this.#autoTimer -= dt) <= 0) {
      this.#autoTimer = 0.6;
      this.#aimAt(this.engine.rng.range(LEFT, RIGHT));
      this.#drop();
    }

    if (!this.#over) {
      this.#world.step(dt);
      this.#resolveMerges();
      this.#checkDanger(dt);
    }

    for (const live of this.#live.values()) {
      live.node.x = live.body.x;
      live.node.y = live.body.y;
      live.spin.rotation = live.body.angle;
    }

    for (const hit of this.#world.impacts) {
      const big = Math.max(hit.a.tier, hit.b.tier);
      this.engine.sound('land', { pitch: 1.2 - big * 0.06, volume: Math.min(1, hit.speed / 900) });
    }

    if (this.#shownScore !== this.#score) {
      this.#shownScore += Math.max(1, Math.round((this.#score - this.#shownScore) * Math.min(1, dt * 10)));
      if (this.#shownScore > this.#score) this.#shownScore = this.#score;
      this.#scoreLabel.value = String(this.#shownScore);
    }

    this.#statsTimer -= dt;
    if (this.#statsTimer <= 0) {
      this.#statsTimer = 0.5;
      const s = this.engine.stats;
      const host = this.engine.host.label ? `${this.engine.host.label} · ` : '';
      this.#statsLabel.value = `${host}${Math.round(s.fps)} fps · ${s.frameMs.toFixed(1)} ms · ${this.#world.bodies.length} bodies`;
    }
  }

  #resolveMerges(): void {
    for (const { a, b } of this.#world.touches) {
      if (a.dead || b.dead || a.tier !== b.tier) continue;
      const tier = a.tier;
      const x = (a.x * a.mass + b.x * b.mass) / (a.mass + b.mass);
      const y = (a.y * a.mass + b.y * b.mass) / (a.mass + b.mass);
      this.#kill(a);
      this.#kill(b);

      this.#combo = this.#time - this.#lastMerge < 1.1 ? this.#combo + 1 : 1;
      this.#lastMerge = this.#time;
      const t = TIERS[tier]!;

      if (tier === MAX_TIER) {
        this.#supernova(x, y);
        continue;
      }

      const nt = tier + 1;
      const next = TIERS[nt]!;
      const body = this.#world.add(nt, next.radius, x, y);
      body.vx = (a.vx + b.vx) / 2;
      body.vy = (a.vy + b.vy) / 2 - 120;
      body.landed = true;
      body.age = 2;
      body.angle = (a.angle + b.angle) / 2;
      const art = planets(this.engine).create(nt);
      this.#bodies.add(art.node);
      art.node.setPosition(x, y);
      art.node.scale = 0.55;
      this.tweens.to(art.node, { scale: 1 }, { duration: 0.45, ease: Ease.outElastic });
      this.#live.set(body, { body, ...art });

      const points = next.score * Math.min(this.#combo, 5);
      this.#score += points;
      this.#highest = Math.max(this.#highest, nt);
      this.engine.particles.burst(x, y, { count: 10 + nt * 3, colors: [...t.colors, ...next.colors], speed: [80, 180 + nt * 25], size: [2, 3 + nt * 0.4] });
      if (nt >= 4) this.engine.particles.burst(x, y, { count: 6 + nt, kind: 'star', colors: ['#fff6d6', '#ffd84a'], speed: [120, 300], size: [3, 6], gravity: 120 });
      this.#ring(x, y, next.radius, next.colors[0]!);
      floatText(this, this.#fx, `+${points}`, x, y - next.radius * 0.4, 18 + nt * 1.5, [255, 255, 255]);
      if (this.#combo >= 2) floatText(this, this.#fx, `COMBO x${this.#combo}`, x, y - next.radius - 26, 16, [255, 216, 74]);
      if (nt >= 6) this.engine.shake(2 + nt * 0.7, 0.3);
      this.engine.sound(this.#combo >= 2 ? 'combo' : 'merge', { pitch: 1.5 - nt * 0.08 + Math.min(this.#combo - 1, 4) * 0.08 });
      this.engine.haptic(nt >= 7 ? 'heavy' : nt >= 4 ? 'medium' : 'light');
      if (nt >= 5 && this.#isFirst(nt)) this.#banner(`${next.name.toUpperCase()}!`);
    }
  }

  #firsts = new Set<number>();
  #isFirst(tier: number): boolean {
    if (this.#firsts.has(tier)) return false;
    this.#firsts.add(tier);
    return true;
  }

  #kill(body: Body): void {
    this.#world.remove(body);
    const live = this.#live.get(body);
    if (!live) return;
    this.#live.delete(body);
    this.tweens.kill(live.node);
    live.node.destroy();
  }

  #ring(x: number, y: number, r: number, color: string): void {
    const ring = this.#fx.add(new Node(this.draw.stroke(this.draw.circle(0, 0, r), 4, color)));
    ring.setPosition(x, y);
    ring.scale = 0.8;
    this.tweens.to(ring, { scale: 1.6, opacity: 0 }, { duration: 0.45, ease: Ease.outCubic, onComplete: () => ring.destroy() });
  }

  #supernova(x: number, y: number): void {
    const bonus = 500 * Math.min(this.#combo, 5);
    this.#score += bonus;
    const colors = TIERS[MAX_TIER]!.colors;
    this.engine.particles.burst(x, y, { count: 90, colors, speed: [150, 520], size: [3, 8], life: [0.6, 1.4], gravity: 80 });
    this.engine.particles.burst(x, y, { count: 30, kind: 'star', colors: ['#ffffff', '#fff27a'], speed: [200, 500], size: [4, 9], gravity: 40 });
    for (let i = 0; i < 3; i++) this.timers.after(i * 0.12, () => this.#ring(x, y, 60 + i * 40, colors[i]!));
    floatText(this, this.#fx, `+${bonus}`, x, y, 34, [255, 242, 122]);
    this.#banner('SUPERNOVA!');
    this.engine.shake(14, 0.6);
    this.engine.timeScale = 0.35;
    this.timers.after(0.25, () => (this.engine.timeScale = 1));
    this.engine.sound('supernova');
    this.engine.haptic('success');
  }

  #banner(text: string): void {
    const l = this.#fx.add(label(this, text, 40, { color: [255, 242, 122], outline: { width: 4, color: [74, 31, 122] } }));
    l.setPosition(180, 300);
    l.scale = 0.2;
    l.rotation = -8;
    this.tweens.to(l, { scale: 1, rotation: 0 }, { duration: 0.5, ease: Ease.outBack });
    this.tweens.to(l, { opacity: 0, y: 270 }, { duration: 0.4, delay: 1.0, onComplete: () => l.destroy() });
  }

  #checkDanger(dt: number): void {
    let risky = false;
    let near = false;
    for (const b of this.#world.bodies) {
      if (!b.landed || b.age < 1.2) continue;
      const top = b.y - b.r;
      if (top < RIM) risky = true;
      else if (top < RIM + 50) near = true;
    }
    this.#dangerTime = risky ? this.#dangerTime + dt : Math.max(0, this.#dangerTime - dt * 2);
    const flash = 0.5 + 0.5 * Math.sin(this.#time * (risky ? 16 : 6));
    this.#danger.opacity = risky ? 0.4 + 0.6 * flash : near ? 0.25 + 0.25 * flash : Math.max(0, this.#danger.opacity - dt * 2);
    if (this.#dangerTime > DANGER_GRACE) this.#gameOver();
  }

  #gameOver(): void {
    this.#over = true;
    this.#danger.opacity = 1;
    this.tweens.to(this.#aim, { opacity: 0 }, { duration: 0.2 });
    if (this.#held) {
      this.#held.node.destroy();
      this.#held = null;
    }
    this.engine.sound('gameover');
    this.engine.haptic('error');
    this.engine.shake(6, 0.4);

    // Pop every planet from the top down, then show the results.
    const order = [...this.#world.bodies].sort((p, q) => p.y - q.y);
    order.forEach((b, i) => {
      this.timers.after(0.4 + i * 0.06, () => {
        if (b.dead) return;
        this.engine.particles.burst(b.x, b.y, { count: 8, colors: TIERS[b.tier]!.colors, speed: [60, 160], size: [2, 4] });
        this.engine.sound('pop', { pitch: 1.4 - b.tier * 0.06, volume: 0.5 });
        this.#kill(b);
      });
    });
    this.timers.after(0.7 + order.length * 0.06, () => this.#results());
  }

  #layoutDim(): void {
    const v = this.#view;
    (this.#dim!.paint as Shape).reset().appendRect(v.x, v.y, v.width, v.height);
    Node.touch();
  }

  #results(): void {
    const { TVG, draw } = this;
    const best = this.#score > this.#best;
    if (best) {
      this.#best = this.#score;
      this.engine.save(BEST_KEY, String(this.#best));
    }

    const v = this.#view;
    this.#dim = this.layer.add(new Node(draw.rect(v.x, v.y, v.width, v.height, 0, '#0b0630')));
    this.#dim.opacity = 0;
    this.tweens.to(this.#dim, { opacity: 0.6 }, { duration: 0.3 });

    const panel = this.layer.add(Node.group(TVG));
    this.#panel = panel;
    panel.setPosition(180, 330);
    const bg = draw.rect(-140, -170, 280, 346, 32);
    bg.fill(draw.linear(0, -170, 0, 176, [[0, '#5b3bd6'], [1, '#2a1466']]));
    panel.draw(draw.rect(-140, -162, 280, 346, 32, '#160b45'));
    panel.draw(bg);
    panel.draw(draw.stroke(draw.rect(-140, -170, 280, 346, 32), 3, rgba('#ffffff', 0.25)));

    panel.add(label(this, 'GAME OVER', 31, { color: [255, 216, 74], outline: { width: 3, color: [42, 22, 64] } })).setPosition(0, -122);
    panel.add(label(this, 'SCORE', 14, { color: [200, 190, 255] })).setPosition(0, -70);
    const score = panel.add(label(this, '0', 54));
    score.setPosition(0, -30);
    this.tweens.to({ v: 0 }, { v: this.#score }, {
      duration: 0.9, delay: 0.3, ease: Ease.outCubic,
      onUpdate: (t) => (score.value = String(Math.round(this.#score * t))),
    });
    panel.add(label(this, best ? 'NEW BEST!' : `BEST ${this.#best}`, 18, { color: best ? [255, 242, 122] : [200, 190, 255] })).setPosition(0, 18);

    const again = panel.add(button(this, 'PLAY AGAIN', 200, 56, () => this.engine.show(screens.play())));
    again.setPosition(0, 72);
    const menu = panel.add(button(this, 'MENU', 120, 40, () => this.#quit(), { color: '#8f7bff', shade: '#4a35b8', textColor: '#ffffff' }));
    menu.setPosition(0, 128);

    if (settings.autoplay) this.timers.after(2.5, () => this.engine.show(screens.play()));

    panel.scale = 0.3;
    panel.opacity = 0;
    this.tweens.to(panel, { scale: 1, opacity: 1 }, { duration: 0.45, ease: Ease.outBack });
    if (best) {
      this.timers.after(0.6, () => {
        this.engine.particles.burst(180, 340, { count: 40, kind: 'star', colors: ['#fff27a', '#ffffff', '#ff8ad8'], speed: [150, 420], size: [4, 8], gravity: 260 });
        this.engine.sound('best');
        this.engine.haptic('success');
      });
    }
  }

  #quit(): void {
    this.engine.show(screens.title());
  }
}

