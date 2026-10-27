import type { Canvas, ThorVGNamespace } from '@thorvg/webcanvas';

export type { Canvas, Paint, Scene, Shape, Text, Picture } from '@thorvg/webcanvas';

/**
 * The ThorVG namespace without `Canvas` (the host creates it) and `Video` (web only).
 * `init()` from @thorvg/webcanvas and `useThorVG()` from thorvg-react-native both satisfy it.
 */
export type TVG = Omit<ThorVGNamespace, 'Canvas' | 'Video'>;

export interface Sound {
  /** Play a named effect. `pitch` is a multiplier, 1 is the base pitch. */
  play(name: string, options?: { pitch?: number; volume?: number }): void;
}

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'error';

export interface Haptics {
  impact(kind: HapticKind): void;
}

export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/**
 * Everything the engine needs from the platform. A host is the only code that knows whether it
 * runs in a browser, React Native, or anything else that can hand over a ThorVG canvas.
 */
export interface Host {
  TVG: TVG;
  canvas: Canvas;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(id: number): void;
  now(): number;
  sound?: Sound;
  haptics?: Haptics;
  storage?: Storage;
  /** Shown in the stats overlay, e.g. "web · gl". */
  label?: string;
}

export interface PointerEvent {
  /** Position in design coordinates. */
  x: number;
  y: number;
  id: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
