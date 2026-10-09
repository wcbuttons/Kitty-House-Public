import { afterEach, expect, test, vi } from "vitest";
import { daylightAt, type DaylightState } from "../src/daylight";

vi.mock("../src/lantern-light", () => ({
  LanternLight: class { update() {} },
}));

const motion = { matches: false };
async function artwork(theme = "cabin-v2") {
  vi.stubGlobal("window", {
    localStorage: { getItem: () => theme },
    matchMedia: () => motion,
  });
  vi.resetModules();
  return import("../src/theme-art");
}

afterEach(() => {
  motion.matches = false;
  vi.unstubAllGlobals();
  vi.resetModules();
});

function sceneMock() {
  class Image {
    alpha = 1;
    depth = 0;
    name = "";
    frame = 0;
    frameChanges = 0;
    constructor(public x: number, public y: number, public texture: string) {}
    setOrigin() { return this; }
    setDepth(value: number) { this.depth = value; return this; }
    setAlpha(value: number) { this.alpha = value; return this; }
    setName(value: string) { this.name = value; return this; }
    setTint() { return this; }
    setFrame(value: number) { this.frame = value; this.frameChanges++; return this; }
  }
  const sprites: Image[] = [];
  const scene = {
    load: { image: vi.fn(), spritesheet: vi.fn() },
    add: {
      image: (x: number, y: number, key: string) => new Image(x, y, key),
      sprite: (x: number, y: number, key: string) => {
        const sprite = new Image(x, y, key);
        sprites.push(sprite);
        return sprite;
      },
    },
  };
  return { scene, sprites };
}

const lighting = (hour: number): DaylightState => ({
  ...daylightAt(hour), mode: "manual", timeLabel: "", zoneLabel: "",
});

test("only themes with an authored fireplace request the flame sheet", async () => {
  for (const theme of ["original", "cabin", "ramen", "tower", "cabin-v2", "ramen-v2"]) {
    const { preloadThemeArt } = await artwork(theme);
    const { scene } = sceneMock();
    preloadThemeArt(scene as never);
    if (theme === "cabin-v2") {
      expect(scene.load.spritesheet).toHaveBeenCalledExactlyOnceWith(
        "theme-fireplace-flames",
        "/assets/houses/cabin-v2/fireplace-flames.png",
        { frameWidth: 45, frameHeight: 66, endFrame: 15 },
      );
    } else expect(scene.load.spritesheet).not.toHaveBeenCalled();
  }
});

test("a single all-day flame loops on simulation time independently of daylight redraws", async () => {
  const { ThemeArt } = await artwork();
  const { scene, sprites } = sceneMock();
  const art = new ThemeArt(scene as never);
  art.drawHouse();
  art.drawHouse();
  expect(sprites).toHaveLength(1);
  const fire = sprites[0];
  expect(fire).toMatchObject({ x: 252, y: 608, depth: 0.75, alpha: 1, name: "theme-fireplace-flames" });
  for (const hour of [12, 6.5, 18.5, 0]) {
    const state = lighting(hour);
    art.update(0, state);
    expect(fire.frame).toBe(0);
    art.update(0.11, state);
    expect(fire.frame).toBe(1);
    art.update(0.31, state);
    expect(fire.frame).toBe(3);
    const changes = fire.frameChanges;
    // A paused simulation reuses elapsed time, regardless of a changing clock.
    art.update(0.31, lighting(hour + 0.1));
    expect(fire.frameChanges).toBe(changes);
    art.update(1.6, state);
    expect(fire.frame).toBe(0);
    expect(fire.alpha).toBe(1);
  }
  motion.matches = true;
  art.update(0.7, lighting(12));
  expect(fire.frame).toBe(0);
  motion.matches = false;
  art.update(0.7, lighting(12));
  expect(fire.frame).toBe(7);
  motion.matches = true;
  art.update(0.8, lighting(12));
  expect(fire.frame).toBe(0);
});
