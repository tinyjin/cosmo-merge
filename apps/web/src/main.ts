import { init, type RendererType } from '@thorvg/webcanvas';
import type { Host } from '@cosmo-merge/engine';
import { startCosmoMerge } from '@cosmo-merge/game';
import { WebSound } from './sound';

// Pure browser host: @thorvg/webcanvas only, no React, no React Native.
const params = new URLSearchParams(location.search);
const renderer = (params.get('renderer') as RendererType | null) ?? 'gl';

const TVG = await init({
  renderer,
  locateFile: (path) => import.meta.env.BASE_URL + path.split('/').pop(),
});

const element = document.querySelector<HTMLCanvasElement>('#game')!;
const size = () => ({ width: window.innerWidth, height: window.innerHeight });
const canvas = new TVG.Canvas(element, size());
document.querySelector('#loading')?.remove();

const sound = new WebSound();

const host: Host = {
  TVG,
  canvas,
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
  now: () => performance.now(),
  sound,
  haptics: {
    impact: (kind) => navigator.vibrate?.(kind === 'heavy' || kind === 'error' ? 30 : kind === 'light' ? 8 : 15),
  },
  storage: {
    get: (key) => {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set: (key, value) => {
      try { localStorage.setItem(key, value); } catch { /* private mode */ }
    },
  },
  label: `webcanvas · ${renderer}`,
  debug: import.meta.env.DEV,
};

const engine = startCosmoMerge(host, size(), { autoplay: params.has('autoplay') });

window.addEventListener('resize', () => {
  const { width, height } = size();
  canvas.resize(width, height);
  engine.resize(width, height);
});

element.addEventListener('pointerdown', (e) => {
  sound.unlock();
  element.setPointerCapture(e.pointerId);
  engine.pointerDown(e.offsetX, e.offsetY, e.pointerId);
});
element.addEventListener('pointermove', (e) => engine.pointerMove(e.offsetX, e.offsetY, e.pointerId));
element.addEventListener('pointerup', (e) => engine.pointerUp(e.offsetX, e.offsetY, e.pointerId));
element.addEventListener('pointercancel', (e) => engine.pointerUp(e.offsetX, e.offsetY, e.pointerId));
