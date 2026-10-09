import { expect, test } from "vitest";
import { makeFurniture } from "../src/model";
import { Simulation } from "../src/simulation";

function visitors(definitionId: string) {
  const item = makeFurniture(definitionId, "lounge", 6, 0, "shared-prop");
  const sim = new Simulation({ version: 1, furniture: [item] }, 2);
  const goals = sim.graph.goals.filter(
    (goal) => goal.interaction?.furnitureId === item.instanceId,
  );
  expect(goals).toHaveLength(2);
  for (const [index, cat] of sim.cats.entries()) {
    Object.assign(cat, {
      roomId: "lounge",
      homeRoomId: "lounge",
      surfaceId: goals[index].surfaceId,
      x: goals[index].x - 0.05 * goals[index].interaction!.facing,
      y: 0,
      state: "idle",
      timer: 999,
      goal: null,
    });
  }
  return { sim, item, goals };
}

test.each(["box", "scratcher"])(
  "%s reserves both approaches while a cat is traveling there and using it",
  (definition) => {
    const { sim, goals } = visitors(definition);
    const [first, second] = sim.cats;
    expect(sim.requestGoal(first, goals[0])).toBe(true);
    expect(first.state).toBe("walk");
    expect(sim.requestGoal(second, goals[1])).toBe(false);
    for (let frame = 0; frame < 20 && first.state === "walk"; frame++)
      sim.step(0.05);
    expect(first.state).toBe(goals[0].action);
    expect(sim.requestGoal(second, goals[1])).toBe(false);
    const ordinary = sim.graph.goals.find(
      (goal) =>
        goal.surfaceId === first.surfaceId &&
        goal.action === "groom" &&
        !goal.interaction,
    )!;
    expect(sim.requestGoal(first, ordinary)).toBe(true);
    expect(sim.requestGoal(second, goals[1])).toBe(true);
  },
);

test.each(["remove cat", "relocate cat", "flip prop", "remove prop"])(
  "an interaction reservation is released after %s",
  (change) => {
    const { sim, item, goals } = visitors("box");
    const [first, second] = sim.cats;
    expect(sim.requestGoal(first, goals[0])).toBe(true);
    // Unchanged furniture retains its reservation across a harmless graph refresh.
    sim.rebuild(structuredClone(sim.layout));
    expect(first.goal).toEqual(goals[0]);
    expect(sim.requestGoal(second, goals[1])).toBe(false);
    if (change === "remove cat")
      sim.replaceRoster(
        sim.roster().filter((profile) => profile.id !== first.id),
      );
    else if (change === "relocate cat") sim.relocate(first, "bedroom");
    else if (change === "flip prop")
      sim.rebuild({ version: 1, furniture: [{ ...item, flipX: true }] });
    else {
      sim.rebuild({ version: 1, furniture: [] });
      expect(first.goal).toBeNull();
      sim.rebuild({ version: 1, furniture: [item] });
    }
    const visitor = sim.cats.find((cat) => cat.id === second.id)!;
    const available = sim.graph.goals.find(
      (goal) => goal.key === goals[1].key,
    )!;
    expect(sim.requestGoal(visitor, available)).toBe(true);
  },
);

test("unrelated props and ordinary floor slots remain independently reservable", () => {
  const { sim, item, goals } = visitors("scratcher");
  sim.rebuild({
    version: 1,
    furniture: [item, makeFurniture("box", "lounge", 10, 0, "another-prop")],
  });
  const first = sim.graph.goals.find((goal) => goal.key === goals[0].key)!;
  const second = sim.graph.goals.find(
    (goal) => goal.interaction?.furnitureId === "another-prop",
  )!;
  expect(sim.requestGoal(sim.cats[0], first)).toBe(true);
  expect(sim.requestGoal(sim.cats[1], second)).toBe(true);
});
