import { CELL, inRoom, roomById, worldPoint } from "./model";
import { ACTIVE_THEME } from "./house-theme";
import type { Edge } from "./navigation";

export interface PassageEntrance {
  roomId: string;
  x: number;
  y: 0;
}

export interface Passage {
  id: string;
  kind: "door" | "ladder" | "stairs";
  a: PassageEntrance;
  b: PassageEntrance;
}

/** Permanent openings belong to the house, independently of movable furniture. */
export const PASSAGES: readonly Passage[] = ACTIVE_THEME.passages;

/** Passage endpoints use their own rooms' coordinates; the crossing is in world space. */
export function passageWorldPoint(edge: Edge, t: number) {
  if (!edge.passage) throw new Error("A passage edge needs room metadata");
  const a = worldPoint(roomById(edge.passage.fromRoomId), edge.sx, edge.sy);
  const b = worldPoint(roomById(edge.passage.toRoomId), edge.tx, edge.ty);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function entranceFits(entrance: PassageEntrance): boolean {
  const room = roomById(entrance.roomId);
  return (
    !!room &&
    inRoom(room, entrance.x - 0.23, entrance.y + 0.04) &&
    inRoom(room, entrance.x + 0.23, entrance.y + 0.62)
  );
}

/** Exact segment/AABB intersection, with the rectangle expanded by the cat body. */
function crossesRectangle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  let first = 0;
  let last = 1;
  for (const [start, end, low, high] of [
    [a.x, b.x, left + 1e-7, right - 1e-7],
    [a.y, b.y, top + 1e-7, bottom - 1e-7],
  ]) {
    const delta = end - start;
    if (Math.abs(delta) < 1e-10) {
      if (start < low || start > high) return false;
    } else {
      const enter = (low - start) / delta;
      const leave = (high - start) / delta;
      first = Math.max(first, Math.min(enter, leave));
      last = Math.min(last, Math.max(enter, leave));
      if (first > last) return false;
    }
  }
  return true;
}

/** Structural openings allow wall/floor crossing; furniture never does. */
export function passageClear(
  edge: Edge,
  solidsByRoom: ReadonlyMap<string, [number, number][]>,
): boolean {
  const metadata = edge.passage;
  const passage = PASSAGES.find((p) => p.id === metadata?.id);
  if (!passage || edge.kind !== "passage" || passage.kind !== metadata?.kind)
    return false;
  const from = passage.a.roomId === metadata.fromRoomId ? passage.a : passage.b;
  const to = from === passage.a ? passage.b : passage.a;
  if (
    from.roomId !== metadata.fromRoomId ||
    to.roomId !== metadata.toRoomId ||
    edge.sx !== from.x ||
    edge.sy !== from.y ||
    edge.tx !== to.x ||
    edge.ty !== to.y ||
    edge.arc !== 0 ||
    !entranceFits(from) ||
    !entranceFits(to)
  )
    return false;
  return passageSegmentClear(edge, solidsByRoom);
}

/** Check an in-progress crossing or retreat without requiring fixed entrances. */
export function passageSegmentClear(
  edge: Edge,
  solidsByRoom: ReadonlyMap<string, [number, number][]>,
): boolean {
  if (
    !edge.passage ||
    !roomById(edge.passage.fromRoomId) ||
    !roomById(edge.passage.toRoomId) ||
    ![edge.sx, edge.sy, edge.tx, edge.ty].every(Number.isFinite)
  )
    return false;
  const a = passageWorldPoint(edge, 0);
  const b = passageWorldPoint(edge, 1);
  for (const [roomId, solids] of solidsByRoom) {
    const room = roomById(roomId);
    if (!room) return false;
    for (const [x, y] of solids) {
      // Match bodyClear's collision margins, expressed around the moving feet.
      const left = room.x + (x + 0.015 - 0.23) * CELL;
      const right = room.x + (x + 0.985 + 0.23) * CELL;
      const top = room.floor - (y + 0.99 - 0.055) * CELL;
      const bottom = room.floor - (y + 0.02 - 0.62) * CELL;
      if (crossesRectangle(a, b, left, top, right, bottom)) return false;
    }
  }
  return true;
}
