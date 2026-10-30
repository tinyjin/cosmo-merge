import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { init, type Paint } from 'thorvg-canvas';
import { drawCard, drawIcon, type IconOptions } from '@cosmo-merge/game';

// Renders every platform's app icon from the game's own art: `yarn icons`.
const root = join(import.meta.dirname, '../../..');
const TVG = await init();

function save(file: string, width: number, height: number, paint: Paint) {
  const canvas = new TVG.Canvas({ width, height });
  canvas.add(paint).render();
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, canvas.toBufferSync('png'));
  canvas.destroy();
}

function png(file: string, size: number, options?: IconOptions & { round?: boolean }) {
  const icon = drawIcon(TVG, size, options);
  if (options?.round) icon.clip(new TVG.Shape().appendCircle(size / 2, size / 2, size / 2, size / 2));
  save(file, size, size, icon);
}

// Web
png('apps/web/public/favicon.png', 64, { sky: false, sun: 0.88 });
png('apps/web/public/apple-touch-icon.png', 180);
png('apps/web/public/icon-512.png', 512);
save('apps/web/public/og.png', 1200, 630, drawCard(TVG, 1200, 630));

// iOS: one 1024 image, Xcode derives the rest.
png('apps/mobile/ios/CosmoMerge/Images.xcassets/AppIcon.appiconset/icon-1024.png', 1024);

// Android: legacy 48dp icons plus 108dp adaptive layers (the launcher masks the middle 66dp).
const res = 'apps/mobile/android/app/src/main/res';
for (const [dpi, k] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]] as const) {
  png(`${res}/mipmap-${dpi}/ic_launcher.png`, 48 * k);
  png(`${res}/mipmap-${dpi}/ic_launcher_round.png`, 48 * k, { round: true });
  png(`${res}/mipmap-${dpi}/ic_launcher_foreground.png`, 108 * k, { sky: false, sun: 0.58 });
  png(`${res}/mipmap-${dpi}/ic_launcher_background.png`, 108 * k, { skyOnly: true });
}
