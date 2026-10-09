import { describe, expect, it } from "vitest";
import { Simulation } from "../src/simulation";
import { makeFurniture } from "../src/model";
import { bodyClear } from "../src/navigation";

function neighbors() {
  const sim = new Simulation({ version: 1, furniture: [] }, 2, 101);
  const surface = sim.graph.surfaces.find(
    (s) => s.roomId === "lounge" && s.actions.includes("sit"),
  )!;
  sim.elapsed = 1000;
  sim.random.next = () => 0;
  for (const [index, cat] of sim.cats.entries()) {
    const goal = sim.graph.goals.filter(
      (g) => g.surfaceId === surface.id && g.action === "sit",
    )[index === 0 ? 3 : 5];
    Object.assign(cat, {
      roomId: "lounge",
      homeRoomId: "lounge",
      surfaceId: surface.id,
      x: goal.x,
      y: 0,
      state: index === 0 ? "idle" : "sit",
      timer: 60,
      goal: index === 0 ? null : goal,
      sociability: 1,
      energy: 0.8,
      socialCooldown: 0,
    });
  }
  return sim;
}

function settle(sim: Simulation) {
  expect(sim.trySocial(sim.cats[0])).toBe(true);
  for (
    let frame = 0;
    frame < 200 && sim.cats[0].social?.phase !== "settled";
    frame++
  )
    sim.step(0.05);
  expect(sim.cats.every((cat) => cat.social?.phase === "settled")).toBe(true);
}

describe("occasional gentle encounters", () => {
  it("greets at separate spots, faces its neighbor, then resumes independent activities", () => {
    const sim = neighbors();
    const [visitor, resident] = sim.cats;
    const residentGoal = resident.goal;
    const residentPosition = resident.x;
    settle(sim);
    expect(visitor.social?.kind).toBe("greet");
    expect(Math.abs(visitor.x - resident.x)).toBeGreaterThanOrEqual(1.15);
    expect(visitor.facing).toBe(-resident.facing);
    expect(resident.x).toBe(residentPosition);
    expect(visitor.actions.greet).toBe(1);
    expect(resident.actions.greet).toBe(1);
    expect(sim.events[0].text).toContain(resident.name);
    for (let frame = 0; frame < 70; frame++) sim.step(0.05);
    expect(visitor.social).toBeNull();
    expect(resident.social).toBeNull();
    expect(resident.goal).toEqual(residentGoal);
    expect(resident.state).toBe("sit");
    expect(resident.timer).toBeGreaterThan(50);
    expect(sim.trySocial(visitor)).toBe(false);
    expect(sim.recoveries).toBe(0);
  });

  it("can share a quiet view for longer without stacking or continuous greetings", () => {
    const sim = neighbors();
    let draw = 0;
    sim.random.next = () => (++draw === 3 ? 0.9 : 0);
    settle(sim);
    expect(sim.cats[0].social?.kind).toBe("company");
    expect(sim.cats[0].facing).toBe(sim.cats[1].facing);
    expect(sim.cats[0].timer).toBeGreaterThanOrEqual(12);
    expect(sim.cats[0].actions.company).toBe(1);
    for (let frame = 0; frame < 260; frame++) sim.step(0.05);
    expect(sim.cats.every((cat) => !cat.social)).toBe(true);
    sim.cats.forEach((cat) => {
      cat.socialCooldown = 0;
    });
    expect(sim.trySocial(sim.cats[0])).toBe(false);
  });

  it.each(["sleep", "groom", "hide", "scratch", "play", "walk"])(
    "leaves a neighbor who is %s completely alone",
    (state) => {
      const sim = neighbors();
      sim.cats[1].state = state as (typeof sim.cats)[1]["state"];
      const before = structuredClone(sim.cats[1]);
      expect(sim.trySocial(sim.cats[0])).toBe(false);
      expect(sim.cats[1]).toEqual(before);
    },
  );

  it("respects reserved spots, distance, tiredness and unsociable cats", () => {
    for (const change of [
      (sim: Simulation) => {
        sim.cats[1].energy = 0.1;
      },
      (sim: Simulation) => {
        sim.cats[1].sociability = 0.1;
      },
      (sim: Simulation) => {
        sim.cats[1].x = 14;
      },
      (sim: Simulation) => {
        sim.cats[0].energy = 0.1;
      },
    ]) {
      const sim = neighbors();
      change(sim);
      expect(sim.trySocial(sim.cats[0])).toBe(false);
    }
  });

  it.each(["new goal", "remove", "move home", "edit", "relocate"])(
    "releases both participants after %s",
    (change) => {
      const sim = neighbors();
      settle(sim);
      const [visitor, resident] = sim.cats;
      if (change === "new goal") {
        const goal = sim.graph.goals.find(
          (g) =>
            g.surfaceId === visitor.surfaceId &&
            g.x < 2 &&
            g.action === "groom",
        )!;
        expect(sim.requestGoal(visitor, goal)).toBe(true);
        expect(visitor.goal).toEqual(goal);
      } else if (change === "remove")
        sim.replaceRoster(sim.roster().filter((cat) => cat.id !== visitor.id));
      else if (change === "move home")
        sim.replaceRoster(
          sim
            .roster()
            .map((cat) =>
              cat.id === visitor.id ? { ...cat, roomId: "bedroom" } : cat,
            ),
        );
      else if (change === "relocate") sim.relocate(visitor, "bedroom");
      else sim.rebuild({ version: 1, furniture: [] });
      expect(sim.cats.every((cat) => cat.social === null)).toBe(true);
      expect(sim.cats.find((cat) => cat.id === resident.id)?.state).toBe("sit");
    },
  );

  it("cancels an approach gracefully if the neighbor leaves", () => {
    const sim = neighbors();
    expect(sim.trySocial(sim.cats[0])).toBe(true);
    const goal = sim.graph.goals.find(
      (g) =>
        g.surfaceId === sim.cats[1].surfaceId && g.x < 2 && g.action === "sit",
    )!;
    expect(sim.requestGoal(sim.cats[1], goal)).toBe(true);
    expect(sim.cats[0].social).toBeNull();
    expect(sim.cats[0].goal).toBeNull();
    expect(sim.cats[1].social).toBeNull();
    expect(sim.cats[1].goal).toEqual(goal);
  });

  it("finishes a safe landing if an invitation is canceled during a short jump", () => {
    const sim = new Simulation(
      {
        version: 1,
        furniture: [makeFurniture("couch", "lounge", 6, 0, "sofa")],
      },
      2,
    );
    sim.elapsed = 1000;
    sim.random.next = () => 0;
    const floor = sim.graph.surfaces.find(
      (surface) =>
        surface.roomId === "lounge" &&
        surface.y === 0 &&
        surface.x0 < 4 &&
        surface.x1 > 4,
    )!;
    const sofa = sim.graph.surfaces.find(
      (surface) => surface.owner === "sofa",
    )!;
    const goal = sim.graph.goals.find(
      (goal) =>
        goal.surfaceId === sofa.id && goal.action === "sit" && goal.x === 8,
    )!;
    const [visitor, resident] = sim.cats;
    Object.assign(visitor, {
      roomId: "lounge",
      surfaceId: floor.id,
      x: 4,
      y: 0,
      state: "idle",
      sociability: 1,
      energy: 0.8,
      socialCooldown: 0,
    });
    Object.assign(resident, {
      roomId: "lounge",
      surfaceId: sofa.id,
      x: goal.x,
      y: sofa.y,
      state: "sit",
      timer: 60,
      goal,
      sociability: 1,
      energy: 0.8,
      socialCooldown: 0,
    });
    expect(sim.trySocial(visitor)).toBe(true);
    for (let frame = 0; frame < 200 && !visitor.move; frame++) sim.step(0.05);
    expect(visitor.move?.kind).toBe("jump");
    const next = sim.graph.goals.find(
      (goal) =>
        goal.surfaceId === sofa.id && goal.action === "groom" && goal.x > 9,
    )!;
    expect(sim.requestGoal(resident, next)).toBe(true);
    expect(visitor.social).toBeNull();
    expect(visitor.goal).toBeNull();
    expect(visitor.state).toBe("jump");
    for (let frame = 0; frame < 60 && visitor.move; frame++) sim.step(0.05);
    expect(visitor.move).toBeNull();
    expect(
      bodyClear(
        visitor.roomId,
        visitor.x,
        visitor.y,
        sim.graph.solids.get(visitor.roomId)!,
      ),
    ).toBe(true);
    expect(sim.recoveries).toBe(0);
  });

  it("keeps a mutual encounter through a harmless roster save and leaves failed changes atomic", () => {
    const sim = neighbors();
    settle(sim);
    const before = structuredClone(sim.snapshot());
    const roster = sim.roster();
    expect(() => sim.replaceRoster([...roster, roster[0]])).toThrow();
    expect(sim.snapshot()).toEqual(before);
    sim.replaceRoster(roster);
    expect(sim.snapshot()).toEqual(before);
    for (let frame = 0; frame < 70; frame++) sim.step(0.05);
    expect(sim.cats.every((cat) => !cat.social)).toBe(true);
  });

  it("snapshots isolate nested motivations, social state, routes and graph data from callers", () => {
    const sim = neighbors();
    settle(sim);
    const before = sim.snapshot();
    const snapshot = sim.snapshot();
    snapshot.cats[0].needs.grooming = 99;
    snapshot.cats[0].social!.partnerId = "missing-cat";
    snapshot.cats[1].social!.resume!.timer = 9999;
    snapshot.cats[1].social!.resume!.goal!.x = -9999;
    snapshot.cats[0].actions.greet = 9999;
    snapshot.cats[0].recent.push("not-a-live-goal");
    snapshot.cats[0].path.push({
      from: "missing",
      to: "missing",
      sx: 0,
      tx: 0,
      sy: 0,
      ty: 0,
      arc: 0,
      cost: 0,
      kind: "walk",
    });
    snapshot.surfaces[0].actions.length = 0;
    snapshot.events[0].text = "not-a-live-event";
    expect(sim.snapshot()).toEqual(before);
  });
});
