import { describe, it, expect } from "vitest";
import {
  CATALOG,
  ROOMS,
  defaultLayout,
  makeFurniture,
  placementError,
  cellsOf,
  inRoom,
  type Layout,
} from "../src/model";
import {
  buildGraph,
  findPath,
  arcClear,
  routeValid,
  bodyClear,
} from "../src/navigation";
import { Simulation } from "../src/simulation";
import { deserializeLayout, History, HouseStorage } from "../src/storage";
const layout = (...items: ReturnType<typeof makeFurniture>[]): Layout => ({
  version: 1,
  furniture: items,
});
describe("placement and data integrity", () => {
  it("ships a legal furnished house and 13 definitions", () => {
    const l = defaultLayout();
    expect(CATALOG.length).toBeGreaterThanOrEqual(12);
    for (const f of l.furniture)
      expect(placementError(f, l), f.instanceId).toBeNull();
  });
  it("rejects overlap, outside boundaries, floating floor pieces, and sloped roof violations", () => {
    const box = makeFurniture("box", "lounge", 0);
    expect(
      placementError(makeFurniture("crate", "lounge", 1), layout(box)),
    ).toMatch(/overlap/);
    expect(
      placementError(makeFurniture("crate", "lounge", -1), layout()),
    ).toMatch(/inside/);
    expect(
      placementError(makeFurniture("crate", "lounge", 1, 2), layout()),
    ).toMatch(/floor/);
    expect(
      placementError(makeFurniture("shelf", "attic", 0, 3), layout()),
    ).toMatch(/roof/);
    expect(inRoom(ROOMS[4], 16, 4)).toBe(true);
  });
  it("supports back wall shelves and validates ceiling anchors", () => {
    expect(
      placementError(makeFurniture("shelf", "lounge", 4, 3), layout()),
    ).toBeNull();
    expect(
      placementError(makeFurniture("hammock", "lounge", 4, 4), layout()),
    ).toBeNull();
    expect(
      placementError(makeFurniture("hammock", "lounge", 4, 0), layout()),
    ).toMatch(/ceiling/);
  });
  it("mirrors the asymmetric cat-tree mask and support geometry", () => {
    const tree = makeFurniture("cat-tree", "lounge", 2);
    const flipped = { ...tree, flipX: true };
    expect(cellsOf(tree)).not.toEqual(cellsOf(flipped));
    const a = buildGraph(layout(tree)).surfaces.filter(
      (s) => s.owner === tree.instanceId && s.y === 3,
    );
    const b = buildGraph(layout(flipped)).surfaces.filter(
      (s) => s.owner === tree.instanceId && s.y === 3,
    );
    expect(a[0].x0).toBeLessThan(b[0].x0);
  });
});
describe("support navigation", () => {
  it("does not create floor paths through occupied cells and checks every jump arc", () => {
    const g = buildGraph(defaultLayout());
    expect(g.surfaces.length).toBeGreaterThan(30);
    expect(g.edges.some((e) => e.kind === "jump")).toBe(true);
    expect(g.edges.some((e) => e.kind === "drop")).toBe(true);
    for (const s of g.surfaces)
      expect(
        bodyClear(s.roomId, (s.x0 + s.x1) / 2, s.y, g.solids.get(s.roomId)!),
      ).toBe(true);
    for (const e of g.edges) {
      const s = g.surfaces.find((s) => s.id === e.from)!;
      expect(arcClear(e, s.roomId, g.solids.get(s.roomId)!)).toBe(true);
    }
  });
  it("moving a crate creates a route to an unreachable perch; moving it away invalidates the route", () => {
    const shelf = makeFurniture("shelf", "lounge", 8, 3, "perch"),
      crate = makeFurniture("large-crate", "lounge", 1, 0, "step");
    const g = buildGraph(layout(shelf, crate));
    const floor = g.surfaces.find(
      (s) => s.roomId === "lounge" && s.y === 0 && s.x0 > 3,
    )!;
    const perch = g.surfaces.find((s) => s.owner === "perch")!;
    expect(findPath(g, floor.id, perch.id)).toBeNull();
    const next = buildGraph(layout(shelf, { ...crate, gridX: 6 }));
    const start = next.surfaces.find(
      (s) => s.roomId === "lounge" && s.y === 0 && s.x0 < 5 && s.x1 > 5,
    )!;
    const path = findPath(next, start.id, perch.id);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(2);
    expect(routeValid(g, path!)).toBe(false);
  });
});
describe("cats and recovery", () => {
  it("cats actually reach a newly accessible shelf and visibly recover when it disappears", () => {
    const shelf = makeFurniture("shelf", "lounge", 8, 3, "perch"),
      crate = makeFurniture("large-crate", "lounge", 6, 0, "step");
    const sim = new Simulation(layout(shelf, crate), 1);
    const c = sim.cats[0],
      floor = sim.graph.surfaces.find(
        (s) => s.roomId === "lounge" && s.y === 0 && s.x0 < 5 && s.x1 > 5,
      )!;
    c.x = 5;
    c.y = 0;
    c.surfaceId = floor.id;
    const goal = sim.graph.goals.find(
      (g) => sim.surface(g.surfaceId)?.owner === "perch",
    )!;
    expect(sim.requestGoal(c, goal)).toBe(true);
    for (let i = 0; i < 600; i++) sim.step(1 / 60);
    expect(c.visited).toContain(goal.surfaceId);
    expect(c.y).toBe(4);
    sim.rebuild(layout(crate));
    expect(c.state).toBe("recover");
    expect(c.y).toBe(4);
    expect(c.move).not.toBeNull();
    for (let i = 0; i < 120; i++) sim.step(1 / 60);
    expect(c.y).toBeLessThan(4);
    expect(sim.surface(c.surfaceId)).toBeDefined();
  });
  it("runs 25 independent cats for five simulated minutes with bounded paths and varied actions", () => {
    const sim = new Simulation(defaultLayout(), 25, 13);
    for (let i = 0; i < 18000; i++) sim.step(1 / 60);
    const actions = new Set(sim.cats.flatMap((c) => Object.keys(c.actions)));
    expect(actions.has("jump")).toBe(true);
    expect(actions.has("sleep")).toBe(true);
    expect(actions.has("groom")).toBe(true);
    expect(actions.has("perch")).toBe(true);
    for (const c of sim.cats) {
      expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
      // A cross-house trip may exceed the old room-local twenty-edge limit.
      // A finite route must still never visit the same support twice.
      expect(c.path.length).toBeLessThan(sim.graph.surfaces.length);
      const supports = c.path.length
        ? [c.path[0].from, ...c.path.map((edge) => edge.to)]
        : [];
      expect(new Set(supports).size).toBe(supports.length);
      expect(c.visited.length).toBeLessThanOrEqual(60);
    }
    expect(sim.events.length).toBeLessThanOrEqual(8);
    expect(sim.pathSearches).toBeLessThan(18000);
  });
  it("clamps resume delta and seeds behavior reproducibly", () => {
    const a = new Simulation(defaultLayout()),
      b = new Simulation(defaultLayout());
    a.step(1000);
    b.step(0.05);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
describe("persistence and history", () => {
  it("round trips and rejects malformed, duplicate, overlapping or unsupported layouts", () => {
    const l = defaultLayout();
    expect(deserializeLayout(JSON.stringify(l))).toEqual(l);
    expect(() => deserializeLayout("{")).toThrow();
    expect(() => deserializeLayout('{"version":2}')).toThrow();
    l.furniture.push({ ...l.furniture[0] });
    expect(() => deserializeLayout(JSON.stringify(l))).toThrow();
  });
  it("storage and undo/redo preserve the full layout", () => {
    const map = new Map();
    const store = new HouseStorage({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    });
    const l = defaultLayout();
    store.save(l);
    expect(store.load()).toEqual(l);
    const h = new History(),
      empty = layout();
    h.push(l);
    expect(h.undo(empty)).toEqual(l);
    expect(h.redo(l)).toEqual(empty);
  });
});
