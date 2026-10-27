import { rgba, type RGBA } from './color';
import type { Shape, TVG } from './types';

export type Stops = Array<[number, string | RGBA]>;

const stop = (c: string | RGBA): RGBA => (typeof c === 'string' ? rgba(c) : c);

/**
 * Shape builders. Every paint here is plain @thorvg/webcanvas API, so the same calls run on
 * WebAssembly in the browser and on native ThorVG through JSI.
 */
export class Draw {
  constructor(readonly TVG: TVG) {}

  circle(cx: number, cy: number, r: number, color?: string | RGBA): Shape {
    const s = new this.TVG.Shape().appendCircle(cx, cy, r, r);
    if (color) s.fill(...stop(color));
    return s;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color?: string | RGBA): Shape {
    const s = new this.TVG.Shape().appendCircle(cx, cy, rx, ry);
    if (color) s.fill(...stop(color));
    return s;
  }

  rect(x: number, y: number, w: number, h: number, radius = 0, color?: string | RGBA): Shape {
    const s = new this.TVG.Shape().appendRect(x, y, w, h, { rx: radius, ry: radius });
    if (color) s.fill(...stop(color));
    return s;
  }

  /** Builds a path from an SVG-like list: ['M', x, y, 'L', x, y, 'C', ..., 'Z']. */
  path(cmds: Array<string | number>, color?: string | RGBA): Shape {
    const s = new this.TVG.Shape();
    for (let i = 0; i < cmds.length; ) {
      const c = cmds[i++];
      const n = () => cmds[i++] as number;
      if (c === 'M') s.moveTo(n(), n());
      else if (c === 'L') s.lineTo(n(), n());
      else if (c === 'C') s.cubicTo(n(), n(), n(), n(), n(), n());
      else if (c === 'Z') s.close();
    }
    if (color) s.fill(...stop(color));
    return s;
  }

  star(cx: number, cy: number, points: number, outer: number, inner: number, color?: string | RGBA): Shape {
    const s = new this.TVG.Shape();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.close();
    if (color) s.fill(...stop(color));
    return s;
  }

  linear(x1: number, y1: number, x2: number, y2: number, stops: Stops) {
    const g = new this.TVG.LinearGradient(x1, y1, x2, y2);
    g.setStops(...stops.map(([o, c]) => [o, stop(c)] as [number, RGBA]));
    return g;
  }

  radial(cx: number, cy: number, r: number, stops: Stops, fx = cx, fy = cy) {
    const g = new this.TVG.RadialGradient(cx, cy, r, fx, fy, 0);
    g.setStops(...stops.map(([o, c]) => [o, stop(c)] as [number, RGBA]));
    return g;
  }

  stroke(shape: Shape, width: number, color: string | RGBA, options: { cap?: 'round' | 'butt'; dash?: number[] } = {}): Shape {
    shape.stroke({
      width,
      color: stop(color),
      cap: options.cap === 'round' ? this.TVG.StrokeCap.Round : undefined,
      join: options.cap === 'round' ? this.TVG.StrokeJoin.Round : undefined,
      dash: options.dash,
    });
    return shape;
  }
}
