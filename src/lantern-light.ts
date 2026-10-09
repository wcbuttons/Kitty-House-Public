import Phaser from "phaser";
import { THEMES, type ThemeId } from "./house-theme";

type Lantern = {
  x: number;
  y: number;
  glow: number;
  flame: [number, number];
};

// Coordinates are measured in each illustration (1408×792, or the 792×1408 tower).
const LANTERNS: Partial<Record<ThemeId, Lantern[]>> = {
  ramen: [
    { x: 548, y: 208, glow: 29, flame: [7, 19] },
    { x: 354, y: 456, glow: 34, flame: [12, 21] },
    { x: 1132, y: 478, glow: 54, flame: [35, 57] },
    { x: 1386, y: 476, glow: 32, flame: [13, 22] },
  ],
  cabin: [
    { x: 603, y: 221, glow: 27, flame: [12, 16] },
    { x: 319, y: 384, glow: 28, flame: [13, 18] },
    { x: 735, y: 420, glow: 29, flame: [13, 18] },
    { x: 319, y: 579, glow: 28, flame: [13, 18] },
    { x: 738, y: 586, glow: 29, flame: [13, 18] },
  ],
  tower: [289, 509, 729, 949, 1169].map((y) => ({
    x: 270,
    y,
    glow: 27,
    flame: [11, 17],
  })),
};

const hash = (value: number) => {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** A short, smooth flutter between long steady spells, independent for each flame. */
export function lanternFlutter(seconds: number, index: number): number {
  const period = 10 + hash(index + 1) * 6;
  const clock = seconds + hash(index + 21) * period;
  const cycle = Math.floor(clock / period);
  const start = 2 + hash(cycle * 13 + index + 41) * 3;
  const duration = 1.7 + hash(cycle * 7 + index + 63) * 0.9;
  const phase = ((clock % period) - start) / duration;
  if (phase <= 0 || phase >= 1) return 0;
  const envelope = Math.sin(phase * Math.PI) ** 2;
  return envelope * (Math.sin(phase * Math.PI * 4.4 + index) * 0.075 - 0.015);
}

/** External daylight dimming changes only the flutter; the artwork owns the steady flame. */
export function lanternAlphas(
  seconds: number,
  index: number,
  intensity = 1,
  reducedMotion = false,
) {
  const scale = Number.isFinite(intensity)
    ? Math.max(0, Math.min(1, intensity))
    : 0;
  const strength = reducedMotion ? 0 : lanternFlutter(seconds, index) * scale;
  return {
    glow: Math.max(0, strength),
    core: Math.max(0, strength) * 1.4,
    shade: Math.max(0, -strength),
  };
}

/** Small local changes over the baked lighting; architecture and furniture stay untouched. */
export class LanternLight {
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private lamps: {
    glow: Phaser.GameObjects.Image;
    core: Phaser.GameObjects.Image;
    shade: Phaser.GameObjects.Image;
  }[] = [];

  constructor(
    scene: Phaser.Scene,
    theme: ThemeId,
    offset: { x: number; y: number },
  ) {
    const lamps = THEMES.find((home) => home.id === theme)?.art?.lamps ?? LANTERNS[theme] ?? [];
    if (!lamps.length) return;
    const key = "lantern-soft-light";
    if (!scene.textures.exists(key)) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 96;
      const context = canvas.getContext("2d")!;
      const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.25, "rgba(255,255,255,0.72)");
      gradient.addColorStop(0.6, "rgba(255,255,255,0.2)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 96, 96);
      scene.textures.addCanvas(key, canvas);
    }
    this.lamps = lamps.map((lamp, index) => {
      const make = (
        part: string,
        width: number,
        height: number,
        tint: number,
        blend: number,
      ) =>
        scene.add
          .image(lamp.x + offset.x, lamp.y + offset.y, key)
          .setDisplaySize(width, height)
          .setTint(tint)
          .setBlendMode(blend)
          .setDepth(1)
          .setAlpha(0)
          .setName(`lantern-${index}-${part}`);
      return {
        glow: make(
          "glow",
          lamp.glow * 2,
          lamp.glow * 2.3,
          0xffbd64,
          Phaser.BlendModes.ADD,
        ),
        core: make("core", ...lamp.flame, 0xffdc99, Phaser.BlendModes.ADD),
        shade: make(
          "shade",
          lamp.glow * 1.6,
          lamp.glow * 1.9,
          0x48311c,
          Phaser.BlendModes.MULTIPLY,
        ),
      };
    });
  }

  update(seconds: number, intensity = 1) {
    this.lamps.forEach((lamp, index) => {
      const alpha = lanternAlphas(
        seconds,
        index,
        intensity,
        this.reducedMotion.matches,
      );
      lamp.glow.setAlpha(alpha.glow);
      lamp.core.setAlpha(alpha.core);
      lamp.shade.setAlpha(alpha.shade);
    });
  }
}
