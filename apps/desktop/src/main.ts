import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import sdl from '@kmamal/sdl';
import { init } from 'thorvg-canvas';
import type { Host } from '@cosmo-merge/engine';
import { startCosmoMerge } from '@cosmo-merge/game';

// Native desktop host: thorvg-canvas (ThorVG over Node-API, sw) drawn into an SDL window. No browser engine.
const autoplay = process.argv.includes('--autoplay');

const window = sdl.video.createWindow({ title: 'Cosmo Merge', width: 405, height: 720, resizable: true, vsync: false });
const pixelRatio = window.pixelWidth / window.width;

const TVG = await init({ threads: 4 });
const canvas = new TVG.Canvas({ width: window.width, height: window.height, pixelRatio });

// Present only the frames the engine actually rendered.
let dirty = true;
const render = canvas.render.bind(canvas);
canvas.render = () => {
  render();
  dirty = true;
  return canvas;
};

function present() {
  if (!dirty || window.destroyed) return;
  dirty = false;
  const { data, width, height } = canvas.getImageData();
  window.render(width, height, width * 4, 'rgba32', Buffer.from(data.buffer, data.byteOffset, data.byteLength));
}

const FRAME = 1000 / 60;
let nextFrame = performance.now();
let frameId = 0;
const timers = new Map<number, NodeJS.Timeout>();

const storePath = join(homedir(), '.cosmo-merge', 'storage.json');
let store: Record<string, string> = {};
try { store = JSON.parse(readFileSync(storePath, 'utf8')); } catch { /* first run */ }

const host: Host = {
  TVG,
  canvas,
  requestFrame: (cb) => {
    const id = ++frameId;
    nextFrame = Math.max(nextFrame + FRAME, performance.now());
    timers.set(id, setTimeout(() => {
      timers.delete(id);
      cb(performance.now());
      present();
    }, Math.max(0, nextFrame - performance.now())));
    return id;
  },
  cancelFrame: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
  },
  now: () => performance.now(),
  storage: {
    get: (key) => store[key] ?? null,
    set: (key, value) => {
      store[key] = value;
      try {
        mkdirSync(dirname(storePath), { recursive: true });
        writeFileSync(storePath, JSON.stringify(store));
      } catch { /* read-only home */ }
    },
  },
  label: `desktop · ${canvas.renderer} · ${pixelRatio}x`,
};

const engine = startCosmoMerge(host, { width: window.width, height: window.height }, { autoplay });

window.on('resize', ({ width, height }) => {
  canvas.resize(width, height);
  engine.resize(width, height);
  dirty = true;
});

let pressed = false;
window.on('mouseButtonDown', ({ x, y, button }) => {
  if (button !== sdl.mouse.BUTTON.LEFT) return;
  pressed = true;
  engine.pointerDown(x, y, 0);
});
window.on('mouseMove', ({ x, y }) => engine.pointerMove(x, y, 0));
window.on('mouseButtonUp', ({ x, y, button }) => {
  if (button !== sdl.mouse.BUTTON.LEFT || !pressed) return;
  pressed = false;
  engine.pointerUp(x, y, 0);
});

window.on('close', () => {
  engine.destroy();
  canvas.destroy();
  process.exit(0);
});
