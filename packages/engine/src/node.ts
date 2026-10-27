import type { Matrix } from '@thorvg/webcanvas';
import type { Paint, Scene, Text, TVG } from './types';

const dirty = new Set<Node>();
let touched = false;
const matrix: Matrix = { e11: 1, e12: 0, e13: 0, e21: 0, e22: 1, e23: 0, e31: 0, e32: 0, e33: 1 };

const TRANSFORM = 1;
const OPACITY = 2;
const VISIBLE = 4;

/**
 * A retained scene-graph node over one ThorVG paint.
 *
 * Setters only record what changed. `Node.flush()` pushes the changes once per frame, so a node
 * that moves costs one `transform()` call however many properties changed, and a node that stays
 * still costs nothing. This matters on React Native, where each paint call crosses JSI.
 */
export class Node {
  readonly paint: Paint;
  parent: Node | null = null;
  readonly children: Node[] = [];
  /** Free-form slot for game code. */
  data: unknown;

  #x = 0;
  #y = 0;
  #rotation = 0;
  #scaleX = 1;
  #scaleY = 1;
  #opacity = 1;
  #visible = true;
  #flags = 0;
  #owned: Paint[] = [];
  #destroyed = false;

  constructor(paint: Paint) {
    this.paint = paint;
  }

  /** An empty container. */
  static group(TVG: TVG): Node {
    return new Node(new TVG.Scene());
  }

  /** Pushes pending node changes to ThorVG. Returns whether anything on screen changed. */
  static flush(): boolean {
    for (const node of dirty) node.#sync();
    dirty.clear();
    const changed = touched;
    touched = false;
    return changed;
  }

  /** Call after mutating a paint directly (shape.reset(), text.text(), ...) so the frame redraws. */
  static touch(): void {
    touched = true;
  }

  get x() { return this.#x; }
  set x(v: number) { if (v !== this.#x) { this.#x = v; this.#mark(TRANSFORM); } }
  get y() { return this.#y; }
  set y(v: number) { if (v !== this.#y) { this.#y = v; this.#mark(TRANSFORM); } }
  /** Degrees, clockwise. */
  get rotation() { return this.#rotation; }
  set rotation(v: number) { if (v !== this.#rotation) { this.#rotation = v; this.#mark(TRANSFORM); } }
  get scaleX() { return this.#scaleX; }
  set scaleX(v: number) { if (v !== this.#scaleX) { this.#scaleX = v; this.#mark(TRANSFORM); } }
  get scaleY() { return this.#scaleY; }
  set scaleY(v: number) { if (v !== this.#scaleY) { this.#scaleY = v; this.#mark(TRANSFORM); } }
  get scale() { return this.#scaleX; }
  set scale(v: number) { this.scaleX = v; this.scaleY = v; }
  /** 0..1 */
  get opacity() { return this.#opacity; }
  set opacity(v: number) {
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    if (v !== this.#opacity) { this.#opacity = v; this.#mark(OPACITY); }
  }
  get visible() { return this.#visible; }
  set visible(v: boolean) { if (v !== this.#visible) { this.#visible = v; this.#mark(VISIBLE); } }
  get destroyed() { return this.#destroyed; }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Adds a child node. This node's paint must be a Scene.
   * Add each node once: ThorVG's Scene.add() takes a JS-side reference per call, so moving a node
   * between parents keeps it alive after destroy(). Toggle `visible` on copies instead.
   */
  add<T extends Node>(child: T): T {
    child.parent?.remove(child);
    (this.paint as Scene).add(child.paint);
    child.parent = this;
    this.children.push(child);
    touched = true;
    return child;
  }

  /** Adds a raw paint that lives and dies with this node. */
  draw<P extends Paint>(paint: P): P {
    (this.paint as Scene).add(paint);
    this.#owned.push(paint);
    touched = true;
    return paint;
  }

  remove(child: Node): void {
    const i = this.children.indexOf(child);
    if (i < 0) return;
    this.children.splice(i, 1);
    (this.paint as Scene).remove(child.paint);
    child.parent = null;
    touched = true;
  }

  /** Removes the node from its parent and releases every paint it owns. */
  destroy(): void {
    if (this.#destroyed) return;
    this.parent?.remove(this);
    this.#release();
  }

  #release(): void {
    this.#destroyed = true;
    dirty.delete(this);
    for (const child of this.children) child.#release();
    this.children.length = 0;
    for (const paint of this.#owned) paint.dispose();
    this.#owned.length = 0;
    this.paint.dispose();
  }

  #mark(flag: number): void {
    if (this.#destroyed) return;
    this.#flags |= flag;
    dirty.add(this);
  }

  #sync(): void {
    if (this.#destroyed) return;
    const flags = this.#flags;
    this.#flags = 0;
    if (flags & TRANSFORM) {
      const r = this.#rotation / (180 / Math.PI);
      const c = Math.cos(r);
      const s = Math.sin(r);
      matrix.e11 = c * this.#scaleX;
      matrix.e12 = -s * this.#scaleY;
      matrix.e13 = this.#x;
      matrix.e21 = s * this.#scaleX;
      matrix.e22 = c * this.#scaleY;
      matrix.e23 = this.#y;
      this.paint.transform(matrix);
    }
    if (flags & OPACITY) this.paint.opacity(Math.round(this.#opacity * 255));
    if (flags & VISIBLE) this.paint.visible(this.#visible);
    touched = true;
  }
}

export interface LabelOptions {
  font: string;
  size: number;
  color?: [number, number, number];
  /** 0 = left, 0.5 = center, 1 = right of the node's x. */
  alignX?: number;
  /** 0 = top, 0.5 = middle, 1 = bottom of the node's y. */
  alignY?: number;
  outline?: { width: number; color: [number, number, number] };
  /** Layout box width. Only needed for wrapping. */
  width?: number;
}

const LABEL_BOX = 2000;

/**
 * A text node. The text is anchored inside a fixed box so alignment works without measuring.
 * An outline is drawn by a second text underneath: glyphs with overlapping contours would
 * otherwise show the outline inside the letter.
 */
export class Label extends Node {
  readonly text: Text;
  #back: Text | null = null;
  #value = '';

  constructor(TVG: TVG, value: string, options: LabelOptions) {
    super(new TVG.Scene());
    const { font, size, color = [255, 255, 255], alignX = 0.5, alignY = 0.5, outline, width } = options;
    const box = width ?? LABEL_BOX;
    const make = (c: [number, number, number]) =>
      new TVG.Text()
        .font(font)
        .fontSize(size)
        .fill(c[0], c[1], c[2])
        .layout(box, LABEL_BOX)
        .align(alignX, alignY)
        .translate(-box * alignX, -LABEL_BOX * alignY);
    if (outline) {
      this.#back = this.draw(make(outline.color).outline(outline.width * 1.4, ...outline.color));
    }
    this.text = this.draw(make(color));
    this.value = value;
  }

  get value() { return this.#value; }
  set value(v: string) {
    if (v === this.#value) return;
    this.#value = v;
    this.text.text(v);
    this.#back?.text(v);
    Node.touch();
  }

  setColor(r: number, g: number, b: number): this {
    this.text.fill(r, g, b);
    Node.touch();
    return this;
  }

  setSize(size: number): this {
    this.text.fontSize(size);
    this.#back?.fontSize(size);
    Node.touch();
    return this;
  }
}
