import { findPath } from "../src/navigation";
import { expect, test } from "vitest";
import { defaultLayout, makeFurniture, type Layout } from "../src/model";
import { Simulation } from "../src/simulation";
const l = (...f: ReturnType<typeof makeFurniture>[]): Layout => ({
  version: 1,
  furniture: f,
});
test("an edit preserves unchanged rooms and cats on an unchanged floor position", () => {
  const before = defaultLayout(),
    sim = new Simulation(before, 1);
  const c = sim.cats[0];
  const floor = sim.graph.surfaces.find(
    (s) => s.roomId === "lounge" && s.y === 0 && s.x0 > 4 && s.x1 < 8,
  )!;
  c.surfaceId = floor.id;
  c.x = 6;
  c.y = 0;
  c.state = "idle";
  c.timer = 5;
  const untouched = sim.graph.surfaces.filter((s) => s.roomId === "attic");
  const after = structuredClone(before);
  after.furniture.find(
    (f) => f.definitionId === "table" && f.roomId === "lounge",
  )!.gridX = 12;
  sim.rebuild(after);
  expect(c.x).toBe(6);
  expect(c.y).toBe(0);
  expect(c.state).toBe("idle");
  expect(sim.recoveries).toBe(0);
  expect(sim.graph.surfaces.find((s) => s.id === untouched[0].id)).toBe(
    untouched[0],
  );
});
test("moving a targeted piece during a jump cancels the stale trajectory and recovers", () => {
  const crate = makeFurniture("large-crate", "lounge", 6, 0, "step");
  const sim = new Simulation(l(crate), 1),
    c = sim.cats[0];
  const s = sim.graph.surfaces.find(
    (s) => s.roomId === "lounge" && s.y === 0 && s.x1 < 7,
  )!;
  c.x = 5;
  c.y = 0;
  c.surfaceId = s.id;
  const goal = sim.graph.goals.find(
    (g) => sim.surface(g.surfaceId)?.owner === "step",
  )!;
  expect(sim.requestGoal(c, goal)).toBe(true);
  for (let i = 0; i < 600 && !c.move; i++) sim.step(1 / 60);
  expect(c.move).not.toBeNull();
  for (let i = 0; i < 20; i++) sim.step(1 / 60);
  sim.rebuild(l({ ...crate, gridX: 12 }));
  expect(c.state).toBe("recover");
  expect(c.goal).toBeNull();
  expect(c.path).toEqual([]);
  for (let i = 0; i < 120; i++) sim.step(1 / 60);
  expect(Number.isFinite(c.x)).toBe(true);
  expect(sim.surface(c.surfaceId)).toBeDefined();
});
test("semantic spots are reserved and cannot be claimed twice", () => {
  const sim = new Simulation(defaultLayout(), 12);
  const a = sim.cats[0],
    b = sim.cats[5];
  const goal = sim.graph.goals.find((g) => g.surfaceId === a.surfaceId)!;
  expect(sim.requestGoal(a, goal)).toBe(true);
  expect(sim.requestGoal(b, goal)).toBe(false);
});
test("explicit goals replace existing idle delay", () => {
  const sim = new Simulation(defaultLayout(), 1),
    c = sim.cats[0];
  c.timer = 999;
  const goal = sim.graph.goals.find((g) => g.surfaceId === c.surfaceId)!;
  expect(sim.requestGoal(c, goal)).toBe(true);
  expect(c.timer).toBe(0);
});

test("every default cat has an elevated destination, and the cat tree top can be reached from its lowest platform", () => {
  const sim = new Simulation(defaultLayout(), 25);
  for (const c of sim.cats) {
    const reachable = sim.graph.surfaces.filter(
      (s) =>
        s.roomId === c.roomId &&
        s.owner &&
        findPath(sim.graph, c.surfaceId, s.id) !== null,
    );
    expect(reachable.length, `${c.name}: ${c.surfaceId}`).toBeGreaterThan(0);
  }
  const tree = sim.layout.furniture.find((f) => f.definitionId === "cat-tree")!;
  const low = sim.graph.surfaces.find(
    (s) => s.owner === tree.instanceId && s.y === 1,
  )!;
  const high = sim.graph.surfaces.find(
    (s) => s.owner === tree.instanceId && s.y === 5,
  )!;
  expect(findPath(sim.graph, low.id, high.id)).not.toBeNull();
});
