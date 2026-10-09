import { expect, test } from "vitest";
import {
  defaultLayout,
  makeFurniture,
  roomById,
  worldPoint,
} from "../src/model";
import { bodyClear } from "../src/navigation";
import { chooseRoamingRoom } from "../src/roaming";
import { passageSegmentClear } from "../src/passages";
import { Random, Simulation, type Cat } from "../src/simulation";
import { CatStorage } from "../src/storage";

function travel(sim: Simulation, cat: Cat, roomId: string) {
  const goal = sim.graph.goals.find(
    (g) => sim.surface(g.surfaceId)?.roomId === roomId && g.action === "sit",
  )!;
  expect(sim.requestGoal(cat, goal)).toBe(true);
  for (let frame = 0; frame < 7200; frame++) {
    const previous = worldPoint(roomById(cat.roomId), cat.x, cat.y);
    sim.step(1 / 60);
    const current = worldPoint(roomById(cat.roomId), cat.x, cat.y);
    expect(
      Math.hypot(current.x - previous.x, current.y - previous.y),
    ).toBeLessThan(12);
    if (!cat.move?.passage)
      expect(
        bodyClear(cat.roomId, cat.x, cat.y, sim.graph.solids.get(cat.roomId)!),
        JSON.stringify({
          destination: roomId,
          room: cat.roomId,
          x: cat.x,
          y: cat.y,
          state: cat.state,
          move: cat.move,
        }),
      ).toBe(true);
    expect(cat.goal).toEqual(goal);
    if (cat.state === "sit") break;
  }
  expect(cat.roomId).toBe(roomId);
  expect(cat.state).toBe("sit");
  expect(cat.surfaceId).toBe(goal.surfaceId);
  expect(cat.x).toBeCloseTo(goal.x);
}

test("a cat walks and climbs through every furnished room and returns without changing home", () => {
  const sim = new Simulation(defaultLayout(), 1, 61);
  const cat = sim.cats[0];
  const profile = sim.roster()[0];
  for (const room of ["bedroom", "library", "playroom", "attic", "lounge"]) {
    travel(sim, cat, room);
    expect(cat.homeRoomId).toBe("lounge");
    expect(sim.roster()[0]).toEqual(profile);
  }
  expect(new Set(cat.visitedRooms).size).toBe(5);
  expect(cat.awayFor).toBe(0);
  expect(sim.recoveries).toBe(0);
});

test("saving, roster edits and reload preserve a visitor's home and ongoing location", () => {
  const sim = new Simulation(defaultLayout(), 1);
  travel(sim, sim.cats[0], "bedroom");
  const visitor = structuredClone(sim.cats[0]);
  const profile = sim.roster()[0];
  const adopted = sim.makeCatProfile(7, "attic");
  sim.replaceRoster([...sim.roster(), adopted]);
  expect(sim.cats[0]).toEqual(visitor);
  sim.replaceRoster(sim.roster().filter((c) => c.id !== adopted.id));
  expect(sim.cats[0]).toEqual(visitor);
  const data = new Map<string, string>();
  const storage = new CatStorage({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  });
  storage.save(sim.roster());
  const restored = new Simulation(defaultLayout(), 0);
  restored.replaceRoster(storage.load()!);
  expect(restored.roster()[0]).toEqual(profile);
  expect(restored.cats[0].roomId).toBe("lounge");
  expect(restored.cats[0].homeRoomId).toBe("lounge");
  // Assigning a new home while visiting that room must still change the saved home.
  sim.replaceRoster([{ ...profile, roomId: "bedroom" }]);
  expect(sim.roster()[0].roomId).toBe("bedroom");
  expect(sim.cats[0].homeRoomId).toBe("bedroom");
  expect(sim.cats[0].roomId).toBe("bedroom");
});

test("opposing passage traffic crosses one at a time without deadlock", () => {
  const sim = new Simulation({ version: 1, furniture: [] }, 3, 17);
  const edges = sim.graph.edges.filter((e) => e.passage?.id === "lower-door");
  const goals = sim.cats.map((cat, index) => {
    const edge = edges.find(
      (e) => e.passage?.fromRoomId === (index === 1 ? "bedroom" : "lounge"),
    )!;
    Object.assign(cat, {
      roomId: edge.passage!.fromRoomId,
      surfaceId: edge.from,
      x: edge.sx,
      y: edge.sy,
    });
    const choices = sim.graph.goals.filter(
      (g) =>
        sim.surface(g.surfaceId)?.roomId === edge.passage!.toRoomId &&
        g.action === "sit",
    );
    const goal = choices[index + 1];
    expect(sim.requestGoal(cat, goal)).toBe(true);
    return goal;
  });
  const arrived = new Set<string>();
  for (let frame = 0; frame < 2400 && arrived.size < 3; frame++) {
    sim.step(1 / 60);
    expect(
      sim.cats.filter((c) => c.move?.passage?.id === "lower-door").length,
    ).toBeLessThanOrEqual(1);
    for (const [index, cat] of sim.cats.entries()) {
      if (cat.state === "sit" && cat.goal?.key === goals[index].key)
        arrived.add(cat.id);
    }
  }
  expect(arrived.size).toBe(3);
  expect(sim.recoveries).toBe(0);
});

test("a furniture edit during a climb causes a continuous retreat to a clear landing", () => {
  const original = defaultLayout();
  const sim = new Simulation(original, 1);
  const cat = sim.cats[0];
  const edge = sim.graph.edges.find(
    (e) =>
      e.passage?.id === "lower-ladder" && e.passage.fromRoomId === "lounge",
  )!;
  Object.assign(cat, { surfaceId: edge.from, x: edge.sx, y: 0 });
  const goal = sim.graph.goals.find(
    (g) => sim.surface(g.surfaceId)?.roomId === "library" && g.action === "sit",
  )!;
  expect(sim.requestGoal(cat, goal)).toBe(true);
  for (
    let frame = 0;
    frame < 600 && !(cat.move?.passage && cat.progress > 0.4);
    frame++
  )
    sim.step(1 / 60);
  expect(cat.move?.passage?.id).toBe("lower-ladder");
  const position = worldPoint(roomById(cat.roomId), cat.x, cat.y);
  sim.rebuild({
    ...original,
    furniture: [
      ...original.furniture,
      makeFurniture("stool", "library", 6, 0, "blocked-landing"),
    ],
  });
  expect(worldPoint(roomById(cat.roomId), cat.x, cat.y)).toEqual(position);
  expect(cat.state).toBe("recover");
  expect(cat.goal).toBeNull();
  for (let frame = 0; frame < 600 && cat.move; frame++) sim.step(1 / 60);
  expect(cat.move).toBeNull();
  expect(cat.roomId).toBe("lounge");
  expect(cat.homeRoomId).toBe("lounge");
  expect(
    bodyClear(cat.roomId, cat.x, cat.y, sim.graph.solids.get(cat.roomId)!),
  ).toBe(true);
});

test("curiosity increases both roaming frequency and distance; time away favors home", () => {
  const rooms = new Map([
    ["lounge", 0],
    ["bedroom", 1],
    ["library", 1],
    ["playroom", 2],
    ["attic", 3],
  ]);
  const base = {
    roomId: "lounge",
    homeRoomId: "lounge",
    curiosity: 0,
    laziness: 0.5,
    energy: 0.5,
    awayFor: 0,
  };
  const sample = (traits: typeof base) => {
    const rng = new Random(314);
    return Array.from({ length: 5000 }, () =>
      chooseRoamingRoom(traits, rooms, () => rng.next()),
    );
  };
  const shy = sample(base),
    curious = sample({ ...base, curiosity: 1 });
  expect(curious.filter((room) => room !== "lounge").length).toBeGreaterThan(
    shy.filter((room) => room !== "lounge").length * 5,
  );
  expect(curious.filter((room) => rooms.get(room)! > 1).length).toBeGreaterThan(
    shy.filter((room) => rooms.get(room)! > 1).length * 5,
  );
  const justArrived = sample({ ...base, roomId: "attic", curiosity: 1 });
  const homesick = sample({
    ...base,
    roomId: "attic",
    curiosity: 1,
    awayFor: 240,
  });
  expect(homesick.filter((room) => room === "lounge").length).toBeGreaterThan(
    justArrived.filter((room) => room === "lounge").length * 1.8,
  );
  expect(chooseRoamingRoom(base, new Map([["lounge", 0]]), () => 0)).toBe(
    "lounge",
  );
});

test("a shelf inserted below a climbing cat makes it continue to the clear upper exit", () => {
  const layout = { version: 1 as const, furniture: [] };
  const sim = new Simulation(layout, 1);
  const cat = sim.cats[0];
  const ladder = sim.graph.edges.find(
    (edge) =>
      edge.passage?.id === "lower-ladder" &&
      edge.passage.fromRoomId === "lounge",
  )!;
  Object.assign(cat, { surfaceId: ladder.from, x: ladder.sx, y: 0 });
  const goal = sim.graph.goals.find(
    (g) => sim.surface(g.surfaceId)?.roomId === "library",
  )!;
  expect(sim.requestGoal(cat, goal)).toBe(true);
  for (let frame = 0; frame < 600 && cat.y < 2.8; frame++) sim.step(1 / 60);
  expect(cat.move?.passage).toBeDefined();
  sim.rebuild({
    version: 1,
    furniture: [makeFurniture("shelf", "lounge", 5, 1, "shelf-below")],
  });
  expect(cat.move?.passage?.toRoomId).toBe("library");
  expect(passageSegmentClear(cat.move!, sim.graph.solids)).toBe(true);
  for (let frame = 0; frame < 600 && cat.move; frame++) sim.step(1 / 60);
  expect(cat.roomId).toBe("library");
  expect(cat.y).toBe(0);
});
