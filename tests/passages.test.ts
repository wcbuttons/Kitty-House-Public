import { describe, expect, it } from "vitest";
import {
  ROOMS,
  CELL,
  defaultLayout,
  makeFurniture,
  roomById,
  worldPoint,
  type Layout,
} from "../src/model";
import {
  arcClear,
  arcPoint,
  bodyClear,
  buildGraph,
  findPath,
  reachableSurfaces,
  routeValid,
  updateGraph,
  type Graph,
  type Edge,
} from "../src/navigation";
import {
  PASSAGES,
  passageClear,
  passageSegmentClear,
  passageWorldPoint,
} from "../src/passages";

const empty = (): Layout => ({ version: 1, furniture: [] });
const passageEdges = (graph: Graph, id?: string) =>
  graph.edges.filter(
    (edge) => edge.kind === "passage" && (!id || edge.passage?.id === id),
  );
const sorted = <T>(values: T[]) =>
  values.map((value) => JSON.stringify(value)).sort();

describe("fixed room passages", () => {
  it("rejects a drop that clips a box corner between the old arc samples", () => {
    const graph = buildGraph(defaultLayout());
    const edge: Edge = {
      from: "demo-16:0:0",
      to: "attic:floor:0",
      sx: 5,
      tx: 3.49,
      sy: 1,
      ty: 0,
      arc: 1.05,
      kind: "drop",
      cost: 4.01,
    };
    const t = (3.8188929001203373 - edge.sx) / (edge.tx - edge.sx);
    const point = arcPoint(edge, t);
    expect(
      bodyClear("attic", point.x, point.y, graph.solids.get("attic")!),
    ).toBe(false);
    expect(arcClear(edge, "attic", graph.solids.get("attic")!)).toBe(false);
    const safeDrop = graph.edges.find(
      (candidate) => candidate.from === edge.from && candidate.to === edge.to,
    )!;
    expect(safeDrop).toBeDefined();
    for (let step = 0; step <= 1000; step++) {
      const position = arcPoint(safeDrop, step / 1000);
      expect(
        bodyClear("attic", position.x, position.y, graph.solids.get("attic")!),
      ).toBe(true);
    }
  });

  it("lets cats return from the attic side of the furnished playroom via its table and tree", () => {
    const layout = defaultLayout();
    const graph = buildGraph(layout);
    const door = passageEdges(graph, "upper-door").find(
      (edge) => edge.passage?.fromRoomId === "playroom",
    )!;
    const ladder = passageEdges(graph, "attic-ladder").find(
      (edge) => edge.passage?.fromRoomId === "playroom",
    )!;
    expect(findPath(graph, door.from, ladder.from)).not.toBeNull();
    const returnPath = findPath(graph, ladder.from, door.from)!;
    expect(returnPath).not.toBeNull();
    const table = layout.furniture.find(
      (f) => f.roomId === "playroom" && f.definitionId === "table",
    )!;
    const tree = layout.furniture.find(
      (f) => f.roomId === "playroom" && f.definitionId === "cat-tree",
    )!;
    const tableTop = graph.surfaces.find((s) => s.owner === table.instanceId)!;
    const treeTop = graph.surfaces.find(
      (s) => s.owner === tree.instanceId && s.y === 5,
    )!;
    const ascent = returnPath.find(
      (edge) => edge.from === tableTop.id && edge.to === treeTop.id,
    )!;
    expect(ascent).toBeDefined();
    expect(ascent.ty - ascent.sy).toBe(3);
    expect(arcClear(ascent, "playroom", graph.solids.get("playroom")!)).toBe(
      true,
    );
  });

  it.each([
    ["furnished", defaultLayout()],
    ["empty", empty()],
  ])("connects all five rooms in the %s house", (_name, layout) => {
    const graph = buildGraph(layout as Layout);
    expect(passageEdges(graph)).toHaveLength(PASSAGES.length * 2);
    for (const room of ROOMS) {
      const start = graph.surfaces.find(
        (s) => s.roomId === room.id && s.y === 0,
      )!;
      const reachable = reachableSurfaces(graph, start.id);
      const rooms = new Set(
        graph.surfaces.filter((s) => reachable.has(s.id)).map((s) => s.roomId),
      );
      expect(rooms).toEqual(new Set(ROOMS.map((r) => r.id)));
    }
  });

  it("uses bidirectional entrances and linear world-space door and ladder paths", () => {
    const graph = buildGraph(defaultLayout());
    for (const passage of PASSAGES) {
      const edges = passageEdges(graph, passage.id);
      const forward = edges.find(
        (e) => e.passage?.fromRoomId === passage.a.roomId,
      )!;
      const backward = edges.find(
        (e) => e.passage?.fromRoomId === passage.b.roomId,
      )!;
      expect(forward).toBeDefined();
      expect(backward).toBeDefined();
      expect(forward.from).toBe(backward.to);
      expect(forward.to).toBe(backward.from);
      expect(forward.arc).toBe(0);
      expect(forward.cost).toBeGreaterThan(1);
      expect(forward.cost).toBeLessThan(20);
      const a = worldPoint(roomById(passage.a.roomId), passage.a.x, 0);
      const b = worldPoint(roomById(passage.b.roomId), passage.b.x, 0);
      expect(passageWorldPoint(forward, 0)).toEqual(a);
      expect(passageWorldPoint(forward, 1)).toEqual(b);
      expect(passageWorldPoint(forward, 0.5)).toEqual({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
      expect(passageWorldPoint(backward, 0)).toEqual(b);
      expect(passageWorldPoint(backward, 1)).toEqual(a);
      expect(passageClear(forward, graph.solids)).toBe(true);
      expect(
        arcClear(
          forward,
          passage.a.roomId,
          graph.solids.get(passage.a.roomId)!,
          graph.solids,
        ),
      ).toBe(true);
      for (const entrance of [passage.a, passage.b])
        expect(
          bodyClear(
            entrance.roomId,
            entrance.x,
            0,
            graph.solids.get(entrance.roomId)!,
          ),
        ).toBe(true);
    }
  });

  it("adds only the narrow travel thresholds needed by furnished doorways", () => {
    const graph = buildGraph(defaultLayout());
    const thresholds = graph.surfaces.filter((s) =>
      s.id.startsWith("passage:"),
    );
    expect(thresholds.map((s) => s.roomId).sort()).toEqual([
      "bedroom",
      "library",
      "playroom",
    ]);
    for (const surface of thresholds) {
      expect(surface.x1 - surface.x0).toBeCloseTo(0.5);
      expect(surface.capacity).toBe(1);
      expect(surface.actions).toEqual([]);
      expect(graph.goals.some((g) => g.surfaceId === surface.id)).toBe(false);
      expect(
        graph.edges.some((e) => e.kind !== "passage" && e.to === surface.id),
      ).toBe(true);
      expect(
        graph.edges.some((e) => e.kind !== "passage" && e.from === surface.id),
      ).toBe(true);
    }
    expect(
      buildGraph(empty()).surfaces.some((s) => s.id.startsWith("passage:")),
    ).toBe(false);
  });

  it("disables a doorway blocked at either entrance and restores it after clearing", () => {
    for (const [room, x] of [
      ["lounge", 15],
      ["bedroom", 0],
    ] as const) {
      const clear = empty();
      const blocked: Layout = {
        version: 1,
        furniture: [makeFurniture("stool", room, x, 0, "door-block")],
      };
      const graph = buildGraph(clear);
      const beforeEdges = passageEdges(graph, "lower-door");
      const next = updateGraph(graph, clear, blocked);
      expect(passageEdges(next, "lower-door")).toHaveLength(0);
      expect(passageClear(beforeEdges[0], next.solids)).toBe(false);
      expect(routeValid(next, beforeEdges)).toBe(false);
      expect(
        passageEdges(updateGraph(next, blocked, clear), "lower-door"),
      ).toHaveLength(2);
    }
  });

  it("checks the complete ladder corridor even when both floor entrances are clear", () => {
    const clear = empty();
    const blocked: Layout = {
      version: 1,
      furniture: [makeFurniture("shelf", "lounge", 5, 3, "crossing-shelf")],
    };
    const graph = buildGraph(clear);
    const next = updateGraph(graph, clear, blocked);
    const ladder = PASSAGES.find((p) => p.id === "lower-ladder")!;
    for (const entrance of [ladder.a, ladder.b])
      expect(
        bodyClear(
          entrance.roomId,
          entrance.x,
          0,
          next.solids.get(entrance.roomId)!,
        ),
      ).toBe(true);
    expect(passageEdges(next, ladder.id)).toHaveLength(0);
    for (const edge of passageEdges(graph, ladder.id))
      expect(passageClear(edge, next.solids)).toBe(false);
    expect(
      passageEdges(updateGraph(next, blocked, clear), ladder.id),
    ).toHaveLength(2);
  });

  it("checks both retreat directions from an arbitrary point after furniture blocks a ladder", () => {
    const graph = buildGraph(empty());
    const ladder = passageEdges(graph, "lower-ladder").find(
      (edge) => edge.passage?.fromRoomId === "lounge",
    )!;
    const room = roomById("lounge");
    const position = passageWorldPoint(ladder, 0.65);
    const upward = {
      ...ladder,
      sx: (position.x - room.x) / CELL,
      sy: (room.floor - position.y) / CELL,
    };
    const downward = {
      ...upward,
      tx: ladder.sx,
      ty: ladder.sy,
      passage: { ...ladder.passage!, toRoomId: "lounge" },
    };
    for (const [shelfHeight, canContinueUp] of [
      [3, true],
      [6, false],
    ] as const) {
      const blocked = buildGraph({
        version: 1,
        furniture: [
          makeFurniture("shelf", "lounge", 5, shelfHeight, "new-shelf"),
        ],
      });
      expect(passageClear(ladder, blocked.solids)).toBe(false);
      expect(passageSegmentClear(upward, blocked.solids)).toBe(canContinueUp);
      expect(passageSegmentClear(downward, blocked.solids)).toBe(
        !canContinueUp,
      );
    }
    expect(passageClear(upward, graph.solids)).toBe(false);
    expect(
      passageSegmentClear({ ...upward, passage: undefined }, graph.solids),
    ).toBe(false);
  });

  it("only creates passages whose two rooms are included in a partial graph", () => {
    const graph = buildGraph(
      defaultLayout(),
      ROOMS.filter((r) => ["lounge", "bedroom"].includes(r.id)),
    );
    expect(passageEdges(graph).map((e) => e.passage?.id)).toEqual([
      "lower-door",
      "lower-door",
    ]);
    expect([...graph.solids.keys()].sort()).toEqual(["bedroom", "lounge"]);
    for (const edge of graph.edges) {
      expect(graph.surfaces.some((s) => s.id === edge.from)).toBe(true);
      expect(graph.surfaces.some((s) => s.id === edge.to)).toBe(true);
    }
    const after = defaultLayout();
    after.furniture.push(makeFurniture("stool", "lounge", 15, 0, "door-block"));
    const updated = updateGraph(graph, defaultLayout(), after);
    expect([...updated.solids.keys()].sort()).toEqual(["bedroom", "lounge"]);
    expect(passageEdges(updated)).toHaveLength(0);
  });

  it("reconnects once after changes to both ends and removes obsolete thresholds", () => {
    const before = empty();
    const after = defaultLayout();
    const original = buildGraph(before);
    const furnished = updateGraph(original, before, after);
    expect(sorted(furnished.edges)).toEqual(sorted(buildGraph(after).edges));
    expect(passageEdges(furnished)).toHaveLength(PASSAGES.length * 2);
    const cleared = updateGraph(furnished, after, before);
    expect(sorted(cleared.edges)).toEqual(sorted(original.edges));
    expect(sorted(cleared.surfaces)).toEqual(sorted(original.surfaces));
    expect(cleared.surfaces.some((s) => s.id.startsWith("passage:"))).toBe(
      false,
    );
  });

  it("updates match fresh graphs while retaining unaffected local objects and old adjacency", () => {
    const before = defaultLayout();
    const after: Layout = {
      ...before,
      furniture: [
        ...before.furniture,
        makeFurniture("stool", "bedroom", 0, 0, "door-block"),
      ],
    };
    const previous = buildGraph(before);
    const oldLinks = new Map(
      [...previous.adjacency].map(([id, edges]) => [id, [...edges]]),
    );
    const oldEdgeValues = sorted(previous.edges);
    const updated = updateGraph(previous, before, after);
    const rebuilt = buildGraph(after);
    expect(sorted(updated.surfaces)).toEqual(sorted(rebuilt.surfaces));
    expect(sorted(updated.edges)).toEqual(sorted(rebuilt.edges));
    expect(sorted(updated.goals)).toEqual(sorted(rebuilt.goals));
    for (const surface of previous.surfaces.filter(
      (s) => s.roomId !== "bedroom",
    )) {
      expect(updated.surfaces.find((s) => s.id === surface.id)).toBe(surface);
      expect(updated.adjacency.get(surface.id)).not.toBe(
        previous.adjacency.get(surface.id),
      );
    }
    for (const edge of previous.edges.filter(
      (e) =>
        e.kind !== "passage" &&
        previous.surfaces.find((s) => s.id === e.from)?.roomId !== "bedroom",
    ))
      expect(updated.edges).toContain(edge);
    expect(sorted(previous.edges)).toEqual(oldEdgeValues);
    for (const [id, links] of oldLinks)
      expect(previous.adjacency.get(id)).toEqual(links);
    expect(updateGraph(updated, after, after)).toBe(updated);
  });

  it("invalidates routes when passage identity or movement kind changes", () => {
    const graph = buildGraph(defaultLayout());
    const edge = passageEdges(graph)[0];
    expect(findPath(graph, edge.from, edge.to)).not.toBeNull();
    expect(routeValid(graph, [edge])).toBe(true);
    expect(routeValid(graph, [{ ...edge, kind: "walk" }])).toBe(false);
    expect(
      routeValid(graph, [
        { ...edge, passage: { ...edge.passage!, id: "other" } },
      ]),
    ).toBe(false);
    expect(
      routeValid(graph, [
        { ...edge, passage: { ...edge.passage!, toRoomId: "attic" } },
      ]),
    ).toBe(false);
  });
});
