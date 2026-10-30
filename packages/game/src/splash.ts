import { Ease, Node, Screen, type Rect } from '@cosmo-merge/engine';
import type { LottieAnimation, Picture, Shape } from '@cosmo-merge/engine';
import splash from './assets/powered-by-thorvg.json';
import { planets, screens } from './shared';

/** Share of the Lottie's width its logo spans; it is scaled so that much fits a portrait view. */
const LOGO_SPAN = 0.55;

/** "Powered by ThorVG", played once before the title. Tap to skip. */
export class SplashScreen extends Screen {
  #anim!: LottieAnimation;
  #picture!: Picture;
  #aspect = 16 / 9;
  #backdrop!: Shape;
  #content!: Node;
  #time = 0;
  #leaving = false;

  enter(): void {
    const { TVG, draw, layer } = this;
    this.#backdrop = layer.draw(draw.rect(0, 0, 1, 1, 0, '#000000'));
    this.#anim = new TVG.LottieAnimation();
    this.#anim.load(JSON.stringify(splash));
    this.#content = layer.add(Node.group(TVG));
    this.#picture = this.#content.draw(this.#anim.picture!);
    const { width, height } = this.#picture.size();
    if (width > 0 && height > 0) this.#aspect = width / height;
    // Build every planet now, while the logo plays, so the title opens without a hitch.
    planets(this.engine);
  }

  override resize(view: Rect): void {
    const width = Math.min(view.height * this.#aspect, view.width / LOGO_SPAN);
    const height = width / this.#aspect;
    this.#backdrop.reset().appendRect(view.x, view.y, view.width, view.height);
    this.#picture.size(width, height);
    this.#picture.translate(view.x + (view.width - width) / 2, view.y + (view.height - height) / 2);
    Node.touch();
  }

  override update(dt: number): void {
    const info = this.#anim.info();
    if (!info) return this.#leave();
    this.#time += dt;
    this.#anim.frame(Math.min(this.#time * info.fps, info.totalFrames - 1));
    Node.touch();
    if (this.#time >= info.duration) this.#leave();
  }

  override pointerDown(): void {
    this.#leave();
  }

  #leave(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    this.tweens.to(this.#content, { opacity: 0 }, {
      duration: 0.35, ease: Ease.inOutQuad, onComplete: () => this.engine.show(screens.title()),
    });
  }
}
