import { afterEach, expect, test, vi } from "vitest";
import type { ThemeId } from "../src/house-theme";

const data = new Map<string, string>();
const backend = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => {
    data.set(key, value);
  },
};

async function loadTheme(id: ThemeId) {
  backend.setItem("little-house.theme.v1", id);
  vi.stubGlobal("window", { localStorage: backend });
  vi.stubGlobal("localStorage", backend);
  vi.resetModules();
  const theme = await import("../src/house-theme");
  const model = await import("../src/model");
  const navigation = await import("../src/navigation");
  const passages = await import("../src/passages");
  const storage = await import("../src/storage");
  const { Simulation } = await import("../src/simulation");
  return {
    ...theme,
    ...model,
    ...navigation,
    ...passages,
    ...storage,
    Simulation,
  };
}

afterEach(() => {
  data.clear();
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("theme preferences fall back safely and preserve the original storage names", async () => {
  const { readActiveTheme, setActiveTheme, themeStorageKey, ACTIVE_THEME } =
    await loadTheme("original");
  expect(ACTIVE_THEME.id).toBe("original");
  expect(readActiveTheme({ getItem: () => "removed-style" }).id).toBe(
    "original",
  );
  expect(
    readActiveTheme({
      getItem: () => {
        throw Error("Storage blocked");
      },
    }).id,
  ).toBe("original");
  expect(themeStorageKey("little-house.layout.v1", "original")).toBe(
    "little-house.layout.v1",
  );
  expect(themeStorageKey("little-house.cats.v1", "original")).toBe(
    "little-house.cats.v1",
  );
  setActiveTheme("cabin", backend);
  expect(readActiveTheme(backend).id).toBe("cabin");
  expect(ACTIVE_THEME.id).toBe("original"); // The world changes only after a reload.
  expect(() => setActiveTheme("missing" as ThemeId, backend)).toThrow(
    "Unknown house style",
  );
  expect(() =>
    setActiveTheme("ramen", {
      ...backend,
      setItem: () => {
        throw Error("Storage full");
      },
    }),
  ).toThrow("Storage full");
});

test("each house keeps its own furniture and residents without changing the original save", async () => {
  const saved = new Map<ThemeId, { layout: string; cats: string }>();
  for (const id of ["original", "cabin", "ramen"] as const) {
    const world = await loadTheme(id);
    const layout = world.defaultLayout();
    if (id !== "original") layout.furniture.pop();
    const sim = new world.Simulation(
      layout,
      world.ACTIVE_THEME.defaultCatCount,
    );
    new world.HouseStorage(backend).save(layout);
    new world.CatStorage(backend).save(sim.roster());
    saved.set(id, {
      layout: data.get(world.STORAGE_KEY)!,
      cats: data.get(world.CAT_STORAGE_KEY)!,
    });
    for (const [savedId, values] of saved) {
      expect(
        data.get(world.themeStorageKey("little-house.layout.v1", savedId)),
      ).toBe(values.layout);
      expect(
        data.get(world.themeStorageKey("little-house.cats.v1", savedId)),
      ).toBe(values.cats);
    }
  }
  for (const [id, values] of saved) {
    const world = await loadTheme(id);
    expect(new world.HouseStorage(backend).load()).toEqual(
      JSON.parse(values.layout),
    );
    expect(new world.CatStorage(backend).load()).toEqual(
      JSON.parse(values.cats).cats,
    );
  }
});

test.each(["original", "cabin", "ramen"] as const)(
  "%s defaults have valid furniture, clear residents, and two-way routes through every room",
  async (id) => {
    const world = await loadTheme(id);
    const layout = world.defaultLayout();
    expect(world.deserializeLayout(JSON.stringify(layout))).toEqual(layout);
    const graph = world.buildGraph(layout);
    expect(graph.edges.filter((edge) => edge.kind === "passage")).toHaveLength(
      world.PASSAGES.length * 2,
    );
    const firstFloor = graph.surfaces.find(
      (surface) => !surface.owner && surface.y === 0,
    )!;
    for (const goal of graph.goals) {
      expect(
        world.findPath(graph, firstFloor.id, goal.surfaceId),
        `${id}: reach ${goal.key}`,
      ).not.toBeNull();
      expect(
        world.findPath(graph, goal.surfaceId, firstFloor.id),
        `${id}: leave ${goal.key}`,
      ).not.toBeNull();
    }
    for (const room of world.ROOMS) {
      const start = graph.surfaces.find(
        (surface) => surface.roomId === room.id && surface.y === 0,
      )!;
      const reachable = world.reachableSurfaces(graph, start.id);
      const reachableRooms = new Set(
        graph.surfaces
          .filter((surface) => reachable.has(surface.id))
          .map((surface) => surface.roomId),
      );
      expect(reachableRooms, `Routes starting in ${room.name}`).toEqual(
        new Set(world.ROOMS.map((room) => room.id)),
      );
    }
    const sim = new world.Simulation(
      layout,
      world.ACTIVE_THEME.defaultCatCount,
    );
    expect(sim.cats).toHaveLength(world.ACTIVE_THEME.defaultCatCount);
    for (const cat of sim.cats) {
      expect(
        world.bodyClear(
          cat.roomId,
          cat.x,
          cat.y,
          graph.solids.get(cat.roomId)!,
        ),
      ).toBe(true);
    }
  },
);

test("the ramen shop adds its own usable furniture without expanding the original catalog", async () => {
  const original = await loadTheme("original");
  const originalIds = original.CATALOG.map((definition) => definition.id);
  expect(originalIds).toHaveLength(28);
  const ramen = await loadTheme("ramen");
  const additions = ramen.CATALOG.filter(
    (definition) => !originalIds.includes(definition.id),
  );
  expect(additions.map((definition) => definition.id)).toEqual([
    "ramen-counter",
    "ramen-stool",
    "bowl-rack",
    "futon",
    "noodle-table",
    "planter",
  ]);
  const layout = ramen.defaultLayout();
  const graph = ramen.buildGraph(layout);
  const start = graph.surfaces.find(
    (surface) => surface.roomId === "shop" && surface.y === 0,
  )!;
  const reachable = ramen.reachableSurfaces(graph, start.id);
  for (const definition of additions) {
    const instances = layout.furniture.filter(
      (item) => item.definitionId === definition.id,
    );
    expect(
      instances.length,
      `${definition.name} appears in the starting shop`,
    ).toBeGreaterThan(0);
    for (const instance of instances) {
      if (!definition.surfaces.length) {
        expect(
          graph.goals.some(
            (goal) =>
              graph.surfaces.find((surface) => surface.id === goal.surfaceId)
                ?.owner === instance.instanceId,
          ),
        ).toBe(false);
        continue;
      }
      expect(
        graph.surfaces.some(
          (surface) =>
            surface.owner === instance.instanceId && reachable.has(surface.id),
        ),
        `${definition.name} can be reached by a cat`,
      ).toBe(true);
    }
  }
});

test("ceiling furniture fits indoor rooms and is rejected on the open rooftop", async () => {
  const world = await loadTheme("ramen");
  for (const room of world.ROOMS.filter((room) => !room.outdoor)) {
    const hammock = world.makeFurniture("hammock", room.id, 7, room.height - 3);
    expect(
      world.placementError(hammock, { version: 1, furniture: [hammock] }),
    ).toBeNull();
  }
  const rooftop = world.roomById("terrace");
  const hammock = world.makeFurniture(
    "hammock",
    rooftop.id,
    3,
    rooftop.height - 3,
  );
  expect(
    world.placementError(hammock, { version: 1, furniture: [hammock] }),
  ).toBe("This space has no ceiling");
});
