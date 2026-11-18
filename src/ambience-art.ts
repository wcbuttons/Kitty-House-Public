import type Phaser from "phaser";
import type { DaylightFrame } from "./daylight-art";
import type { DaylightState } from "./daylight";
import type { ThemeId } from "./house-theme";

const profiles = {
  original: "garden",
  cabin: "woods",
  "cabin-v2": "woods",
  ramen: "rain",
  "ramen-v2": "rain",
  tower: "starlight",
} as const satisfies Record<ThemeId, string>;

type Particle = {
  x: number;
  y: number;
  travel: number;
  phase: number;
  rate: number;
  size: number;
};

/** Draw small effects in the authored sky only, behind fixtures and cats. */
export class AmbienceArt {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private readonly particles: Particle[] = [];
  private readonly profile: (typeof profiles)[ThemeId];
  private lastTick = -1;

  constructor(
    scene: Phaser.Scene,
    theme: ThemeId,
    private readonly frame: DaylightFrame,
    mask: HTMLCanvasElement,
  ) {
    this.profile = profiles[theme];
    this.graphics = scene.add.graphics().setDepth(0.65).setName("house-ambience-motion");
    const raining = this.profile === "rain";
    const count = raining ? 62 : this.profile === "starlight" ? 18 : 27;
    const context = mask.getContext("2d")!;
    const alpha = context.getImageData(0, 0, mask.width, mask.height).data;
    const inside = (x: number, y: number) =>
      x >= 0 && x < mask.width && y >= 0 && y < mask.height &&
      alpha[(Math.floor(y) * mask.width + Math.floor(x)) * 4 + 3] > 235;
    let seed = 149 + frame.height;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let attempt = 0; attempt < count * 35 && this.particles.length < count; attempt++) {
      const x = 6 + random() * (frame.width - 12);
      const y = 6 + random() * (frame.height - 12);
      const travel = raining ? 52 + random() * 88 : 8 + random() * 14;
      // Leave enough room for the full trajectory, including the tip of a drop.
      const fits = raining
        ? [0, 0.2, 0.4, 0.6, 0.8, 1].every((t) => {
            const centerX = x - travel * t * 0.22;
            const centerY = y + travel * t;
            return inside(centerX, centerY) && inside(centerX - 4, centerY + 15);
          })
        : [-1, 0, 1].every((i) => [-1, 0, 1].every((j) =>
            inside(x + (travel + 4) * i, y + 10 * j)));
      if (fits) this.particles.push({
        x, y, travel,
        phase: random(),
        rate: raining ? 0.75 + random() * 1.05 : 0.06 + random() * 0.13,
        size: raining ? 5 + random() * 8 : 0.9 + random() * 1.35,
      });
    }
  }

  update(seconds: number, lighting: DaylightState) {
    const tick = this.motion.matches ? -1 : Math.floor(seconds * 30);
    if (tick === this.lastTick) return;
    this.lastTick = tick;
    const g = this.graphics.clear();
    if (tick < 0) return;
    for (const p of this.particles) {
      const life = (p.phase + tick / 30 * p.rate) % 1;
      const pulse = Math.sin(life * Math.PI) ** 2;
      if (this.profile === "rain") {
        const y = this.frame.y + p.y + p.travel * life;
        const x = this.frame.x + p.x - p.travel * life * 0.22;
        g.lineStyle(1, 0xb8ddeb, pulse * (0.19 + lighting.night * 0.11))
          .lineBetween(x, y, x - p.size * 0.22, y + p.size);
      } else {
        const phase = life * Math.PI * 2;
        const x = this.frame.x + p.x + Math.sin(phase) * p.travel;
        const y = this.frame.y + p.y + Math.cos(phase + p.phase) * 6;
        const stars = this.profile === "starlight";
        const strength = stars ? lighting.night * 0.68 : 0.20 + lighting.night * 0.44;
        g.fillStyle(stars ? 0xd4eafe : 0xffdb83, pulse * strength)
          .fillCircle(x, y, p.size * (0.75 + 0.25 * pulse));
      }
    }
  }
}
