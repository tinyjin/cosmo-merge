import { Engine, decodeBase64, type Host, type TVG } from '@cosmo-merge/engine';
import { FONT_BASE64, FONT_NAME } from './assets/font';
import { PlayScreen } from './play';
import { screens, settings } from './shared';
import { TitleScreen } from './title';

export { TIERS } from './planets';
export { drawIcon, type IconOptions } from './icon';

screens.title = () => new TitleScreen();
screens.play = () => new PlayScreen();

const fontsLoaded = new WeakSet<object>();

function loadFont(TVG: TVG): void {
  if (fontsLoaded.has(TVG.Font)) return;
  TVG.Font.load(FONT_NAME, decodeBase64(FONT_BASE64), { type: 'ttf' });
  fontsLoaded.add(TVG.Font);
}

/** Design resolution. Hosts letterbox it into whatever view they have. */
export const DESIGN = { width: 360, height: 640 };

/**
 * Starts Cosmo Merge on any host. The host keeps the returned engine to feed it resizes and
 * pointer events, and calls `destroy()` before destroying its canvas.
 */
export function startCosmoMerge(host: Host, view: { width: number; height: number }, options: { autoplay?: boolean } = {}): Engine {
  loadFont(host.TVG);
  settings.autoplay = options.autoplay ?? false;
  const engine = new Engine(host, DESIGN);
  engine.resize(view.width, view.height);
  engine.start(settings.autoplay ? screens.play() : screens.title());
  return engine;
}
