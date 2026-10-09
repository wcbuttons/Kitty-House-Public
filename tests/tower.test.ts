import { afterEach, expect, test, vi } from "vitest";
import type { ThemeId } from "../src/house-theme";

const data = new Map<string, string>();
const backend = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => {
    data.set(key, value);
  },
};

async function loadWorld(id: ThemeId = "tower") {
  data.set("little-house.theme.v1", id);
  vi.stubGlobal("window", { localStorage: backend });
  vi.stubGlobal("localStorage", backend);
  vi.resetModules();
  return {
    ...(await import("../src/house-theme")),
    ...(await import("../src/model")),
    ...(await import("../src/navigation")),
    ...(await import("../src/passages")),
    ...(await import("../src/cat-model")),
    ...(await import("../src/simulation")),
    ...(await import("../src/storage")),
    ...(await import("../src/layout-updates")),
  };
}

afterEach(() => {
  data.clear();
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("the portrait tower has five clear floors and its own twelve-piece furniture catalog", async () => {
  const world = await loadWorld();
  expect(world.ACTIVE_THEME.name).toBe("Moonwhisker Tower");
  expect(world.ACTIVE_THEME.defaultCatCount).toBe(8);
  expect(world.WORLD).toEqual({ width: 792, height: 1408 });
  expect(world.ROOMS.map((room) => [room.id, room.floor])).toEqual([
    ["vestibule", 1304],
    ["potions", 1084],
    ["library", 864],
    ["bedchamber", 644],
    ["observatory", 424],
  ]);
  for (const room of world.ROOMS) {
    expect(room.x).toBe(188);
    expect(room.width).toBe(16);
    expect(room.height).toBe(7);
    expect(room.x + room.width * world.CELL).toBeLessThan(world.WORLD.width);
    expect(room.floor).toBeLessThan(world.WORLD.height);
    expect(room.floor - room.height * world.CELL).toBeGreaterThan(0);
  }
  expect(world.CATALOG).toHaveLength(12);
  expect(world.CATALOG.every((item) => item.id.startsWith("tower-"))).toBe(
    true,
  );
  const chair = world.defById("tower-reading-chair");
  expect(chair.height).toBe(3);
  expect(chair.cells).toEqual([
    [0, 0],
    [1, 0],
  ]);
  expect(chair.surfaces.every((surface) => surface.y === 1)).toBe(true);
  const books = world.defById("tower-book-stack");
  expect(books.surfaces).toEqual([
    { x: 1, y: 2, width: 1, actions: ["sit", "perch"] },
  ]);
  for (const other of ["original", "cabin", "ramen"] as const) {
    const house = await loadWorld(other);
    expect(house.WORLD).toEqual({ width: 1120, height: 790 });
    expect(house.CATALOG.some((item) => item.id.startsWith("tower-"))).toBe(
      false,
    );
  }
});

test("every tower activity has a two-way route and all starting residents have clear support", async () => {
  const world = await loadWorld();
  const layout = world.defaultLayout();
  expect(layout.furniture).toHaveLength(15);
  expect(world.deserializeLayout(JSON.stringify(layout))).toEqual(layout);
  expect(new Set(layout.furniture.map((piece) => piece.definitionId))).toEqual(
    new Set(world.CATALOG.map((definition) => definition.id)),
  );
  const graph = world.buildGraph(layout);
  expect(graph.edges.filter((edge) => edge.passage)).toHaveLength(8);
  const firstFloor = graph.surfaces.find(
    (surface) => surface.roomId === "vestibule" && surface.y === 0,
  )!;
  for (const goal of graph.goals) {
    expect(
      world.findPath(graph, firstFloor.id, goal.surfaceId),
      `Reach ${goal.key}`,
    ).not.toBeNull();
    expect(
      world.findPath(graph, goal.surfaceId, firstFloor.id),
      `Leave ${goal.key}`,
    ).not.toBeNull();
  }
  const sim = new world.Simulation(layout, world.ACTIVE_THEME.defaultCatCount);
  expect(sim.cats).toHaveLength(8);
  expect(world.validateRoster(sim.roster())).toEqual(sim.roster());
  for (const cat of sim.cats) {
    expect(
      world.bodyClear(cat.roomId, cat.x, cat.y, graph.solids.get(cat.roomId)!),
    ).toBe(true);
    expect(cat.homeRoomId).toBe(cat.roomId);
  }
  const crystal = layout.furniture.find(
    (piece) => piece.definitionId === "tower-crystal-plinth",
  )!;
  expect(
    graph.surfaces.some((surface) => surface.owner === crystal.instanceId),
  ).toBe(false);
});

test("a cat traverses all five tower floors and returns continuously to its saved home", async () => {
  const world = await loadWorld();
  const sim = new world.Simulation(world.defaultLayout(), 1, 61);
  const cat = sim.cats[0];
  const profile = sim.roster()[0];
  let climbingFrames = 0;
  for (const room of [
    "potions",
    "library",
    "bedchamber",
    "observatory",
    "vestibule",
  ]) {
    const goal = sim.graph.goals.find(
      (goal) =>
        sim.surface(goal.surfaceId)?.roomId === room && goal.action === "sit",
    )!;
    expect(sim.requestGoal(cat, goal)).toBe(true);
    for (let frame = 0; frame < 18000 && cat.state !== "sit"; frame++) {
      const before = world.worldPoint(world.roomById(cat.roomId), cat.x, cat.y);
      sim.step(1 / 60);
      const after = world.worldPoint(world.roomById(cat.roomId), cat.x, cat.y);
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(
        12,
      );
      expect(cat.goal).toEqual(goal);
      if (cat.move?.passage) {
        expect(cat.state).toBe("climb");
        expect(world.passageSegmentClear(cat.move, sim.graph.solids)).toBe(
          true,
        );
        climbingFrames++;
      } else {
        expect(
          world.bodyClear(
            cat.roomId,
            cat.x,
            cat.y,
            sim.graph.solids.get(cat.roomId)!,
          ),
        ).toBe(true);
      }
    }
    expect(cat.roomId).toBe(room);
    expect(cat.state).toBe("sit");
    expect(cat.x).toBeCloseTo(goal.x);
    expect(sim.roster()[0]).toEqual(profile);
  }
  expect(new Set(cat.visitedRooms)).toEqual(
    new Set(world.ROOMS.map((room) => room.id)),
  );
  expect(climbingFrames).toBeGreaterThan(480);
  expect(cat.homeRoomId).toBe("vestibule");
  expect(cat.awayFor).toBe(0);
  expect(sim.recoveries).toBe(0);
});

test("a blocked tower ladder closes in both directions and reopens after its furniture is removed", async () => {
  const world = await loadWorld();
  const empty = { version: 1 as const, furniture: [] };
  const graph = world.buildGraph(empty);
  for (const passage of world.PASSAGES) {
    const blocker = world.makeFurniture(
      "tower-star-cushion",
      passage.a.roomId,
      Math.floor(passage.a.x),
      0,
      "landing-blocker",
    );
    const layout = { ...empty, furniture: [blocker] };
    expect(world.placementError(blocker, layout)).toBeNull();
    const blocked = world.updateGraph(graph, empty, layout);
    expect(
      blocked.edges.filter((edge) => edge.passage?.id === passage.id),
    ).toHaveLength(0);
    expect(
      graph.edges.filter((edge) => edge.passage?.id === passage.id),
    ).toHaveLength(2);
    const restored = world.updateGraph(blocked, layout, empty);
    expect(
      restored.edges.filter((edge) => edge.passage?.id === passage.id),
    ).toHaveLength(2);
  }
});

test("tower saves and home assignments stay separate from older houses without a default migration", async () => {
  const original = await loadWorld("original");
  const oldLayout = original.defaultLayout();
  const oldCats = new original.Simulation(oldLayout, 4).roster();
  new original.HouseStorage(backend).save(oldLayout);
  new original.CatStorage(backend).save(oldCats);
  const layoutBytes = data.get(original.STORAGE_KEY);
  const catBytes = data.get(original.CAT_STORAGE_KEY);
  const tower = await loadWorld();
  expect(new tower.HouseStorage(backend).load()).toBeNull();
  expect(new tower.CatStorage(backend).load()).toBeNull();
  const layout = tower.defaultLayout();
  const sim = new tower.Simulation(layout, 8);
  sim.replaceRoster(
    sim
      .roster()
      .map((cat, index) =>
        index === 0 ? { ...cat, roomId: "observatory" } : cat,
      ),
  );
  expect(tower.refreshDefaultLayout(layout)).toBe(layout);
  layout.furniture[0].gridX = 4;
  expect(tower.refreshDefaultLayout(layout)).toBe(layout);
  new tower.HouseStorage(backend).save(layout);
  new tower.CatStorage(backend).save(sim.roster());
  expect(tower.STORAGE_KEY).toBe("little-house.layout.v1.tower");
  expect(tower.CAT_STORAGE_KEY).toBe("little-house.cats.v1.tower");
  expect(new tower.HouseStorage(backend).load()).toEqual(layout);
  expect(new tower.CatStorage(backend).load()![0].roomId).toBe("observatory");
  expect(data.get(original.STORAGE_KEY)).toBe(layoutBytes);
  expect(data.get(original.CAT_STORAGE_KEY)).toBe(catBytes);
});
