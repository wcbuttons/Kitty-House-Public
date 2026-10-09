import { describe, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: {} }));
import { lanternAlphas, lanternFlutter } from "../src/lantern-light";
import { daylightAt } from "../src/daylight";

describe("lanterns following daylight", () => {
  it("preserves existing flutter by default and scales it exactly with external intensity", () => {
    let active = 0;
    for (let index = 0; index < 5; index++) {
      for (let sample = 0; sample < 1000; sample++) {
        const seconds = sample / 10;
        const strength = lanternFlutter(seconds, index);
        const normal = lanternAlphas(seconds, index);
        const dimmed = lanternAlphas(seconds, index, 0.35);
        expect(normal).toEqual({
          glow: Math.max(0, strength),
          core: Math.max(0, strength) * 1.4,
          shade: Math.max(0, -strength),
        });
        for (const part of ["glow", "core", "shade"] as const)
          expect(dimmed[part]).toBeCloseTo(normal[part] * 0.35, 12);
        if (normal.glow || normal.shade) active++;
      }
    }
    expect(active).toBeGreaterThan(300);
    expect(active).toBeLessThan(1500);
  });

  it("suppresses daytime flutter and respects reduced motion at every light level", () => {
    for (let seconds = 0; seconds < 40; seconds += 0.1) {
      expect(
        lanternAlphas(seconds, 2, daylightAt(12).lanternIntensity),
      ).toEqual({ glow: 0, core: 0, shade: 0 });
      for (const hour of [0, 6.5, 12, 18.5, 23])
        expect(
          lanternAlphas(seconds, 2, daylightAt(hour).lanternIntensity, true),
        ).toEqual({ glow: 0, core: 0, shade: 0 });
      expect(lanternAlphas(seconds, 2, daylightAt(0).lanternIntensity)).toEqual(
        lanternAlphas(seconds, 2),
      );
    }
  });

  it("clamps caller intensity safely", () => {
    for (let seconds = 0; seconds < 30; seconds += 0.1) {
      for (const intensity of [-1, NaN, Infinity])
        expect(lanternAlphas(seconds, 1, intensity)).toEqual({
          glow: 0,
          core: 0,
          shade: 0,
        });
      expect(lanternAlphas(seconds, 1, 2)).toEqual(
        lanternAlphas(seconds, 1, 1),
      );
    }
  });
});
