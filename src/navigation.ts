import {
  ROOMS,
  CELL,
  cellsOf,
  defById,
  inRoom,
  roomById,
  type Layout,
  type Action,
} from "./model";
import {
  PASSAGES,
  passageClear,
  passageWorldPoint,
  type PassageEntrance,
} from "./passages";
export interface Surface {
  id: string;
  roomId: string;
  owner?: string;
  x0: number;
  x1: number;
  y: number;
  capacity: number;
  actions: Action[];
}
export interface Edge {
  from: string;
  to: string;
  sx: number;
  tx: number;
  sy: number;
  ty: number;
  arc: number;
  kind: "walk" | "jump" | "drop" | "passage";
  passage?: {
    id: string;
    kind: "door" | "ladder" | "stairs";
    fromRoomId: string;
    toRoomId: string;
  };
  cost: number;
}
export interface Goal {
  key: string;
  surfaceId: string;
  x: number;
  action: Action;
  interaction?: {
    furnitureId: string;
    kind: "scratch" | "hide";
    facing: 1 | -1;
    targetX: number;
    targetY: number;
  };
}
export interface Graph {
  surfaces: Surface[];
  edges: Edge[];
  adjacency: Map<string, Edge[]>;
  solids: Map<string, [number, number][]>;
  goals: Goal[];
}
export const ABILITY = { maxJumpUp: 3, maxJumpAcross: 4.6, maxDrop: 6 };
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export function bodyClear(
  roomId: string,
  x: number,
  y: number,
  solids: [number, number][],
): boolean {
  const r = roomById(roomId),
    half = 0.23,
    h = 0.62;
  if (!inRoom(r, x - half, y + 0.04) || !inRoom(r, x + half, y + h))
    return false;
  return !solids.some(
    ([a, b]) =>
      x + half > a + 0.015 &&
      x - half < a + 0.985 &&
      y + h > b + 0.02 &&
      y + 0.055 < b + 0.99,
  );
}
export function arcPoint(e: Edge, t: number) {
  return {
    x: e.sx + (e.tx - e.sx) * t,
    y: e.sy + (e.ty - e.sy) * t + 4 * e.arc * t * (1 - t),
  };
}
export function arcClear(
  e: Edge,
  roomId: string,
  solids: [number, number][],
  solidsByRoom?: ReadonlyMap<string, [number, number][]>,
): boolean {
  if (e.kind === "passage")
    return passageClear(e, solidsByRoom ?? new Map([[roomId, solids]]));
  const dx = e.tx - e.sx;
  const dy = e.ty - e.sy;
  const apex = e.arc === 0 ? 0 : 0.5 + dy / (8 * e.arc);
  // Room boundaries (including both roof slopes) are quadratic along an arc.
  // Endpoints and their extrema cover them continuously, without sampling gaps.
  const boundaryTimes = [0, 1];
  if (e.arc !== 0)
    boundaryTimes.push(
      clamp(apex, 0, 1),
      clamp(0.5 + (2 * dy - dx) / (16 * e.arc), 0, 1),
      clamp(0.5 + (2 * dy + dx) / (16 * e.arc), 0, 1),
    );
  for (const t of boundaryTimes) {
    const p = arcPoint(e, t);
    if (!bodyClear(roomId, p.x, p.y, [])) return false;
  }
  for (const [x, y] of solids) {
    // Solve the interval of horizontal body overlap with this furniture cell.
    const left = x + 0.015 - 0.23;
    const right = x + 0.985 + 0.23;
    let first = 0;
    let last = 1;
    if (Math.abs(dx) < 1e-10) {
      if (e.sx <= left || e.sx >= right) continue;
    } else {
      const enter = (left - e.sx) / dx;
      const leave = (right - e.sx) / dx;
      first = Math.max(0, Math.min(enter, leave));
      last = Math.min(1, Math.max(enter, leave));
      if (first >= last) continue;
    }
    // The continuous quadratic visits every height between these extrema.
    const heights = [arcPoint(e, first).y, arcPoint(e, last).y];
    if (apex > first && apex < last) heights.push(arcPoint(e, apex).y);
    if (
      Math.max(...heights) > y + 0.02 - 0.62 &&
      Math.min(...heights) < y + 0.99 - 0.055
    )
      return false;
  }
  return true;
}
function samples(s: Surface) {
  const margin = Math.min(0.26, (s.x1 - s.x0) / 2);
  return [s.x0 + margin, (s.x0 + s.x1) / 2, s.x1 - margin];
}
export function connect(
  a: Surface,
  b: Surface,
  solids: [number, number][],
): Edge | null {
  if (a.roomId !== b.roomId || a.id === b.id) return null;
  const dy = b.y - a.y;
  if (dy > ABILITY.maxJumpUp || dy < -ABILITY.maxDrop) return null;
  const pairs: [number, number][] = [];
  const aMargin = Math.min(0.26, (a.x1 - a.x0) / 2);
  const bMargin = Math.min(0.26, (b.x1 - b.x0) / 2);
  for (const x of samples(a))
    pairs.push([x, clamp(x, b.x0 + bMargin, b.x1 - bMargin)]);
  for (const x of samples(b))
    pairs.push([clamp(x, a.x0 + aMargin, a.x1 - aMargin), x]);
  pairs.sort((p, q) => Math.abs(p[0] - p[1]) - Math.abs(q[0] - q[1]));
  for (const [sx, tx] of pairs) {
    const dx = Math.abs(tx - sx);
    if (dx > ABILITY.maxJumpAcross) continue;
    const kind =
      dy < -0.1 ? "drop" : Math.abs(dy) < 0.05 && dx < 0.7 ? "walk" : "jump";
    for (const arc of kind === "walk"
      ? [0]
      : [
          Math.max(0.85, Math.abs(dy) * 0.35 + 0.7),
          Math.abs(dy) / 4 + 0.12,
          1.55,
          2.1,
        ]) {
      const e: Edge = {
        from: a.id,
        to: b.id,
        sx,
        tx,
        sy: a.y,
        ty: b.y,
        arc,
        kind,
        cost: dx + Math.abs(dy) * 1.5 + 1,
      };
      if (arcClear(e, a.roomId, solids)) return e;
    }
  }
  return null;
}

function entranceSurface(graph: Graph, entrance: PassageEntrance) {
  return graph.surfaces.find(
    (s) =>
      s.roomId === entrance.roomId &&
      !s.owner &&
      s.y === entrance.y &&
      entrance.x >= s.x0 + 0.23 &&
      entrance.x <= s.x1 - 0.23,
  );
}

function addThresholds(graph: Graph) {
  for (const passage of PASSAGES)
    for (const [side, entrance] of [
      ["a", passage.a],
      ["b", passage.b],
    ] as const) {
      const solids = graph.solids.get(entrance.roomId);
      if (!solids || entranceSurface(graph, entrance)) continue;
      // Narrow doorway landings are travel-only surfaces. Keep the usual
      // minimum width for furniture and activity destinations unchanged.
      if (
        entrance.y === 0 &&
        [-0.01, 0, 0.01].every((offset) =>
          bodyClear(entrance.roomId, entrance.x + offset, 0, solids),
        )
      )
        graph.surfaces.push({
          id: `passage:${passage.id}:${side}`,
          roomId: entrance.roomId,
          x0: entrance.x - 0.25,
          x1: entrance.x + 0.25,
          y: 0,
          capacity: 1,
          actions: [],
        });
    }
}

function addPassageEdges(graph: Graph) {
  for (const passage of PASSAGES) {
    const a = entranceSurface(graph, passage.a);
    const b = entranceSurface(graph, passage.b);
    if (!a || !b) continue;
    for (const [from, to, start, end] of [
      [a, b, passage.a, passage.b],
      [b, a, passage.b, passage.a],
    ] as const) {
      const edge: Edge = {
        from: from.id,
        to: to.id,
        sx: start.x,
        sy: start.y,
        tx: end.x,
        ty: end.y,
        arc: 0,
        kind: "passage",
        cost: 0,
        passage: {
          id: passage.id,
          kind: passage.kind,
          fromRoomId: start.roomId,
          toRoomId: end.roomId,
        },
      };
      if (!passageClear(edge, graph.solids)) continue;
      const p = passageWorldPoint(edge, 0);
      const q = passageWorldPoint(edge, 1);
      edge.cost =
        (Math.hypot(q.x - p.x, q.y - p.y) / CELL) *
          (passage.kind === "ladder"
            ? 1.7
            : passage.kind === "stairs"
              ? 1.3
              : 1) +
        1;
      graph.edges.push(edge);
      graph.adjacency.get(from.id)!.push(edge);
    }
  }
}

function addFurnitureInteractions(graph: Graph, layout: Layout) {
  for (const furniture of layout.furniture) {
    const definition = defById(furniture.definitionId);
    const kind = definition.interaction;
    if (!kind || furniture.gridY !== 0) continue;
    const solids = graph.solids.get(furniture.roomId);
    if (!solids) continue;
    for (const facing of [1, -1] as const) {
      // These are approach positions, on the real floor beside the prop. The
      // renderer uses the target to point paws at a post or enter a hideaway.
      const margin = kind === "scratch" ? 0 : 0.5;
      const x =
        facing === 1
          ? furniture.gridX - margin
          : furniture.gridX + definition.width + margin;
      const surface = graph.surfaces.find(
        (surface) =>
          surface.roomId === furniture.roomId &&
          !surface.owner &&
          surface.y === 0 &&
          x >= surface.x0 + 0.23 &&
          x <= surface.x1 - 0.23,
      );
      if (!surface || !bodyClear(furniture.roomId, x, 0, solids)) continue;
      graph.goals.push({
        key: `${furniture.instanceId}:approach:${facing}`,
        surfaceId: surface.id,
        x,
        action: kind,
        interaction: {
          furnitureId: furniture.instanceId,
          kind,
          facing,
          targetX:
            furniture.gridX +
            definition.width *
              (kind === "hide" ? (furniture.flipX ? 0.65 : 0.35) : 0.5),
          targetY:
            kind === "hide" ? 0 : Math.min(1.1, definition.height * 0.65),
        },
      });
    }
  }
}

export function buildGraph(layout: Layout, rooms = ROOMS): Graph {
  const graph: Graph = {
    surfaces: [],
    edges: [],
    adjacency: new Map(),
    solids: new Map(),
    goals: [],
  };
  for (const r of rooms) {
    const furniture = layout.furniture.filter((f) => f.roomId === r.id);
    const solids = furniture.flatMap(cellsOf);
    graph.solids.set(r.id, solids);
    const raw: Omit<Surface, "capacity">[] = [
      {
        id: `${r.id}:floor`,
        roomId: r.id,
        x0: 0,
        x1: r.width,
        y: 0,
        actions: ["idle", "sit", "groom", "play"],
      },
    ];
    for (const f of furniture) {
      const d = defById(f.definitionId);
      d.surfaces.forEach((s, i) => {
        const x = f.gridX + (f.flipX ? d.width - s.x - s.width : s.x);
        raw.push({
          id: `${f.instanceId}:${i}`,
          owner: f.instanceId,
          roomId: r.id,
          x0: x,
          x1: x + s.width,
          y: f.gridY + s.y,
          actions: s.actions,
        });
      });
    }
    for (const s of raw) {
      // Split at quarter-cell resolution, including a shorter final interval.
      // Always visit the exact endpoint to flush a clear run on inset seats and
      // other supports whose width is not a multiple of a quarter cell.
      let start: number | null = null,
        part = 0;
      const intervals = Math.ceil((s.x1 - s.x0) / 0.25);
      for (let step = 0; step <= intervals; step++) {
        const x = Math.min(s.x1, s.x0 + step * 0.25);
        const end = Math.min(s.x1, x + 0.25);
        const legal =
          x < s.x1 - 1e-8 && bodyClear(r.id, (x + end) / 2, s.y, solids);
        if (legal && start === null) start = x;
        if (!legal && start !== null) {
          if (x - start >= 0.75)
            graph.surfaces.push({
              ...s,
              id: `${s.id}:${part++}`,
              x0: start,
              x1: x,
              capacity: Math.max(1, Math.floor((x - start) / 1.3)),
            });
          start = null;
        }
      }
    }
  }
  addThresholds(graph);
  for (const a of graph.surfaces) {
    const links: Edge[] = [];
    for (const b of graph.surfaces) {
      const e = connect(a, b, graph.solids.get(a.roomId)!);
      if (e) {
        links.push(e);
        graph.edges.push(e);
      }
    }
    graph.adjacency.set(a.id, links);
    const slots = Math.max(1, Math.floor((a.x1 - a.x0) / 1.3));
    for (let i = 0; i < slots; i++)
      for (const action of a.actions)
        graph.goals.push({
          key: `${a.id}@${i}`,
          surfaceId: a.id,
          x: a.x0 + ((i + 0.5) * (a.x1 - a.x0)) / slots,
          action,
        });
  }
  addPassageEdges(graph);
  addFurnitureInteractions(graph, layout);
  return graph;
}
export function findPath(g: Graph, from: string, to: string): Edge[] | null {
  if (from === to) return [];
  const dist = new Map([[from, 0]]),
    previous = new Map<string, Edge>(),
    queue = new Set([from]);
  while (queue.size) {
    const current = [...queue].sort((a, b) => dist.get(a)! - dist.get(b)!)[0];
    queue.delete(current);
    if (current === to) break;
    for (const e of g.adjacency.get(current) ?? []) {
      const d = dist.get(current)! + e.cost;
      if (d < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, d);
        previous.set(e.to, e);
        queue.add(e.to);
      }
    }
  }
  if (!previous.has(to)) return null;
  const path: Edge[] = [];
  let cur = to;
  while (cur !== from) {
    const e = previous.get(cur)!;
    path.unshift(e);
    cur = e.from;
  }
  return path;
}
export function routeValid(g: Graph, path: Edge[]): boolean {
  return path.every((e) =>
    g.edges.some(
      (n) =>
        n.from === e.from &&
        n.to === e.to &&
        n.sx === e.sx &&
        n.tx === e.tx &&
        n.sy === e.sy &&
        n.ty === e.ty &&
        n.arc === e.arc &&
        n.kind === e.kind &&
        n.passage?.id === e.passage?.id &&
        n.passage?.kind === e.passage?.kind &&
        n.passage?.fromRoomId === e.passage?.fromRoomId &&
        n.passage?.toRoomId === e.passage?.toRoomId,
    ),
  );
}

/** Reuse unchanged rooms while reconnecting passages against both rooms' solids. */
export function updateGraph(
  previous: Graph,
  before: Layout,
  after: Layout,
): Graph {
  const changed = new Set(
    ROOMS.filter(
      (r) =>
        previous.solids.has(r.id) &&
        JSON.stringify(before.furniture.filter((f) => f.roomId === r.id)) !==
          JSON.stringify(after.furniture.filter((f) => f.roomId === r.id)),
    ).map((r) => r.id),
  );
  if (!changed.size) return previous;
  const fresh = buildGraph(
    after,
    ROOMS.filter((r) => changed.has(r.id)),
  );
  const retained = previous.surfaces.filter((s) => !changed.has(s.roomId));
  const ids = new Set(retained.map((s) => s.id));
  fresh.surfaces.push(...retained);
  fresh.edges = fresh.edges.filter((e) => e.kind !== "passage");
  fresh.edges.push(
    ...previous.edges.filter((e) => e.kind !== "passage" && ids.has(e.from)),
  );
  fresh.goals.push(...previous.goals.filter((g) => ids.has(g.surfaceId)));
  // Copy each adjacency array: adding/replacing cross-room edges must not
  // mutate a previous graph still used by a cat's route or an editor snapshot.
  for (const [id, edges] of fresh.adjacency)
    fresh.adjacency.set(
      id,
      edges.filter((e) => e.kind !== "passage"),
    );
  for (const s of retained)
    fresh.adjacency.set(
      s.id,
      previous.adjacency.get(s.id)!.filter((e) => e.kind !== "passage"),
    );
  for (const [r, cells] of previous.solids)
    if (!changed.has(r)) fresh.solids.set(r, cells);
  addPassageEdges(fresh);
  return fresh;
}

export function reachableSurfaces(graph: Graph, start: string): Set<string> {
  const seen = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const edge of graph.adjacency.get(queue[i]) ?? []) {
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return seen;
}
