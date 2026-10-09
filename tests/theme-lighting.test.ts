import { describe, expect, it, vi } from "vitest";
vi.mock("../src/lantern-light", () => ({ LanternLight: class {} }));
import { furnitureLightingTint } from "../src/theme-art";
import { daylightAt, type DaylightState } from "../src/daylight";

const state = (hour: number): DaylightState => ({
  ...daylightAt(hour), mode: "manual", timeLabel: "", zoneLabel: "",
});
const channels = (color: number) => [color >> 16, (color >> 8) & 255, color & 255];

describe("illustrated furniture lighting", () => {
  it("leaves the original house art unchanged", () => {
    for (const hour of [0, 6.5, 12, 18.5])
      expect(furnitureLightingTint(state(hour), "original", 300, 500)).toBe(0xffffff);
  });

  it("gives nighttime furniture local candle warmth while retaining detail in darker corners", () => {
    const near = channels(furnitureLightingTint(state(0), "tower", 270, 509));
    const far = channels(furnitureLightingTint(state(0), "tower", 600, 509));
    expect(near[0]).toBeGreaterThan(far[0]);
    expect(near[2]).toBeLessThan(far[2]);
    expect(Math.min(...far)).toBeGreaterThan(210);
  });

  it("uses cool neutral daylight and reverses directional warmth from dawn to dusk", () => {
    const noon = channels(furnitureLightingTint(state(12), "cabin", 400, 400));
    expect(noon[2]).toBeGreaterThan(noon[0]);
    const dawnLeft = channels(furnitureLightingTint(state(6.5), "ramen", 200, 300));
    const dawnRight = channels(furnitureLightingTint(state(6.5), "ramen", 1200, 300));
    const duskLeft = channels(furnitureLightingTint(state(18.5), "ramen", 200, 300));
    const duskRight = channels(furnitureLightingTint(state(18.5), "ramen", 1200, 300));
    expect(dawnLeft[0]).toBeGreaterThan(dawnRight[0]);
    expect(duskRight[0]).toBeGreaterThan(duskLeft[0]);
    expect(duskLeft[1]).toBeLessThan(dawnLeft[1]);
  });

  it("matches the new darker V2 plates and shades exposed veranda furniture", () => {
    for (const [theme, inside, outside] of [
      ["cabin-v2", [540, 670], [970, 670]],
      ["ramen-v2", [780, 650], [480, 360]],
    ] as const) {
      const day = channels(furnitureLightingTint(state(12), theme, ...inside));
      const night = channels(furnitureLightingTint(state(0), theme, ...inside));
      const dusk = channels(furnitureLightingTint(state(18.5), theme, ...inside));
      const veranda = channels(furnitureLightingTint(state(0), theme, ...outside));
      for (let channel = 0; channel < 3; channel++) {
        expect(night[channel]).toBeLessThan(day[channel] * 0.8);
        expect(dusk[channel]).toBeGreaterThan(night[channel]);
        expect(dusk[channel]).toBeLessThan(day[channel]);
      }
      expect(veranda[0]).toBeLessThan(night[0]);
      expect(veranda[2]).toBeGreaterThan(veranda[0]);
    }
  });

  it("stays bounded and changes smoothly throughout the daily cycle and midnight wrap", () => {
    for (const theme of ["cabin", "ramen", "tower"] as const) {
      let previous = channels(furnitureLightingTint(state(0), theme, 420, 640));
      for (let minute = 1; minute <= 1440; minute++) {
        const next = channels(furnitureLightingTint(state(minute / 60), theme, 420, 640));
        for (let channel = 0; channel < 3; channel++) {
          expect(next[channel]).toBeGreaterThan(200);
          expect(next[channel]).toBeLessThanOrEqual(255);
          expect(Math.abs(next[channel] - previous[channel])).toBeLessThanOrEqual(1);
        }
        previous = next;
      }
    }
  });
});
