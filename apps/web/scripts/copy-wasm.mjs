// @thorvg/webcanvas loads thorvg.wasm next to the page; its package exports do not expose the file, so copy it.
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('@thorvg/webcanvas'));
copyFileSync(join(dist, 'thorvg.wasm'), new URL('../public/thorvg.wasm', import.meta.url));
