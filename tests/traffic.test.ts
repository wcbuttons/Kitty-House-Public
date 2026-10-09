import { expect, test } from "vitest";
import { makeFurniture, type Action, type Layout } from "../src/model";
import { bodyClear } from "../src/navigation";
import { Simulation, type Cat } from "../src/simulation";

const couch: Layout = {
  version: 1,
  furniture: [makeFurniture("couch", "lounge", 4, 0, "couch")],
};

function advanceToArrival(sim: Simulation, cat: Cat) {
  const goal = cat.goal!;
  for (let frame = 0; frame < 1200 && cat.state === "walk"; frame++) {
    sim.step(1 / 60);
    expect(cat.goal).toEqual(goal);
    expect(
      bodyClear(cat.roomId, cat.x, cat.y, sim.graph.solids.get(cat.roomId)!),
    ).toBe(true);
  }
  expect(cat.state).toBe(goal.action);
  expect(cat.x).toBeCloseTo(goal.x);
  expect(sim.recoveries).toBe(0);
}

for (const action of ["sleep", "sit", "groom"] as Action[]) {
  for (const direction of [-1, 1]) {
    test(`a walker passes a cat that will ${action} for minutes, direction ${direction}`, () => {
      const sim = new Simulation(couch, 2, 12);
      const surface = sim.graph.surfaces.find((s) => s.owner === "couch")!;
      const [walker, resting] = sim.cats;
      const center = (surface.x0 + surface.x1) / 2;
      const restGoal = sim.graph.goals.find(
        (g) =>
          g.surfaceId === surface.id &&
          g.action === action &&
          Math.abs(g.x - center) < 0.1,
      )!;
      Object.assign(resting, {
        roomId: "lounge",
        surfaceId: surface.id,
        x: restGoal.x,
        y: surface.y,
        state: action,
        timer: 300,
        goal: restGoal,
      });
      Object.assign(walker, {
        roomId: "lounge",
        surfaceId: surface.id,
        x: direction > 0 ? surface.x0 + 0.3 : surface.x1 - 0.3,
        y: surface.y,
      });
      const destination = sim.graph.goals.find(
        (g) =>
          g.surfaceId === surface.id &&
          g.action === "sit" &&
          (g.x - center) * direction > 0.5,
      )!;
      expect(sim.requestGoal(walker, destination)).toBe(true);
      advanceToArrival(sim, walker);
      expect(resting.state).toBe(action);
      expect(resting.x).toBe(restGoal.x);
      expect(resting.y).toBe(surface.y);
      expect(resting.timer).toBeCloseTo(300 - sim.elapsed);
      expect(resting.goal).toEqual(restGoal);
      expect(sim.pathSearches).toBe(1);
      // Passing through a spot never grants ownership of the resting cat's spot.
      expect(sim.requestGoal(walker, restGoal)).toBe(false);
    });
  }
}

test("two walkers pass in opposite directions among a group of resting cats", () => {
  const sim = new Simulation({ version: 1, furniture: [] }, 6, 15);
  const surface = sim.graph.surfaces.find((s) => s.roomId === "lounge")!;
  const [left, right, ...resting] = sim.cats;
  for (const [index, cat] of sim.cats.entries()) {
    Object.assign(cat, {
      roomId: "lounge",
      surfaceId: surface.id,
      y: 0,
      x: 4 + index,
      state: "sleep",
      timer: 300,
    });
  }
  left.x = 2;
  right.x = 13;
  const destinations = [left, right].map((cat, index) => {
    const goal = sim.graph.goals.find(
      (g) =>
        g.surfaceId === surface.id &&
        g.action === "sit" &&
        (index === 0 ? g.x > 13 : g.x < 2),
    )!;
    expect(sim.requestGoal(cat, goal)).toBe(true);
    return goal;
  });
  for (
    let frame = 0;
    frame < 1200 && [left, right].some((c) => c.state === "walk");
    frame++
  )
    sim.step(1 / 60);
  for (const [index, cat] of [left, right].entries()) {
    expect(cat.x).toBeCloseTo(destinations[index].x);
    expect(cat.state).toBe("sit");
  }
  expect(resting.every((c) => c.state === "sleep" && c.timer > 280)).toBe(true);
  expect(sim.recoveries).toBe(0);
  expect(sim.pathSearches).toBe(2);
});

test("a long walk with steady progress does not trigger emergency recovery", () => {
  const sim = new Simulation({ version: 1, furniture: [] }, 1);
  const cat = sim.cats[0];
  cat.x = 1;
  cat.speed = 0.3;
  const goal = sim.graph.goals.find(
    (g) => g.surfaceId === cat.surfaceId && g.x > 13,
  )!;
  expect(sim.requestGoal(cat, goal)).toBe(true);
  for (let frame = 0; frame < 1800; frame++) sim.step(1 / 60);
  expect(cat.x).toBeGreaterThan(9);
  expect(cat.goal).toEqual(goal);
  expect(cat.state).toBe("walk");
  expect(sim.recoveries).toBe(0);
});
