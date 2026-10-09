import type Phaser from "phaser";
import { roomById, worldPoint } from "./model";
import type { Graph } from "./navigation";
import { PASSAGES } from "./passages";
import { ACTIVE_THEME } from "./house-theme";

type Point = { x: number; y: number };
type Graphics = Phaser.GameObjects.Graphics;

const illustrated = ACTIVE_THEME.id !== "original";
const WOOD = illustrated ? 0x9d6934 : 0xb79672;
const WOOD_LIGHT = illustrated ? 0xd3a363 : 0xdec291;
const WOOD_DARK = illustrated ? 0x4e301c : 0x745c45;
const SHADOW = illustrated ? 0x251e18 : 0x293f3d;

function doorway(
  g: Graphics,
  a: Point,
  b: Point,
  leftColor: number,
  rightColor: number,
) {
  const floor = a.y;
  const width = 16;
  const left = (a.x + b.x - width) / 2;
  const top = floor - 52;

  // A door through a side wall appears as an interruption in its cut edge.
  // Continue the rear walls and floor through it; show only the lintel's end.
  g.fillStyle(leftColor).fillRect(left, top, width / 2, 52);
  g.fillStyle(rightColor).fillRect(left + width / 2, top, width / 2, 52);
  g.fillStyle(0x526961, 0.24).fillRect(left, floor - 35, width, 35);
  g.lineStyle(2, 0x657971, 0.5).lineBetween(
    left,
    floor - 35,
    left + width,
    floor - 35,
  );
  g.fillStyle(WOOD_DARK).fillRect(left - 2, top - 5, width + 4, 5);
  g.fillStyle(WOOD_LIGHT, 0.75).fillRect(left - 1, top - 5, width + 2, 1);
  g.fillStyle(SHADOW, 0.3).fillRect(left, top, width, 3);
  g.fillStyle(0xdec291).fillRect(left, floor, width, 7);
  g.fillStyle(0x9b7755).fillRect(left, floor + 7, width, 9);
}

function ladder(g: Graphics, lower: Point, upper: Point) {
  const halfWidth = 11;
  const height = lower.y - upper.y;

  // The hatch darkens just the thickness of the upper floor, leaving an
  // actual-looking opening where the climbing cat comes through.
  g.fillStyle(SHADOW).fillRect(upper.x - 18, upper.y, 36, 16);
  g.fillStyle(0x162f31).fillRect(upper.x - 14, upper.y + 2, 28, 10);
  for (const side of [-1, 1]) {
    const x = upper.x + side * 19;
    g.fillStyle(WOOD_DARK).fillRect(x - 3, upper.y + 3, 6, 14);
    g.fillStyle(WOOD_LIGHT).fillRect(x - 4, upper.y - 1, 8, 4);
  }
  g.lineStyle(2, WOOD_DARK).lineBetween(
    upper.x - 15,
    upper.y + 15,
    upper.x + 15,
    upper.y + 15,
  );

  const steps = Math.floor(height / 15);
  for (let step = 1; step < steps; step++) {
    const t = step / steps;
    const x = lower.x + (upper.x - lower.x) * t;
    const y = lower.y + (upper.y - lower.y) * t;
    g.lineStyle(4, SHADOW, 0.5).lineBetween(x - 11, y + 2, x + 13, y + 2);
    g.lineStyle(3, WOOD_DARK).lineBetween(x - 11, y, x + 11, y);
    g.lineStyle(2, WOOD).lineBetween(x - 10, y - 1, x + 10, y - 1);
    g.lineStyle(1, WOOD_LIGHT, 0.8).lineBetween(x - 9, y - 2, x + 9, y - 2);
  }
  for (const side of [-1, 1]) {
    const bottomX = lower.x + side * halfWidth;
    const topX = upper.x + side * halfWidth;
    g.lineStyle(7, SHADOW, 0.35).lineBetween(
      bottomX + 2,
      lower.y,
      topX + 2,
      upper.y - 4,
    );
    g.lineStyle(6, WOOD_DARK).lineBetween(bottomX, lower.y, topX, upper.y - 5);
    g.lineStyle(4, WOOD).lineBetween(bottomX, lower.y - 1, topX, upper.y - 5);
    g.lineStyle(1, WOOD_LIGHT, 0.8).lineBetween(
      bottomX - 1,
      lower.y - 3,
      topX - 1,
      upper.y - 4,
    );
    g.fillStyle(0xd6b580)
      .fillCircle(bottomX, lower.y - 8, 1.2)
      .fillCircle(topX, upper.y + 7, 1.2);
  }
}

function blockedMarker(g: Graphics, x: number, y: number) {
  g.fillStyle(SHADOW, 0.8).fillCircle(x, y, 7);
  g.fillStyle(0xe6b56d).fillCircle(x, y, 5);
  g.lineStyle(2, WOOD_DARK).lineBetween(x - 2.5, y, x + 2.5, y);
}

/** Fixed fixtures stay visible even when furniture temporarily blocks a route. */
export function paintPassages(g: Graphics, graph: Graph, edit: boolean): void {
  g.clear();
  const open = new Set(
    graph.edges.flatMap((e) => (e.passage ? [e.passage.id] : [])),
  );
  for (const passage of PASSAGES) {
    const a = worldPoint(roomById(passage.a.roomId), passage.a.x, passage.a.y);
    const b = worldPoint(roomById(passage.b.roomId), passage.b.x, passage.b.y);
    if (passage.kind === "door") {
      if (!illustrated)
        doorway(
          g,
          a,
          b,
          roomById(passage.a.roomId).color,
          roomById(passage.b.roomId).color,
        );
      if (edit && !open.has(passage.id))
        blockedMarker(g, (a.x + b.x) / 2, a.y - 64);
    } else {
      const lower = a.y > b.y ? a : b;
      const upper = a.y > b.y ? b : a;
      // The ramen staircase is part of its Aseprite architectural plate.
      if (!illustrated && passage.kind === "ladder") ladder(g, lower, upper);
      if (edit && !open.has(passage.id))
        blockedMarker(g, upper.x + 28, upper.y + 26);
    }
  }
}
