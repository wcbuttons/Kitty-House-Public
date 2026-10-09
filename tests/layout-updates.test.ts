import { afterEach, expect, test, vi } from "vitest";
import previousDefaults from "../src/default-layouts-v0.9.0.json";
import v2PreviousDefaults from "../src/default-layouts-v0.9.4.3.json";

const historicalDefaults = { ...previousDefaults, ...v2PreviousDefaults };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test.each(["original", "cabin", "ramen", "ramen-v2"] as const)(
  "%s refreshes only the complete untouched milestone layout, leaving saved customizations intact",
  async (theme) => {
    vi.stubGlobal("window", { localStorage: { getItem: () => theme } });
    vi.resetModules();
    const { defaultLayout } = await import("../src/model");
    const { refreshDefaultLayout } = await import("../src/layout-updates");
    const previous = {
      version: 1 as const,
      furniture: historicalDefaults[theme].map(
        ([definitionId, roomId, gridX, gridY = 0], index) => ({
          instanceId: `demo-${index}`,
          definitionId: String(definitionId),
          roomId: String(roomId),
          gridX: Number(gridX),
          gridY: Number(gridY),
          flipX: false,
        }),
      ),
    };
    const originalBytes = JSON.stringify(previous);
    expect(refreshDefaultLayout(previous)).toEqual(defaultLayout());
    expect(JSON.stringify(previous)).toBe(originalBytes);
    const moved = structuredClone(previous);
    moved.furniture[0].gridX++;
    expect(refreshDefaultLayout(moved)).toBe(moved);
    const removed = structuredClone(previous);
    removed.furniture.pop();
    expect(refreshDefaultLayout(removed)).toBe(removed);
    const flipped = structuredClone(previous);
    flipped.furniture[0].flipX = true;
    expect(refreshDefaultLayout(flipped)).toBe(flipped);
    const replaced = structuredClone(previous);
    replaced.furniture[0].instanceId = "my-own-piece";
    expect(refreshDefaultLayout(replaced)).toBe(replaced);
    expect(refreshDefaultLayout(defaultLayout())).toEqual(defaultLayout());
  },
);
