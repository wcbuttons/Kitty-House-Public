import { afterEach, describe, expect, it, vi } from "vitest";
import {
  celestialPosition,
  daylightRenderKey,
  DaylightArt,
  windowSkyOpacity,
} from "../src/daylight-art";
import { daylightAt, type DaylightState } from "../src/daylight";

const landscape = { x: -144, y: -1, width: 1408, height: 792 };
const tower = { x: 0, y: 0, width: 792, height: 1408 };
const state = (
  hour: number,
  mode: DaylightState["mode"] = "manual",
): DaylightState => ({
  ...daylightAt(hour),
  mode,
  timeLabel: "",
  zoneLabel: "",
});
afterEach(() => vi.unstubAllGlobals());

describe("decorative celestial paths", () => {
  it("moves the sun east to west across a high noon and the moon across midnight", () => {
    const rise = celestialPosition(6, "sun", "cabin", landscape);
    const noon = celestialPosition(12, "sun", "cabin", landscape);
    const set = celestialPosition(18, "sun", "cabin", landscape);
    expect(rise.x).toBeCloseTo(landscape.width * 0.1);
    expect(set.x).toBeCloseTo(landscape.width * 0.9);
    expect(noon.x).toBeCloseTo(landscape.width * 0.5);
    expect(noon.y).toBeCloseTo(50);
    expect(rise.y).toBeCloseTo(landscape.height * 0.62);
    expect(noon.visibility).toBe(1);
    expect(celestialPosition(0, "sun", "cabin", landscape).visibility).toBe(0);
    expect(celestialPosition(0, "moon", "cabin", landscape).y).toBeCloseTo(
      noon.y,
    );
    expect(celestialPosition(12, "moon", "cabin", landscape).visibility).toBe(
      0,
    );
  });

  it("uses the tall tower's authored horizon and high point in its own frame coordinates", () => {
    expect(celestialPosition(6, "sun", "tower", tower).y).toBeCloseTo(1000);
    expect(celestialPosition(12, "sun", "tower", tower).y).toBeCloseTo(55);
    expect(celestialPosition(0, "moon", "tower", tower).x).toBeCloseTo(261.36);
    expect(
      celestialPosition(12, "sun", "tower", { width: 396, height: 704 }).y,
    ).toBeCloseTo(27.5);
    // The ramen roof leaves a smaller sky gap within its landscape frame.
    expect(celestialPosition(12, "sun", "ramen", landscape).y).toBeCloseTo(28);
  });

  it("keeps the tower's visible noon and midnight disks clear of its centered finial", () => {
    for (const [hour, body] of [[12, "sun"], [0, "moon"]] as const) {
      const position = celestialPosition(hour, body, "tower", tower);
      expect(Math.abs(position.x - 410)).toBeGreaterThan(100);
      expect(position.y).toBeLessThan(80);
    }
  });

  it("remains finite and continuous through midnight, sunrise and sunset across a whole day", () => {
    for (const theme of ["original", "cabin", "ramen", "tower", "cabin-v2", "ramen-v2"] as const) {
      const frame = theme === "tower" ? tower : landscape;
      for (const body of ["sun", "moon"] as const) {
        let previous = celestialPosition(0, body, theme, frame);
        for (let minute = 1; minute <= 1440; minute++) {
          const position = celestialPosition(minute / 60, body, theme, frame);
          expect(position.visibility).toBeGreaterThanOrEqual(0);
          expect(position.visibility).toBeLessThanOrEqual(1);
          expect(position.x).toBeGreaterThanOrEqual(frame.width * 0.1 - 1e-9);
          expect(position.x).toBeLessThanOrEqual(frame.width * 0.9 + 1e-9);
          expect(
            Math.hypot(position.x - previous.x, position.y - previous.y),
          ).toBeLessThan(5);
          previous = position;
        }
        const before = celestialPosition(24 - 1e-6, body, theme, frame);
        const after = celestialPosition(1e-6, body, theme, frame);
        expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(
          0.01,
        );
      }
    }
  });
});

function sceneMock(maskExists = false, atmosphereExists = false) {
  type MockCanvas = {
    width: number;
    height: number;
    getContext: () => Record<string, unknown>;
    context: Record<string, unknown>;
    drawCalls: { source: unknown; composite: unknown }[];
  };
  const textures: {
    key: string;
    canvas: MockCanvas;
    refresh: ReturnType<typeof vi.fn>;
  }[] = [];
  const images: { destroy: ReturnType<typeof vi.fn> }[] = [];
  const canvases: MockCanvas[] = [];
  const sources = {
    "theme-sky-mask": {
      name: "celestial mask",
      width: tower.width,
      height: tower.height,
    },
    "theme-atmosphere-mask": {
      name: "atmosphere mask",
      width: tower.width,
      height: tower.height,
    },
  };
  vi.stubGlobal("document", {
    createElement: () => {
      const gradient = { addColorStop: vi.fn() };
      const drawCalls: MockCanvas["drawCalls"] = [];
      const context = new Proxy(
        {
          globalCompositeOperation: "source-over",
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          createLinearGradient: () => gradient,
          createRadialGradient: () => gradient,
        } as Record<string, unknown>,
        {
          get: (target, key: string) =>
            key in target ? target[key] : () => {},
        },
      );
      context.drawImage = (source: unknown) =>
        drawCalls.push({
          source,
          composite: context.globalCompositeOperation,
        });
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => context,
        context,
        drawCalls,
      };
      canvases.push(canvas);
      return canvas;
    },
  });
  const scene = {
    textures: {
      exists: (key: string) =>
        key === "theme-atmosphere-mask" ? atmosphereExists : key === "theme-sky-mask" && maskExists,
      get: (key: keyof typeof sources) => ({
        getSourceImage: () => sources[key],
      }),
      addCanvas: (key: string, canvas: MockCanvas) => {
        const texture = { key, canvas, refresh: vi.fn() };
        textures.push(texture);
        return texture;
      },
      remove: vi.fn(),
    },
    add: {
      image: () => {
        const image = {
          setOrigin: () => image,
          setDepth: () => image,
          setName: () => image,
          setPosition: () => image,
          setDisplaySize: () => image,
          destroy: vi.fn(),
        };
        images.push(image);
        return image;
      },
    },
    events: { once: vi.fn(), off: vi.fn() },
  };
  return { scene, textures, images, canvases, sources };
}

describe("canvas upload lifetime", () => {
  it("uploads live textures once per second while manual slider changes repaint immediately", () => {
    const { scene, textures } = sceneMock();
    const art = new DaylightArt(scene as any, "original", landscape);
    for (let frame = 0; frame < 60; frame++)
      art.update(state(10 + frame / 60 / 3600, "live"));
    textures.forEach((texture) =>
      expect(texture.refresh).toHaveBeenCalledTimes(1),
    );
    art.update(state(10 + 1.1 / 3600, "live"));
    textures.forEach((texture) =>
      expect(texture.refresh).toHaveBeenCalledTimes(2),
    );
    art.update(state(18, "manual"));
    art.update(state(18.1, "manual"));
    textures.forEach((texture) =>
      expect(texture.refresh).toHaveBeenCalledTimes(4),
    );
    art.update(state(18.1, "manual"));
    textures.forEach((texture) =>
      expect(texture.refresh).toHaveBeenCalledTimes(4),
    );
    expect(daylightRenderKey(state(24))).toBe(daylightRenderKey(state(0)));
  });

  it("keeps illustrated effects empty if the required sky mask is missing", () => {
    const { scene, textures } = sceneMock();
    const art = new DaylightArt(scene as any, "ramen", landscape);
    art.update(state(0));
    art.update(state(12));
    expect(textures).toHaveLength(1);
    expect(textures[0].refresh).not.toHaveBeenCalled();
  });

  it("uses the preloaded illustrated mask and releases its GPU textures on shutdown", () => {
    const { scene, textures, images } = sceneMock(true);
    const art = new DaylightArt(scene as any, "tower", tower);
    art.update(state(0));
    expect(textures).toHaveLength(1);
    expect(textures[0].refresh).toHaveBeenCalledTimes(1);
    art.destroy();
    expect(scene.events.off).toHaveBeenCalledWith("shutdown", art.destroy, art);
    expect(scene.textures.remove).toHaveBeenCalledWith(textures[0].key);
    expect(images[0].destroy).toHaveBeenCalledTimes(1);
    art.destroy();
    art.update(state(12));
    expect(images[0].destroy).toHaveBeenCalledTimes(1);
    expect(textures[0].refresh).toHaveBeenCalledTimes(1);
  });

  it("tints tower clouds through the atmosphere mask while celestial objects retain their own mask", () => {
    const { scene, textures, canvases, sources } = sceneMock(true, true);
    const art = new DaylightArt(scene as any, "tower", tower);
    art.update(state(18.5));
    const effects = textures[0].canvas;
    const sky = canvases.find((canvas) =>
      canvas.drawCalls.some(
        (call) => call.source === sources["theme-sky-mask"],
      ),
    )!;
    const atmosphere = canvases.find((canvas) =>
      canvas.drawCalls.some(
        (call) => call.source === sources["theme-atmosphere-mask"],
      ),
    )!;
    expect(atmosphere).not.toBe(sky);
    expect(atmosphere.drawCalls).toEqual([
      { source: sources["theme-atmosphere-mask"], composite: "destination-in" },
    ]);
    expect(effects.drawCalls.slice(-2)).toEqual([
      { source: sky, composite: "destination-in" },
      { source: atmosphere, composite: "destination-over" },
    ]);
    expect(atmosphere.context.fillRect).toHaveBeenCalled();
    const fills = (atmosphere.context.fillRect as ReturnType<typeof vi.fn>).mock
      .calls.length;
    art.update(state(12));
    expect(atmosphere.context.clearRect).toHaveBeenCalledTimes(2);
    expect(atmosphere.context.fillRect).toHaveBeenCalledTimes(fills);
    expect(effects.context.globalCompositeOperation).toBe("source-over");
    expect(atmosphere.context.globalCompositeOperation).toBe("source-over");
    art.destroy();
    expect(atmosphere.width).toBe(0);
    expect(atmosphere.height).toBe(0);
    // The borrowed asset remains owned by Phaser's texture manager.
    expect(sources["theme-atmosphere-mask"].width).toBe(tower.width);
    expect(scene.textures.remove).toHaveBeenCalledTimes(1);
  });

  it("reuses one tower atmosphere buffer and one GPU texture with live throttling and immediate manual changes", () => {
    const { scene, textures, images, canvases } = sceneMock(true, true);
    const art = new DaylightArt(scene as any, "tower", tower);
    const count = canvases.length;
    for (let frame = 0; frame < 60; frame++)
      art.update(state(6.5 + frame / 60 / 3600, "live"));
    expect(textures).toHaveLength(1);
    expect(textures[0].refresh).toHaveBeenCalledTimes(1);
    art.update(state(6.5 + 1.1 / 3600, "live"));
    art.update(state(18.5));
    art.update(state(18.75));
    expect(textures[0].refresh).toHaveBeenCalledTimes(4);
    expect(canvases).toHaveLength(count);
    art.destroy();
    art.destroy();
    art.update(state(0));
    expect(images[0].destroy).toHaveBeenCalledTimes(1);
    expect(textures[0].refresh).toHaveBeenCalledTimes(4);
  });

  it.each(["original", "cabin", "ramen"] as const)(
    "keeps %s on its existing single-mask rendering path even if a tower mask is present",
    (theme) => {
      const { scene, textures, canvases, sources } = sceneMock(true, true);
      const art = new DaylightArt(scene as any, theme, landscape);
      art.update(state(6.5));
      expect(
        canvases.some((canvas) =>
          canvas.drawCalls.some(
            (call) => call.source === sources["theme-atmosphere-mask"],
          ),
        ),
      ).toBe(false);
      const effects = textures.find((texture) =>
        texture.key.startsWith("daylight-sky"),
      )!.canvas;
      expect(effects.context.fillRect).toHaveBeenCalled();
      expect(
        effects.drawCalls.some((call) => call.composite === "destination-over"),
      ).toBe(false);
      art.destroy();
    },
  );
});

describe("window atmosphere mask", () => {
  it("follows blue sky and pale clouds without recoloring their wood and stone surrounds", () => {
    expect(windowSkyOpacity(91, 188, 229)).toBe(1);
    expect(windowSkyOpacity(211, 236, 249)).toBeGreaterThan(0.9);
    expect(windowSkyOpacity(136, 112, 74)).toBe(0);
    expect(windowSkyOpacity(208, 182, 133)).toBe(0);
    expect(windowSkyOpacity(18, 32, 39)).toBe(0);
  });
});
