# Cosmo Merge

A small 2D game engine on the [`@thorvg/webcanvas`](https://www.npmjs.com/package/@thorvg/webcanvas) API, and **Cosmo Merge**, a drop-and-merge planet game built on it.

The engine and the game are plain TypeScript that only talk to the ThorVG API. The same source runs:

| Host | ThorVG | Platforms |
|---|---|---|
| `apps/web` | `@thorvg/webcanvas` (WASM), no React | Browser |
| `apps/mobile` | [`thorvg-react-native`](https://www.npmjs.com/package/thorvg-react-native) (native ThorVG over JSI, WASM on web) | iOS, Android, Web |
| `apps/desktop` | `thorvg-canvas` (native ThorVG over Node-API, `sw`) in an [SDL](https://www.npmjs.com/package/@kmamal/sdl) window | macOS, Windows, Linux |

```
packages/engine   @cosmo-merge/engine  scene graph, tweens, particles, input, buttons, game loop
packages/game     @cosmo-merge/game    the game: planets, physics, title / play / results
apps/web          pure WebCanvas host (Vite)
apps/mobile       React Native host (Expo)
apps/desktop      Node host: thorvg-canvas + SDL window, no browser engine
```

## How it fits together

A host gives the engine a ThorVG namespace, a canvas, a frame clock and optional device services:

```ts
interface Host {
  TVG: TVG;                 // init() from webcanvas, or useThorVG() from thorvg-react-native
  canvas: Canvas;
  requestFrame(cb): number;
  cancelFrame(id): void;
  now(): number;
  sound?: Sound;            // web: Web Audio synth
  haptics?: Haptics;        // mobile: expo-haptics
  storage?: Storage;        // web: localStorage
}
```

The host then forwards size changes (`engine.resize`) and pointers (`engine.pointerDown/Move/Up`). Nothing else in the engine or the game knows which platform it is on.

## Engine notes

- **Retained scene graph.** `Node` wraps one ThorVG paint. Setters only record changes. Once per frame, `Node.flush()` sends one `transform()` per moved node, and nodes that didn't move cost nothing. On React Native every paint call crosses JSI, so this keeps the per-frame call count proportional to what actually moves.
- **No allocation mid-game.** Planet art is built once per tier and instanced with `duplicate()`. Particles come from a fixed pool and are recycled by toggling `visible`.
- **Skip idle frames.** `canvas.update().render()` runs only when something changed.
- **Letterboxing.** Games are laid out in design units (360×640 here) and scaled to fit. `engine.view` exposes the full visible area so backgrounds can bleed to the edges.

## Run

```sh
yarn
yarn web              # pure WebCanvas, http://localhost:5173 (?renderer=sw|gl|wg)
yarn ios              # React Native on iOS (renderer: sw)
yarn android          # React Native on Android (renderer: gl)
yarn mobile:web       # React Native for Web
yarn desktop          # Node + SDL window (renderer: sw)
```

## Cosmo Merge

Drag to aim and release to drop. When two planets of the same kind touch, they merge into the next one: Comet → Moon → Mercury → Mars → Venus → Earth → Neptune → Uranus → Saturn → Jupiter → Sun. Two Suns go supernova. Quick merges chain into combos. The game ends when planets stay above the rim.

The font is Fredoka (SIL Open Font License), embedded as base64 so every host loads it the same way.
