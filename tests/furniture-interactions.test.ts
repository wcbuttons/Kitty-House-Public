import { expect, test } from "vitest";
import { makeFurniture, placementError, type Layout } from "../src/model";
import {
  bodyClear,
  buildGraph,
  findPath,
  updateGraph,
} from "../src/navigation";

const layout = (...furniture: Layout["furniture"]): Layout => ({
  version: 1,
  furniture,
});

test("scratching approaches the post from clear floor and does not offer grooming on its top", () => {
  const post = makeFurniture("scratcher", "lounge", 4, 0, "post");
  const graph = buildGraph(layout(post));
  const goals = graph.goals.filter(
    (goal) => goal.interaction?.furnitureId === "post",
  );
  expect(goals).toHaveLength(2);
  for (const goal of goals) {
    const surface = graph.surfaces.find(
      (surface) => surface.id === goal.surfaceId,
    )!;
    expect(surface.y).toBe(0);
    expect(surface.owner).toBeUndefined();
    expect(goal.action).toBe("scratch");
    expect(
      bodyClear(surface.roomId, goal.x, 0, graph.solids.get(surface.roomId)!),
    ).toBe(true);
    expect(Math.abs(goal.x - goal.interaction!.targetX)).toBeLessThanOrEqual(1);
    expect(goal.interaction!.facing).toBe(
      Math.sign(goal.interaction!.targetX - goal.x),
    );
  }
  const tops = graph.surfaces.filter((surface) => surface.owner === "post");
  expect(tops.every((surface) => surface.actions.length === 0)).toBe(true);
});

test("hideaways have clear floor approaches and a mirrored entrance target", () => {
  for (const id of ["box", "toy-chest", "play-tunnel"]) {
    const item = makeFurniture(id, "lounge", 4, 0, "hideaway");
    const graph = buildGraph(layout(item));
    const goals = graph.goals.filter((goal) => goal.action === "hide");
    expect(goals).toHaveLength(2);
    expect(
      graph.surfaces
        .filter((surface) => surface.owner === item.instanceId)
        .every((surface) => !surface.actions.includes("hide")),
    ).toBe(true);
    for (const goal of goals) {
      const support = graph.surfaces.find(
        (surface) => surface.id === goal.surfaceId,
      )!;
      expect(support.y).toBe(0);
      expect(goal.interaction?.targetY).toBe(0);
      expect(bodyClear("lounge", goal.x, 0, graph.solids.get("lounge")!)).toBe(
        true,
      );
    }
    const mirrored = buildGraph(layout({ ...item, flipX: true }));
    const entrance = mirrored.goals.find(
      (goal) => goal.action === "hide",
    )!.interaction!;
    expect(entrance.targetX).toBeGreaterThan(goals[0].interaction!.targetX);
  }
});

test("blocking or moving a prop updates its usable interaction approaches", () => {
  const post = makeFurniture("scratcher", "lounge", 4, 0, "post");
  const before = layout(post);
  const graph = buildGraph(before);
  const blocked = layout(post, makeFurniture("bed", "lounge", 0, 0, "bed"));
  const changed = updateGraph(graph, before, blocked);
  expect(
    changed.goals
      .filter((goal) => goal.interaction?.furnitureId === "post")
      .map((goal) => goal.interaction?.facing),
  ).toEqual([-1]);
  const cleared = updateGraph(changed, blocked, layout());
  expect(
    cleared.goals.some((goal) => goal.interaction?.furnitureId === "post"),
  ).toBe(false);
  expect(
    graph.goals.filter((goal) => goal.interaction?.furnitureId === "post"),
  ).toHaveLength(2);
  const contact = changed.goals.find(
    (goal) => goal.interaction?.furnitureId === "post",
  )!;
  const start = changed.surfaces.find(
    (surface) => surface.roomId === "lounge" && !surface.owner,
  )!;
  expect(findPath(changed, start.id, contact.surfaceId)).not.toBeNull();
});

test("the centered scratch-post mask still rejects overlapping furniture cells", () => {
  const post = makeFurniture("scratcher", "lounge", 4, 0, "post");
  expect(placementError(makeFurniture("box", "lounge", 3), layout(post))).toBe(
    "Furniture cannot overlap",
  );
  expect(
    placementError(makeFurniture("box", "lounge", 2), layout(post)),
  ).toBeNull();
});
