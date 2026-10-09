import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test, vi } from "vitest";
import type { ThemeId } from "../src/house-theme";
import type { FurnitureDef } from "../src/model";

const V2 = ["cabin-v2", "ramen-v2"] as const;
const data = new Map<string, string>();
const backend = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => { data.set(key, value); },
};

async function loadWorld(id: ThemeId) {
  data.set("little-house.theme.v1", id);
  vi.stubGlobal("window", { localStorage: backend });
  vi.stubGlobal("localStorage", backend);
  vi.resetModules();
  return {
    ...(await import("../src/house-theme")),
    ...(await import("../src/model")),
    ...(await import("../src/view-frame")),
    ...(await import("../src/navigation")),
    ...(await import("../src/passages")),
    ...(await import("../src/storage")),
    ...(await import("../src/layout-updates")),
    ...(await import("../src/cat-model")),
    ...(await import("../src/simulation")),
  };
}

afterEach(() => {
  data.clear();
  vi.unstubAllGlobals();
  vi.resetModules();
});

test.each(V2)("%s has an independent, valid catalog and defaults with real support for every advertised perch", async (id) => {
  const world = await loadWorld(id);
  expect(world.WORLD).toEqual({ width: 1408, height: 792 });
  expect(world.VIEW_FRAME).toEqual({ x: 0, y: 0, width: 1408, height: 792 });
  expect(world.ROOMS).toHaveLength(3);
  expect(world.CATALOG.length).toBeGreaterThanOrEqual(10);
  expect(world.CATALOG.every((item) => item.id.startsWith(`${id}-`))).toBe(true);
  expect(new Set(world.CATALOG.map((item) => item.id)).size).toBe(world.CATALOG.length);
  for (const room of world.ROOMS) {
    expect(room.x).toBeGreaterThanOrEqual(0);
    expect(room.x + room.width * world.CELL).toBeLessThanOrEqual(world.WORLD.width);
    expect(room.floor).toBeLessThanOrEqual(world.WORLD.height);
    expect(room.floor - room.height * world.CELL).toBeGreaterThanOrEqual(0);
  }
  const layout = world.defaultLayout();
  expect(layout.furniture.length).toBeGreaterThanOrEqual(14);
  for (const piece of layout.furniture)
    expect(world.placementError(piece, layout), `${id}: ${piece.definitionId} default placement`).toBeNull();
  expect(world.deserializeLayout(JSON.stringify(layout))).toEqual(layout);
  const graph = world.buildGraph(layout);
  const firstFloor = graph.surfaces.find((surface) => !surface.owner && surface.y === 0)!;
  expect(firstFloor).toBeDefined();
  expect(graph.edges.filter((edge) => edge.passage)).toHaveLength(world.PASSAGES.length * 2);
  for (const piece of layout.furniture) {
    const definition = world.defById(piece.definitionId);
    for (const [index, expected] of definition.surfaces.entries()) {
      const surfaces = graph.surfaces.filter((surface) =>
        surface.owner === piece.instanceId && surface.id.startsWith(`${piece.instanceId}:${index}:`));
      expect(surfaces.length, `${definition.id} keeps its advertised surface ${index}`).toBeGreaterThan(0);
      for (const surface of surfaces) {
        expect(surface.y).toBeCloseTo(piece.gridY + expected.y);
        expect(surface.x0).toBeGreaterThanOrEqual(piece.gridX);
        expect(surface.x1).toBeLessThanOrEqual(piece.gridX + definition.width + 1e-7);
        expect(world.findPath(graph, firstFloor.id, surface.id), `Reach ${definition.id}`).not.toBeNull();
        expect(world.findPath(graph, surface.id, firstFloor.id), `Leave ${definition.id}`).not.toBeNull();
      }
    }
  }
  for (const goal of graph.goals) {
    expect(world.findPath(graph, firstFloor.id, goal.surfaceId), `${id}: reach ${goal.key}`).not.toBeNull();
    expect(world.findPath(graph, goal.surfaceId, firstFloor.id), `${id}: leave ${goal.key}`).not.toBeNull();
  }
  const sim = new world.Simulation(layout, world.ACTIVE_THEME.defaultCatCount, 43);
  expect(world.validateRoster(sim.roster())).toEqual(sim.roster());
  for (const cat of sim.cats) {
    expect(world.bodyClear(cat.roomId, cat.x, cat.y, graph.solids.get(cat.roomId)!)).toBe(true);
    expect(sim.surface(cat.surfaceId)?.y).toBeCloseTo(cat.y);
  }
});

test("the cabin ladder clears the fireplace and connects both furnished floors", async () => {
  const world = await loadWorld("cabin-v2");
  const graph = world.buildGraph(world.defaultLayout());
  const edges = graph.edges.filter((edge) => edge.passage?.id === "cedar-ladder");
  expect(edges).toHaveLength(2);
  expect(new Set(edges.map((edge) => edge.passage!.fromRoomId))).toEqual(new Set(["hearth", "loft"]));
  for (const edge of edges) {
    expect(world.passageWorldPoint(edge, 0)).toEqual({
      x: 338,
      y: edge.passage!.fromRoomId === "hearth" ? 682 : 422,
    });
    expect(world.passageWorldPoint(edge, 1)).toEqual({
      x: 338,
      y: edge.passage!.toRoomId === "hearth" ? 682 : 422,
    });
    expect(world.passageClear(edge, graph.solids)).toBe(true);
    const first = graph.surfaces.find((surface) =>
      surface.roomId === edge.passage!.fromRoomId && !surface.owner && surface.y === 0)!;
    const last = graph.surfaces.find((surface) =>
      surface.roomId === edge.passage!.toRoomId && !surface.owner && surface.y === 0)!;
    const path = world.findPath(graph, first.id, last.id);
    expect(path?.some((step) => step.passage?.id === "cedar-ladder")).toBe(true);
  }
});

test.each(V2)("%s cats can visit every room and return without teleporting or losing support", async (id) => {
  const world = await loadWorld(id);
  const sim = new world.Simulation(world.defaultLayout(), 1, 61);
  const cat = sim.cats[0];
  const home = cat.homeRoomId;
  const rooms = [...world.ROOMS.filter((room) => room.id !== home), world.roomById(home)];
  const visitedPassages = new Set<string>();
  for (const room of rooms) {
    const candidates = sim.graph.goals.filter((goal) =>
      sim.surface(goal.surfaceId)?.roomId === room.id && goal.action === "sit");
    const goal = candidates.find((goal) => sim.requestGoal(cat, goal));
    expect(goal, `Request a route into ${room.name}`).toBeDefined();
    for (let frame = 0; frame < 14400 && !(cat.roomId === room.id && cat.state === "sit"); frame++) {
      const before = world.worldPoint(world.roomById(cat.roomId), cat.x, cat.y);
      sim.step(1 / 60);
      const after = world.worldPoint(world.roomById(cat.roomId), cat.x, cat.y);
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(12);
      if (cat.move?.passage) {
        visitedPassages.add(cat.move.passage.id);
        expect(world.passageSegmentClear(cat.move, sim.graph.solids)).toBe(true);
      } else {
        expect(world.bodyClear(cat.roomId, cat.x, cat.y, sim.graph.solids.get(cat.roomId)!)).toBe(true);
      }
    }
    expect(cat.roomId).toBe(room.id);
    expect(cat.state).toBe("sit");
    expect(cat.x).toBeCloseTo(goal!.x);
    expect(cat.y).toBeCloseTo(sim.surface(goal!.surfaceId)!.y);
  }
  expect(visitedPassages.size).toBe(world.PASSAGES.length);
  expect(cat.homeRoomId).toBe(home);
  expect(sim.recoveries).toBe(0);
});

test("V2 saves never overwrite or migrate legacy homes, and catalogs remain disjoint", async () => {
  const saved = new Map<ThemeId, { layout: string; cats: string; ids: string[] }>();
  for (const id of ["original", "cabin", "ramen", "tower", ...V2] as const) {
    const world = await loadWorld(id);
    expect(new world.HouseStorage(backend).load()).toBeNull();
    const layout = world.defaultLayout();
    layout.furniture.pop();
    if (id.endsWith("-v2")) expect(world.refreshDefaultLayout(layout)).toBe(layout);
    const sim = new world.Simulation(layout, 3, 53);
    new world.HouseStorage(backend).save(layout);
    new world.CatStorage(backend).save(sim.roster());
    saved.set(id, {
      layout: data.get(world.STORAGE_KEY)!, cats: data.get(world.CAT_STORAGE_KEY)!,
      ids: world.CATALOG.map((item) => item.id),
    });
  }
  for (const [id, expected] of saved) {
    const world = await loadWorld(id);
    expect(new world.HouseStorage(backend).load()).toEqual(JSON.parse(expected.layout));
    expect(new world.CatStorage(backend).load()).toEqual(JSON.parse(expected.cats).cats);
    if (id.endsWith("-v2")) {
      expect(world.STORAGE_KEY).toBe(`little-house.layout.v1.${id}`);
      expect(world.CAT_STORAGE_KEY).toBe(`little-house.cats.v1.${id}`);
      for (const [otherId, other] of saved)
        if (otherId !== id) expect(expected.ids.some((item) => other.ids.includes(item))).toBe(false);
    }
  }
});

test.each(V2)("%s keeps chair backs clear of editor overlap while leaving their inset seats navigable", async (id) => {
  const world = await loadWorld(id);
  const room = world.ROOMS.find((room) => !room.outdoor)!;
  const chairDefinition = world.CATALOG.find((item) =>
    item.art === "couch" && item.cells && item.surfaces.some((surface) => surface.y < item.height))!;
  const shelfDefinition = world.CATALOG.find((item) => item.art === "shelf")!;
  expect(chairDefinition).toBeDefined();
  const chair = world.makeFurniture(chairDefinition.id, room.id, 6, 0, "chair");
  const shelf = world.makeFurniture(shelfDefinition.id, room.id, 6, 1, "shelf");
  expect(world.placementError(shelf, { version: 1, furniture: [chair, shelf] })).toBe("Furniture cannot overlap");
  const graph = world.buildGraph({ version: 1, furniture: [chair] });
  expect(graph.surfaces.some((surface) => surface.owner === chair.instanceId)).toBe(true);
});

test("asymmetric visual occupancy mirrors with a flipped piece independently of its navigation cells", async () => {
  const world = await loadWorld("cabin-v2");
  const definition: FurnitureDef = {
    id: "qa-offset-back", name: "QA offset back", category: "Comfort", art: "couch",
    width: 3, height: 2, anchor: "floor", color: 0xffffff, canFlip: true,
    cells: [[0, 0]], placementCells: [[0, 0], [0, 1]], surfaces: [], description: "Test silhouette",
  };
  const obstacle: FurnitureDef = {
    ...definition, id: "qa-wall-block", name: "QA wall block", width: 1, height: 1,
    anchor: "wall", cells: [[0, 0]], placementCells: [[0, 0]],
  };
  world.CATALOG.push(definition, obstacle);
  const room = world.ROOMS[0];
  const piece = world.makeFurniture(definition.id, room.id, 6, 0, "offset");
  const wall = world.makeFurniture(obstacle.id, room.id, 6, 1, "wall");
  const layout = { version: 1 as const, furniture: [piece, wall] };
  expect(world.placementError(piece, layout)).toBe("Furniture cannot overlap");
  piece.flipX = true;
  expect(world.placementError(piece, layout)).toBeNull();
  expect(world.cellsOf(piece)).toEqual([[8, 0]]);
  wall.gridX = 8;
  expect(world.placementError(piece, layout)).toBe("Furniture cannot overlap");
});

test("fractional furniture surfaces retain their final clear interval without extending through a blocker", async () => {
  const world = await loadWorld("cabin-v2");
  const definition: FurnitureDef = {
    id: "qa-fractional-shelf", name: "QA shelf", category: "Climbing", art: "shelf",
    width: 3, height: 1, anchor: "wall", color: 0xffffff, canFlip: true,
    cells: [[0, 0]], surfaces: [{ x: 0.05, y: 1, width: 2.9, actions: ["sit"] }], description: "Test ledge",
  };
  const blocker: FurnitureDef = {
    ...definition, id: "qa-blocker", name: "QA blocker", width: 1, height: 3,
    anchor: "floor", cells: [[0, 0], [0, 1], [0, 2]], surfaces: [],
  };
  world.CATALOG.push(definition, blocker);
  const room = world.ROOMS[0];
  for (const width of [0.9, 2.9]) {
    definition.surfaces[0].width = width;
    const shelf = world.makeFurniture(definition.id, room.id, 4, 1, "fractional");
    const graph = world.buildGraph({ version: 1, furniture: [shelf] });
    const surface = graph.surfaces.find((surface) => surface.owner === shelf.instanceId)!;
    expect(surface, `Keep a ${width}-cell platform`).toBeDefined();
    expect(surface.x0).toBeCloseTo(4.05);
    expect(surface.x1).toBeCloseTo(4.05 + width);
  }
  const shelf = world.makeFurniture(definition.id, room.id, 4, 1, "fractional");
  const obstacle = world.makeFurniture(blocker.id, room.id, 6, 0, "overhang");
  const layout = { version: 1 as const, furniture: [shelf, obstacle] };
  for (const piece of layout.furniture) expect(world.placementError(piece, layout)).toBeNull();
  const graph = world.buildGraph(layout);
  const surfaces = graph.surfaces.filter((surface) => surface.owner === shelf.instanceId);
  expect(surfaces.length).toBeGreaterThan(0);
  for (const surface of surfaces) {
    expect(surface.x1).toBeLessThanOrEqual(obstacle.gridX);
    for (let x = surface.x0 + 0.25; x <= surface.x1 - 0.25; x += 0.25)
      expect(world.bodyClear(room.id, x, surface.y, graph.solids.get(room.id)!)).toBe(true);
  }
});

test.each(V2)("%s ships new background and furniture bytes in dedicated asset paths", async (id) => {
  const world = await loadWorld(id);
  const root = fileURLToPath(new URL("../public/assets/houses/", import.meta.url));
  const digest = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  const legacy = new Set<string>();
  for (const home of ["cabin", "ramen", "tower"])
    for (const file of readdirSync(`${root}/${home}`))
      if (file.endsWith(".png")) legacy.add(digest(`${root}/${home}/${file}`));
  for (const file of readdirSync(`${root}/furniture`))
    if (file.endsWith(".png") && !V2.some((theme) => file.startsWith(`${theme}-`)))
      legacy.add(digest(`${root}/furniture/${file}`));
  const files = [
    `${id}/background-day.png`, `${id}/background-night.png`,
    ...world.CATALOG.map((item) => `furniture/${item.id}.png`),
  ];
  const hashes: string[] = [];
  for (const file of files) {
    const bytes = readFileSync(`${root}/${file}`);
    expect(bytes.subarray(0, 8).toString("hex"), `${file} is a PNG`).toBe("89504e470d0a1a0a");
    const hash = digest(`${root}/${file}`);
    expect(legacy.has(hash), `${file} must not reuse an existing asset`).toBe(false);
    hashes.push(hash);
    if (file.includes("background-")) {
      expect(bytes.readUInt32BE(16)).toBe(1408);
      expect(bytes.readUInt32BE(20)).toBe(792);
    }
  }
  expect(new Set(hashes).size).toBe(files.length);
});
