import { expect, test } from "vitest";
import {
  CATALOG,
  defaultLayout,
  makeFurniture,
  placementError,
} from "../src/model";
import { buildGraph, findPath } from "../src/navigation";
import { deserializeLayout } from "../src/storage";

test("the expanded catalog keeps the original house and supplies valid support geometry for every style", () => {
  expect(CATALOG).toHaveLength(28);
  expect(new Set(CATALOG.map((d) => d.id)).size).toBe(28);
  expect(defaultLayout().furniture).toHaveLength(22);
  for (const d of CATALOG) {
    const item = makeFurniture(
      d.id,
      "lounge",
      5,
      d.anchor === "ceiling" ? 4 : d.anchor === "wall" ? 3 : 0,
    );
    const layout = { version: 1 as const, furniture: [item] };
    expect(placementError(item, layout), d.id).toBeNull();
    expect(
      buildGraph(layout).surfaces.some((s) => s.owner === item.instanceId),
      d.id,
    ).toBe(true);
    expect(deserializeLayout(JSON.stringify(layout))).toEqual(layout);
    expect(d.category).toBeTruthy();
    expect(d.art).toBeTruthy();
  }
});

test("new cat steps provide an actual connected climbing route in both orientations", () => {
  for (const flipX of [false, true]) {
    const item = { ...makeFurniture("cat-stairs", "lounge", 5), flipX };
    const g = buildGraph({ version: 1, furniture: [item] });
    const surfaces = g.surfaces
      .filter((s) => s.owner === item.instanceId)
      .sort((a, b) => a.y - b.y);
    expect(surfaces).toHaveLength(3);
    expect(findPath(g, surfaces[0].id, surfaces[2].id)).not.toBeNull();
  }
});
