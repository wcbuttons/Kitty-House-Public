import { ACTIVE_THEME } from "./house-theme";
import { CABIN_V2_CATALOG } from "./cabin-v2";
import { RAMEN_V2_CATALOG } from "./ramen-v2";

export const CELL = 26;
export const WORLD = ACTIVE_THEME.world ?? { width: 1120, height: 790 };
export type Action =
  "idle" | "sit" | "sleep" | "groom" | "scratch" | "perch" | "hide" | "play";
export type Anchor = "floor" | "wall" | "ceiling";
export interface Room {
  id: string;
  name: string;
  x: number;
  floor: number;
  width: number;
  height: number;
  color: number;
  attic?: boolean;
  outdoor?: boolean;
}
export const ROOMS: Room[] = ACTIVE_THEME.rooms.map((room) => ({ ...room }));
export const roomById = (id: string) => ROOMS.find((r) => r.id === id)!;
export const worldPoint = (room: Room, x: number, y: number) => ({
  x: room.x + x * CELL,
  y: room.floor - y * CELL,
});
export function inRoom(room: Room, x: number, y: number): boolean {
  if (x < 0 || x > room.width || y < 0 || y > room.height) return false;
  return !room.attic || (x >= y * 2 && x <= room.width - y * 2);
}
export interface SurfaceDef {
  x: number;
  y: number;
  width: number;
  actions: Action[];
}
export type FurnitureCategory =
  "Comfort" | "Climbing" | "Tables" | "Storage" | "Play";
export type FurnitureArt =
  | "box"
  | "crate"
  | "couch"
  | "bed"
  | "shelf"
  | "table"
  | "bookcase"
  | "scratcher"
  | "cat-tree"
  | "cushion"
  | "cabinet"
  | "tunnel"
  | "stairs"
  | "books";
export interface FurnitureDef {
  category: FurnitureCategory;
  art: FurnitureArt;
  id: string;
  name: string;
  width: number;
  height: number;
  anchor: Anchor;
  color: number;
  canFlip: boolean;
  surfaces: SurfaceDef[];
  cells?: [number, number][];
  /** Visual occupancy for editing, independent of the solids cats stand on. */
  placementCells?: [number, number][];
  description: string;
  interaction?: "scratch" | "hide";
}
const top = (
  width: number,
  height: number,
  actions: Action[],
): SurfaceDef[] => [{ x: 0, y: height, width, actions }];
const BASE_CATALOG: FurnitureDef[] = [
  {
    id: "box",
    category: "Play",
    art: "box",
    name: "Cardboard box",
    width: 2,
    height: 1,
    anchor: "floor",
    color: 0xc79e6e,
    canFlip: true,
    surfaces: top(2, 1, ["sit"]),
    interaction: "hide",
    description: "A little hideaway",
  },
  {
    id: "crate",
    category: "Storage",
    art: "crate",
    name: "Small crate",
    width: 2,
    height: 1,
    anchor: "floor",
    color: 0x9c795d,
    canFlip: true,
    surfaces: top(2, 1, ["sit", "groom"]),
    description: "One step closer",
  },
  {
    id: "large-crate",
    category: "Climbing",
    art: "crate",
    name: "Tall crate",
    width: 2,
    height: 2,
    anchor: "floor",
    color: 0xb78e64,
    canFlip: true,
    surfaces: top(2, 2, ["perch", "groom"]),
    description: "A useful stepping stone",
  },
  {
    id: "couch",
    category: "Comfort",
    art: "couch",
    name: "Velvet sofa",
    width: 4,
    height: 2,
    anchor: "floor",
    color: 0xd27858,
    canFlip: true,
    surfaces: top(4, 2, ["sit", "sleep", "groom"]),
    description: "Room for two",
  },
  {
    id: "bed",
    category: "Comfort",
    art: "bed",
    name: "Day bed",
    width: 4,
    height: 1,
    anchor: "floor",
    color: 0xe0b95f,
    canFlip: true,
    surfaces: top(4, 1, ["sleep", "sit"]),
    description: "Made for long naps",
  },
  {
    id: "shelf",
    category: "Climbing",
    art: "shelf",
    name: "Wall shelf",
    width: 3,
    height: 1,
    anchor: "wall",
    color: 0xb58159,
    canFlip: true,
    surfaces: top(3, 1, ["perch", "sit"]),
    description: "Attaches to the back wall",
  },
  {
    id: "table",
    category: "Tables",
    art: "table",
    name: "Oak table",
    width: 3,
    height: 2,
    anchor: "floor",
    color: 0xb68d63,
    canFlip: true,
    surfaces: top(3, 2, ["sit", "groom"]),
    description: "A broad landing spot",
  },
  {
    id: "stool",
    category: "Tables",
    art: "table",
    name: "Little stool",
    width: 1,
    height: 1,
    anchor: "floor",
    color: 0xcc9d61,
    canFlip: false,
    surfaces: top(1, 1, ["sit"]),
    description: "A tiny first step",
  },
  {
    id: "bookcase",
    category: "Storage",
    art: "bookcase",
    name: "Bookcase",
    width: 3,
    height: 4,
    anchor: "floor",
    color: 0x8c6852,
    canFlip: true,
    surfaces: top(3, 4, ["perch", "sleep"]),
    description: "For ambitious climbers",
  },
  {
    id: "scratcher",
    category: "Play",
    art: "scratcher",
    name: "Scratch post",
    width: 2,
    height: 2,
    anchor: "floor",
    color: 0xc6b79b,
    canFlip: false,
    cells: [
      [0.5, 0],
      [0.5, 1],
    ],
    surfaces: [{ x: 0.5, y: 2, width: 1, actions: [] }],
    interaction: "scratch",
    description: "Stretch, scratch, repeat",
  },
  {
    id: "cat-tree",
    category: "Climbing",
    art: "cat-tree",
    name: "Cat tree",
    width: 4,
    height: 5,
    anchor: "floor",
    color: 0x829c7a,
    canFlip: true,
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 1],
      [1, 2],
      [2, 2],
      [3, 2],
      [3, 3],
      [2, 4],
      [3, 4],
    ],
    surfaces: [
      { x: 0, y: 1, width: 1, actions: ["sit"] },
      { x: 1, y: 3, width: 1, actions: ["groom"] },
      { x: 2, y: 5, width: 2, actions: ["perch", "sleep"] },
    ],
    description: "Three floors of adventure",
  },
  {
    id: "window-perch",
    category: "Climbing",
    art: "shelf",
    name: "Window perch",
    width: 3,
    height: 1,
    anchor: "wall",
    color: 0x648d87,
    canFlip: true,
    surfaces: top(3, 1, ["perch", "groom"]),
    description: "A view worth the climb",
  },
  {
    id: "hammock",
    category: "Comfort",
    art: "shelf",
    name: "Ceiling hammock",
    width: 3,
    height: 1,
    anchor: "ceiling",
    color: 0xc48c72,
    canFlip: true,
    surfaces: top(3, 1, ["sleep", "sit"]),
    description: "Hangs two cells below the ceiling",
  },
  {
    id: "armchair",
    name: "Reading armchair",
    category: "Comfort",
    art: "couch",
    width: 2,
    height: 2,
    anchor: "floor",
    color: 10386841,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 2,
        width: 2,
        actions: ["sit", "sleep"],
      },
    ],
    description: "A soft spot for one",
  },
  {
    id: "ottoman",
    name: "Round ottoman",
    category: "Comfort",
    art: "cushion",
    width: 2,
    height: 1,
    anchor: "floor",
    color: 7841437,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 1,
        width: 2,
        actions: ["sit", "groom"],
      },
    ],
    description: "A low, cushioned stepping stone",
  },
  {
    id: "floor-cushion",
    name: "Floor cushion",
    category: "Comfort",
    art: "cushion",
    width: 2,
    height: 1,
    anchor: "floor",
    color: 14066030,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 1,
        width: 2,
        actions: ["sleep", "sit"],
      },
    ],
    description: "A sunny little napping spot",
  },
  {
    id: "wide-sofa",
    name: "Family sofa",
    category: "Comfort",
    art: "couch",
    width: 5,
    height: 2,
    anchor: "floor",
    color: 6851729,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 2,
        width: 5,
        actions: ["sit", "sleep", "groom"],
      },
    ],
    description: "A generous landing for several cats",
  },
  {
    id: "pet-bed",
    name: "Little cat bed",
    category: "Comfort",
    art: "bed",
    width: 3,
    height: 1,
    anchor: "floor",
    color: 11769777,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 1,
        width: 3,
        actions: ["sleep", "sit"],
      },
    ],
    description: "A cozy place to curl up",
  },
  {
    id: "bench",
    name: "Wooden bench",
    category: "Tables",
    art: "table",
    width: 3,
    height: 1,
    anchor: "floor",
    color: 10788210,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 1,
        width: 3,
        actions: ["sit", "groom"],
      },
    ],
    description: "A wide first step off the floor",
  },
  {
    id: "side-table",
    name: "Side table",
    category: "Tables",
    art: "table",
    width: 2,
    height: 2,
    anchor: "floor",
    color: 11370853,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 2,
        width: 2,
        actions: ["sit", "perch"],
      },
    ],
    description: "A compact elevated landing",
  },
  {
    id: "low-cabinet",
    name: "Low cabinet",
    category: "Storage",
    art: "cabinet",
    width: 3,
    height: 2,
    anchor: "floor",
    color: 7444621,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 2,
        width: 3,
        actions: ["sit", "groom"],
      },
    ],
    description: "Cupboards below, cat seating above",
  },
  {
    id: "dresser",
    name: "Three-drawer dresser",
    category: "Storage",
    art: "cabinet",
    width: 3,
    height: 3,
    anchor: "floor",
    color: 11829347,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 3,
        width: 3,
        actions: ["perch", "sleep"],
      },
    ],
    description: "A taller destination reached by another piece",
  },
  {
    id: "book-stack",
    name: "Stack of books",
    category: "Climbing",
    art: "books",
    width: 1,
    height: 2,
    anchor: "floor",
    color: 10850672,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 2,
        width: 1,
        actions: ["sit", "perch"],
      },
    ],
    description: "A narrow step for a small gap",
  },
  {
    id: "toy-chest",
    name: "Toy chest",
    category: "Play",
    art: "box",
    width: 3,
    height: 1,
    anchor: "floor",
    color: 12294241,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 1,
        width: 3,
        actions: ["play", "sit"],
      },
    ],
    description: "A favorite place to claim and play",
    interaction: "hide",
  },
  {
    id: "play-tunnel",
    name: "Play tunnel",
    category: "Play",
    art: "tunnel",
    width: 3,
    height: 1,
    anchor: "floor",
    color: 7837857,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 1,
        width: 3,
        actions: ["play"],
      },
    ],
    description: "A covered hideaway with a usable top",
    interaction: "hide",
  },
  {
    id: "long-shelf",
    name: "Long wall shelf",
    category: "Climbing",
    art: "shelf",
    width: 5,
    height: 1,
    anchor: "wall",
    color: 12883300,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 1,
        width: 5,
        actions: ["perch", "sit", "groom"],
      },
    ],
    description: "A broad bridge between climbing routes",
  },
  {
    id: "step-shelf",
    name: "Little wall step",
    category: "Climbing",
    art: "shelf",
    width: 2,
    height: 1,
    anchor: "wall",
    color: 10853751,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 1,
        width: 2,
        actions: ["perch", "sit"],
      },
    ],
    description: "Fill a missing step on the back wall",
  },
  {
    id: "cat-stairs",
    name: "Cat steps",
    category: "Climbing",
    art: "stairs",
    width: 3,
    height: 3,
    anchor: "floor",
    color: 10858120,
    canFlip: true,
    surfaces: [
      {
        x: 0,
        y: 1,
        width: 1,
        actions: ["sit", "perch"],
      },
      {
        x: 1,
        y: 2,
        width: 1,
        actions: ["sit", "perch"],
      },
      {
        x: 2,
        y: 3,
        width: 1,
        actions: ["sit", "perch"],
      },
    ],
    description: "Three connected steps for an easy climb",
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
  },
];
const RAMEN_CATALOG: FurnitureDef[] = [
  {
    id: "ramen-counter",
    name: "Ramen counter",
    category: "Tables",
    art: "cabinet",
    width: 8,
    height: 4,
    anchor: "floor",
    color: 0xb77846,
    canFlip: true,
    surfaces: top(8, 4, ["sit", "groom", "perch"]),
    description: "A long wooden counter, reached by a nearby stool",
  },
  {
    id: "ramen-stool",
    name: "Counter stool",
    category: "Climbing",
    art: "table",
    width: 1,
    height: 3,
    anchor: "floor",
    color: 0x9a6040,
    canFlip: false,
    surfaces: top(1, 3, ["sit", "perch"]),
    description: "A tall first step to the ramen counter",
  },
  {
    id: "bowl-rack",
    name: "Bowl rack",
    category: "Storage",
    art: "bookcase",
    width: 4,
    height: 3,
    anchor: "wall",
    color: 0x765643,
    canFlip: true,
    surfaces: top(4, 3, ["perch", "groom"]),
    description: "A wall cabinet with room for a watchful cat on top",
  },
  {
    id: "futon",
    name: "Quilted futon",
    category: "Comfort",
    art: "bed",
    width: 5,
    height: 1,
    anchor: "floor",
    color: 0xa76250,
    canFlip: true,
    surfaces: top(5, 1, ["sleep", "sit", "groom"]),
    description: "A wide, quiet place to curl up upstairs",
  },
  {
    id: "noodle-table",
    name: "Noodle table",
    category: "Tables",
    art: "table",
    width: 3,
    height: 3,
    anchor: "floor",
    color: 0xbb925e,
    canFlip: true,
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    surfaces: top(3, 3, ["sit", "groom", "perch"]),
    description: "A small dining table with a sheltered space beneath",
  },
  {
    id: "planter",
    name: "Garden planter",
    category: "Play",
    art: "crate",
    width: 2,
    height: 2,
    anchor: "floor",
    color: 0x8d6950,
    canFlip: true,
    surfaces: [],
    description: "Leafy terrace decoration; give cats a bench beside it",
  },
];
export const TOWER_CATALOG: FurnitureDef[] = [
  {
    id: "tower-travel-chest",
    name: "Wayfarer's chest",
    category: "Play",
    art: "box",
    width: 3,
    height: 1,
    anchor: "floor",
    color: 0x896746,
    canFlip: true,
    surfaces: top(3, 1, ["sit", "play"]),
    interaction: "hide",
    description: "A brass-bound traveling chest with a cat-sized hideaway",
  },
  {
    id: "tower-potion-desk",
    name: "Potion desk",
    category: "Tables",
    art: "table",
    width: 4,
    height: 2,
    anchor: "floor",
    color: 0x937151,
    canFlip: true,
    surfaces: top(4, 2, ["sit", "perch", "groom"]),
    description: "A broad wooden worktop beside the wizard's ingredients",
  },
  {
    id: "tower-alchemy-cabinet",
    name: "Alchemy cabinet",
    category: "Storage",
    art: "cabinet",
    width: 3,
    height: 3,
    anchor: "floor",
    color: 0x647b72,
    canFlip: true,
    surfaces: top(3, 3, ["perch", "sit"]),
    description: "Bottles safely below, a clear lookout above",
  },
  {
    id: "tower-herb-shelf",
    name: "Apothecary shelf",
    category: "Climbing",
    art: "shelf",
    width: 3,
    height: 1,
    anchor: "wall",
    color: 0x998557,
    canFlip: true,
    surfaces: top(3, 1, ["perch", "sit"]),
    description: "A carved wall shelf with herbs hanging beneath its landing",
  },
  {
    id: "tower-arcane-bookcase",
    name: "Spellbook bookcase",
    category: "Storage",
    art: "bookcase",
    width: 3,
    height: 3,
    anchor: "floor",
    color: 0x75618b,
    canFlip: true,
    surfaces: top(3, 3, ["perch", "sleep"]),
    description: "Old spellbooks beneath a quiet elevated napping spot",
  },
  {
    id: "tower-book-stack",
    name: "Stack of grimoires",
    category: "Climbing",
    art: "books",
    width: 2,
    height: 2,
    anchor: "floor",
    color: 0x81728c,
    canFlip: true,
    surfaces: [{ x: 1, y: 2, width: 1, actions: ["sit", "perch"] }],
    description: "A sturdy first step to the tower's higher shelves",
  },
  {
    id: "tower-reading-chair",
    name: "Wizard's reading chair",
    category: "Comfort",
    art: "couch",
    width: 2,
    height: 3,
    anchor: "floor",
    color: 0x6c6b91,
    canFlip: true,
    cells: [
      [0, 0],
      [1, 0],
    ],
    surfaces: top(2, 1, ["sleep", "sit", "groom"]),
    description: "A velvet armchair for sharing a long, quiet afternoon",
  },
  {
    id: "tower-moon-bed",
    name: "Moon-quilt bed",
    category: "Comfort",
    art: "bed",
    width: 4,
    height: 1,
    anchor: "floor",
    color: 0x9095b7,
    canFlip: true,
    surfaces: top(4, 1, ["sleep", "sit", "groom"]),
    description: "A low bed tucked under a quilt of moons and stars",
  },
  {
    id: "tower-star-cushion",
    name: "Star cushion",
    category: "Comfort",
    art: "cushion",
    width: 2,
    height: 1,
    anchor: "floor",
    color: 0x9a83a9,
    canFlip: true,
    surfaces: top(2, 1, ["sleep", "sit"]),
    description: "A soft floor cushion embroidered with tiny constellations",
  },
  {
    id: "tower-crystal-plinth",
    name: "Moonstone plinth",
    category: "Storage",
    art: "cabinet",
    width: 2,
    height: 2,
    anchor: "floor",
    color: 0x819c9a,
    canFlip: true,
    surfaces: [],
    description:
      "A glowing crystal display; leave its delicate top undisturbed",
  },
  {
    id: "tower-observatory-perch",
    name: "Stargazer's perch",
    category: "Climbing",
    art: "shelf",
    width: 3,
    height: 1,
    anchor: "wall",
    color: 0x8c809f,
    canFlip: true,
    surfaces: top(3, 1, ["perch", "groom", "sit"]),
    description: "A crescent-carved wall perch for watching the sky",
  },
  {
    id: "tower-spiral-scratcher",
    name: "Spiral scratch post",
    category: "Play",
    art: "scratcher",
    width: 2,
    height: 2,
    anchor: "floor",
    color: 0xb69c6d,
    canFlip: false,
    cells: [
      [0.5, 0],
      [0.5, 1],
    ],
    surfaces: [{ x: 0.5, y: 2, width: 1, actions: [] }],
    interaction: "scratch",
    description:
      "A rope-wrapped post with a brass base for a satisfying stretch",
  },
];
export const CATALOG: FurnitureDef[] =
  ACTIVE_THEME.id === "cabin-v2"
    ? CABIN_V2_CATALOG
    : ACTIVE_THEME.id === "ramen-v2"
      ? RAMEN_V2_CATALOG
      : ACTIVE_THEME.id === "tower"
        ? TOWER_CATALOG
        : ACTIVE_THEME.id === "ramen"
          ? [...BASE_CATALOG, ...RAMEN_CATALOG]
          : BASE_CATALOG;
export const defById = (id: string) => CATALOG.find((d) => d.id === id)!;
export interface Furniture {
  instanceId: string;
  definitionId: string;
  roomId: string;
  gridX: number;
  gridY: number;
  flipX: boolean;
}
export interface Layout {
  version: 1;
  furniture: Furniture[];
}
export function cellsOf(f: Furniture): [number, number][] {
  const d = defById(f.definitionId);
  if (!d) return [];
  const cells =
    d.cells ??
    Array.from(
      { length: d.width * d.height },
      (_, i) => [i % d.width, Math.floor(i / d.width)] as [number, number],
    );
  return cells.map(([x, y]) => [
    f.gridX + (f.flipX ? d.width - 1 - x : x),
    f.gridY + y,
  ]);
}
function placementCellsOf(f: Furniture): [number, number][] {
  const d = defById(f.definitionId);
  if (!d?.placementCells) return cellsOf(f);
  return d.placementCells.map(([x, y]) => [
    f.gridX + (f.flipX ? d.width - 1 - x : x),
    f.gridY + y,
  ]);
}
export function placementError(f: Furniture, layout: Layout): string | null {
  const d = defById(f.definitionId),
    r = roomById(f.roomId);
  if (!d || !r) return "Unknown furniture or room";
  if (d.anchor === "ceiling" && r.outdoor) return "This space has no ceiling";
  if (!Number.isInteger(f.gridX) || !Number.isInteger(f.gridY))
    return "Place on the grid";
  if (f.flipX && !d.canFlip) return "This piece cannot be flipped";
  for (const [x, y] of placementCellsOf(f))
    if (
      ![
        [x, y],
        [x + 1, y],
        [x, y + 1],
        [x + 1, y + 1],
      ].every(([a, b]) => inRoom(r, a, b))
    )
      return "Keep inside the room and below the roof";
  if (d.anchor === "floor" && f.gridY !== 0)
    return "This piece needs the floor";
  if (d.anchor === "ceiling" && (r.attic || f.gridY !== r.height - 3))
    return "Hang two cells below a flat ceiling";
  const occupied = layout.furniture
    .filter((o) => o.instanceId !== f.instanceId && o.roomId === f.roomId)
    .flatMap(placementCellsOf);
  if (
    placementCellsOf(f).some(([x, y]) =>
      occupied.some(
        ([a, b]) => x < a + 1 && x + 1 > a && y < b + 1 && y + 1 > b,
      ),
    )
  )
    return "Furniture cannot overlap";
  return null;
}
export function makeFurniture(
  definitionId: string,
  roomId: string,
  gridX: number,
  gridY = 0,
  instanceId?: string,
): Furniture {
  return {
    // getRandomValues remains available on plain HTTP LAN origins.
    instanceId:
      instanceId ??
      `furniture-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
    definitionId,
    roomId,
    gridX,
    gridY,
    flipX: false,
  };
}
export function defaultLayout(): Layout {
  const items = ACTIVE_THEME.defaultFurniture;
  return {
    version: 1,
    furniture: items.map(([d, r, x, y], i) =>
      makeFurniture(d, r, x, y ?? 0, `demo-${i}`),
    ),
  };
}
export function cloneLayout(l: Layout): Layout {
  return structuredClone(l);
}
