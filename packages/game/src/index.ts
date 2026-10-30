import { Engine, type Host } from '@cosmo-merge/engine';
import { PlayScreen } from './play';
import { loadFont, screens, settings } from './shared';
import { TitleScreen } from './title';

export { TIERS } from './planets';
export { drawCard, drawIcon, type IconOptions } from './icon';

screens.title = () => new TitleScreen();
screens.play = () => new PlayScreen();

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
