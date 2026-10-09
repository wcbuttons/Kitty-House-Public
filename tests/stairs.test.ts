import { afterEach, expect, test, vi } from "vitest";
import type { Cat, Simulation } from "../src/simulation";

async function ramenWorld() {
  const backend = {
    getItem: (key: string) =>
      key === "little-house.theme.v1" ? "ramen" : null,
  };
  vi.stubGlobal("window", { localStorage: backend });
  vi.resetModules();
  return {
    ...(await import("../src/model")),
    ...(await import("../src/navigation")),
    ...(await import("../src/passages")),
    ...(await import("../src/simulation")),
  };
}

type World = Awaited<ReturnType<typeof ramenWorld>>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function stepContinuously(world: World, sim: Simulation, cat: Cat) {
  const before = world.worldPoint(world.roomById(cat.roomId), cat.x, cat.y);
  sim.step(1 / 60);
  const after = world.worldPoint(world.roomById(cat.roomId), cat.x, cat.y);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(12);
  if (!cat.move?.passage)
    expect(
      world.bodyClear(
        cat.roomId,
        cat.x,
        cat.y,
        sim.graph.solids.get(cat.roomId)!,
      ),
      JSON.stringify({ room: cat.roomId, x: cat.x, y: cat.y, move: cat.move }),
    ).toBe(true);
}

test("a resident tours the furnished ramen shop, studio and terrace in both directions", async () => {
  const world = await ramenWorld();
  const sim = new world.Simulation(world.defaultLayout(), 1, 61);
  const cat = sim.cats[0];
  const profile = sim.roster()[0];
  let stairFrames = 0;
  for (const room of ["studio", "terrace", "shop"]) {
    const goal = sim.graph.goals.find(
      (goal) =>
        sim.surface(goal.surfaceId)?.roomId === room && goal.action === "sit",
    )!;
    expect(goal).toBeDefined();
    expect(sim.requestGoal(cat, goal)).toBe(true);
    for (let frame = 0; frame < 12000 && cat.state !== "sit"; frame++) {
      stepContinuously(world, sim, cat);
      if (cat.move?.passage?.kind === "stairs") {
        expect(cat.state).toBe("cross");
        expect(world.passageSegmentClear(cat.move, sim.graph.solids)).toBe(
          true,
        );
        stairFrames++;
      }
      expect(cat.goal).toEqual(goal);
    }
    expect(cat.roomId).toBe(room);
    expect(cat.state).toBe("sit");
    expect(cat.x).toBeCloseTo(goal.x);
    expect(sim.roster()[0]).toEqual(profile);
  }
  expect(stairFrames).toBeGreaterThan(60);
  expect(new Set(cat.visitedRooms)).toEqual(
    new Set(["shop", "studio", "terrace"]),
  );
  expect(cat.homeRoomId).toBe("shop");
  expect(cat.awayFor).toBe(0);
  expect(sim.recoveries).toBe(0);
});

test("opposing stair traffic waits its turn without deadlock", async () => {
  const world = await ramenWorld();
  const sim = new world.Simulation({ version: 1, furniture: [] }, 3, 17);
  const stairs = sim.graph.edges.filter(
    (edge) => edge.passage?.kind === "stairs",
  );
  const id = stairs[0].passage!.id;
  const goals = sim.cats.map((cat, index) => {
    const edge = stairs.find(
      (edge) => edge.passage?.fromRoomId === (index === 1 ? "studio" : "shop"),
    )!;
    Object.assign(cat, {
      roomId: edge.passage!.fromRoomId,
      surfaceId: edge.from,
      x: edge.sx,
      y: edge.sy,
    });
    const goal = sim.graph.goals.filter(
      (goal) =>
        sim.surface(goal.surfaceId)?.roomId === edge.passage!.toRoomId &&
        goal.action === "sit",
    )[index + 1];
    expect(sim.requestGoal(cat, goal)).toBe(true);
    return goal;
  });
  const arrived = new Set<string>();
  let waiting = false;
  for (let frame = 0; frame < 6000 && arrived.size < sim.cats.length; frame++) {
    sim.step(1 / 60);
    expect(
      sim.cats.filter((cat) => cat.move?.passage?.id === id).length,
    ).toBeLessThanOrEqual(1);
    waiting ||= sim.cats.some((cat) => cat.state === "wait");
    for (const [index, cat] of sim.cats.entries()) {
      if (cat.state === "sit" && cat.goal?.key === goals[index].key) {
        arrived.add(cat.id);
        cat.timer = 999;
      }
    }
  }
  expect(waiting).toBe(true);
  expect(arrived.size).toBe(3);
  expect(sim.recoveries).toBe(0);
});

test("furniture across the middle of the diagonal stairs closes and reopens both routes", async () => {
  const world = await ramenWorld();
  const before = world.defaultLayout();
  const graph = world.buildGraph(before);
  const stairs = graph.edges.find(
    (edge) =>
      edge.passage?.kind === "stairs" && edge.passage.fromRoomId === "shop",
  )!;
  const middle = world.passageWorldPoint(stairs, 0.5);
  const shop = world.roomById("shop");
  const after = {
    ...before,
    furniture: [
      ...before.furniture,
      world.makeFurniture(
        "shelf",
        "shop",
        Math.floor((middle.x - shop.x) / world.CELL),
        Math.floor((shop.floor - middle.y) / world.CELL),
        "stairs-blocker",
      ),
    ],
  };
  const blocked = world.updateGraph(graph, before, after);
  expect(
    blocked.edges.filter((edge) => edge.passage?.kind === "stairs"),
  ).toHaveLength(0);
  expect(world.routeValid(blocked, [stairs])).toBe(false);
  expect(world.routeValid(graph, [stairs])).toBe(true);
  const restored = world.updateGraph(blocked, after, before);
  expect(
    restored.edges.filter((edge) => edge.passage?.kind === "stairs"),
  ).toHaveLength(2);
  expect(world.routeValid(restored, [stairs])).toBe(true);
});

test.each(["shop", "studio"])(
  "an edited stair landing sends a resident from %s continuously back to a clear exit",
  async (startRoom) => {
    const world = await ramenWorld();
    const layout = { version: 1 as const, furniture: [] };
    const sim = new world.Simulation(layout, 1);
    const cat = sim.cats[0];
    const stairs = sim.graph.edges.find(
      (edge) =>
        edge.passage?.kind === "stairs" &&
        edge.passage.fromRoomId === startRoom,
    )!;
    Object.assign(cat, {
      roomId: startRoom,
      surfaceId: stairs.from,
      x: stairs.sx,
      y: stairs.sy,
    });
    const goal = sim.graph.goals.find(
      (goal) =>
        sim.surface(goal.surfaceId)?.roomId === stairs.passage!.toRoomId &&
        goal.action === "sit",
    )!;
    expect(sim.requestGoal(cat, goal)).toBe(true);
    for (
      let frame = 0;
      frame < 2400 && !(cat.move?.passage && cat.progress > 0.4);
      frame++
    )
      stepContinuously(world, sim, cat);
    expect(cat.move?.passage?.kind).toBe("stairs");
    const position = world.worldPoint(world.roomById(cat.roomId), cat.x, cat.y);
    sim.rebuild({
      ...layout,
      furniture: [
        world.makeFurniture(
          "stool",
          stairs.passage!.toRoomId,
          Math.floor(stairs.tx),
          0,
          "blocked-landing",
        ),
      ],
    });
    expect(world.worldPoint(world.roomById(cat.roomId), cat.x, cat.y)).toEqual(
      position,
    );
    expect(cat.state).toBe("recover");
    expect(cat.goal).toBeNull();
    expect(world.passageSegmentClear(cat.move!, sim.graph.solids)).toBe(true);
    for (let frame = 0; frame < 2400 && cat.move; frame++)
      stepContinuously(world, sim, cat);
    expect(cat.move).toBeNull();
    expect(cat.roomId).toBe(startRoom);
    expect(cat.y).toBe(0);
  },
);
