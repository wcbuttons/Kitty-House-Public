/** A theme is selected at startup, keeping every world and its saved residents independent. */
import { CABIN_V2_THEME, CABIN_V2_ART } from "./cabin-v2";
import { RAMEN_V2_THEME, RAMEN_V2_ART } from "./ramen-v2";

export type ThemeId = "original" | "cabin" | "ramen" | "tower" | "cabin-v2" | "ramen-v2";
export interface HouseArtSettings {
  frame?: { x: number; y: number; width: number; height: number };
  windows: readonly (readonly [number, number, number, number])[];
  lamps: readonly { x: number; y: number; glow: number; flame: readonly [number, number] }[];
  roomLights: readonly (readonly [number, number, number, number])[];
  atmosphereMask?: boolean;
  windowMask?: boolean;
  nightFixtures?: boolean;
  /** Near-side rails and posts must occlude cats crossing behind them. */
  foregroundFixtures?: boolean;
  /** A transparent flame loop, separate from the daylight-sensitive reflected light. */
  fireplace?: { x: number; y: number; width: number; height: number; frameCount: number; frameRate: number };
  furnitureNight?: readonly [number, number, number];
  furnitureOutdoorNight?: readonly [number, number, number];
}
export interface ThemeRoom {
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
export interface ThemeEntrance {
  roomId: string;
  x: number;
  y: 0;
}
export interface ThemePassage {
  id: string;
  kind: "door" | "ladder" | "stairs";
  a: ThemeEntrance;
  b: ThemeEntrance;
}
export type ThemeFurniture = readonly [
  definitionId: string,
  roomId: string,
  x: number,
  y?: number,
];
export interface HouseTheme {
  id: ThemeId;
  name: string;
  description: string;
  defaultCatCount: number;
  world?: { width: number; height: number };
  art?: HouseArtSettings;
  rooms: readonly ThemeRoom[];
  passages: readonly ThemePassage[];
  defaultFurniture: readonly ThemeFurniture[];
}
export const THEME_STORAGE_KEY = "little-house.theme.v1";
type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

const originalRooms: ThemeRoom[] = [
  {
    id: "lounge",
    name: "The living room",
    x: 130,
    floor: 709,
    width: 16,
    height: 7,
    color: 0xa7bdb5,
  },
  {
    id: "bedroom",
    name: "The sleepy room",
    x: 562,
    floor: 709,
    width: 16,
    height: 7,
    color: 0xc9adb0,
  },
  {
    id: "library",
    name: "The climbing room",
    x: 130,
    floor: 511,
    width: 16,
    height: 7,
    color: 0xc6b48d,
  },
  {
    id: "playroom",
    name: "The play room",
    x: 562,
    floor: 511,
    width: 16,
    height: 7,
    color: 0x91b8c4,
  },
  {
    id: "attic",
    name: "The little attic",
    x: 130,
    floor: 313,
    width: 32.6,
    height: 8,
    color: 0x92a39f,
    attic: true,
  },
];

const originalFurniture: ThemeFurniture[] = [
  ["couch", "lounge", 1],
  ["large-crate", "lounge", 7],
  ["table", "lounge", 11],
  ["shelf", "lounge", 8, 3],
  ["bed", "bedroom", 1],
  ["scratcher", "bedroom", 7],
  ["box", "bedroom", 12],
  ["window-perch", "bedroom", 12, 2],
  ["large-crate", "library", 13],
  ["large-crate", "library", 4],
  ["bookcase", "library", 9],
  ["shelf", "library", 6, 3],
  ["cat-tree", "playroom", 2],
  ["table", "playroom", 8],
  ["window-perch", "playroom", 11, 2],
  ["stool", "playroom", 13],
  ["box", "attic", 4],
  ["large-crate", "attic", 8],
  ["bed", "attic", 14],
  ["crate", "attic", 21],
  ["shelf", "attic", 10, 3],
  ["crate", "attic", 24],
];

const originalPassages: ThemePassage[] = [
  {
    id: "lower-door",
    kind: "door",
    a: { roomId: "lounge", x: 15.5, y: 0 },
    b: { roomId: "bedroom", x: 0.5, y: 0 },
  },
  {
    id: "upper-door",
    kind: "door",
    a: { roomId: "library", x: 15.5, y: 0 },
    b: { roomId: "playroom", x: 0.5, y: 0 },
  },
  {
    id: "lower-ladder",
    kind: "ladder",
    a: { roomId: "lounge", x: 6, y: 0 },
    b: { roomId: "library", x: 6.5, y: 0 },
  },
  {
    id: "attic-ladder",
    kind: "ladder",
    a: { roomId: "playroom", x: 14.35, y: 0 },
    b: { roomId: "attic", x: 14.35 + (562 - 130) / 26, y: 0 },
  },
];

const cabinNames: Record<string, string> = {
  lounge: "The hearth room",
  bedroom: "The sleeping nook",
  library: "The reading loft",
  playroom: "The craft room",
  attic: "Under the eaves",
};
const cabinColors = [0xc09b70, 0xc4aa87, 0xb29b76, 0xbca884, 0xa68b6b];

export const THEMES: readonly HouseTheme[] = [
  {
    id: "original",
    name: "Little House",
    description: "The original little house, just as you left it.",
    defaultCatCount: 12,
    rooms: originalRooms,
    passages: originalPassages,
    defaultFurniture: originalFurniture,
  },
  {
    id: "cabin",
    name: "Woodland Cabin",
    description:
      "Warm timber, quiet reading corners and a roof full of cozy naps.",
    defaultCatCount: 10,
    rooms: originalRooms.map((room, index) => ({
      ...room,
      name: cabinNames[room.id],
      color: cabinColors[index],
    })),
    passages: originalPassages,
    defaultFurniture: originalFurniture,
  },
  {
    id: "ramen",
    name: "Neko Ramen",
    description:
      "A small neighborhood ramen shop with a home above the lanterns.",
    defaultCatCount: 6,
    rooms: [
      {
        id: "shop",
        name: "The ramen shop",
        x: 189,
        floor: 691,
        width: 29,
        height: 12,
        color: 0xc69a68,
      },
      {
        id: "studio",
        name: "The upstairs home",
        x: 191,
        floor: 341,
        width: 18.5,
        height: 6,
        color: 0xd2ba94,
      },
      {
        id: "terrace",
        name: "The rooftop garden",
        x: 687,
        floor: 341,
        width: 12.8,
        height: 8.3,
        color: 0x718e79,
        outdoor: true,
      },
    ],
    passages: [
      {
        id: "shop-stairs",
        kind: "stairs",
        a: { roomId: "shop", x: 1.25, y: 0 },
        b: { roomId: "studio", x: 4.2, y: 0 },
      },
      {
        id: "terrace-door",
        kind: "door",
        a: { roomId: "studio", x: 17.75, y: 0 },
        b: { roomId: "terrace", x: 0.5, y: 0 },
      },
    ],
    defaultFurniture: [
      ["ramen-counter", "shop", 9],
      ["ramen-stool", "shop", 7],
      ["ramen-stool", "shop", 18],
      ["noodle-table", "shop", 23],
      ["bowl-rack", "shop", 21, 3],
      ["futon", "studio", 10],
      ["low-cabinet", "studio", 0],
      ["shelf", "studio", 10, 3],
      ["planter", "terrace", 7],
      ["planter", "terrace", 10],
      ["bench", "terrace", 3],
      ["floor-cushion", "studio", 6],
    ],
  },
  {
    id: "tower",
    name: "Moonwhisker Tower",
    description:
      "A wizard's stone tower, from the welcome hearth to a sky full of stars.",
    defaultCatCount: 8,
    world: { width: 792, height: 1408 },
    rooms: [
      {
        id: "vestibule",
        name: "The welcome hearth",
        x: 188,
        floor: 1304,
        width: 16,
        height: 7,
        color: 0xa58872,
      },
      {
        id: "potions",
        name: "The potion workshop",
        x: 188,
        floor: 1084,
        width: 16,
        height: 7,
        color: 0x81938c,
      },
      {
        id: "library",
        name: "The spellbook library",
        x: 188,
        floor: 864,
        width: 16,
        height: 7,
        color: 0x9b8e7f,
      },
      {
        id: "bedchamber",
        name: "The moonlit bedchamber",
        x: 188,
        floor: 644,
        width: 16,
        height: 7,
        color: 0x9890aa,
      },
      {
        id: "observatory",
        name: "The star observatory",
        x: 188,
        floor: 424,
        width: 16,
        height: 7,
        color: 0x7c8a9d,
      },
    ],
    passages: [
      {
        id: "tower-hearth-ladder",
        kind: "ladder",
        a: { roomId: "vestibule", x: 1.25, y: 0 },
        b: { roomId: "potions", x: 1.25, y: 0 },
      },
      {
        id: "tower-workshop-ladder",
        kind: "ladder",
        a: { roomId: "potions", x: 14.5, y: 0 },
        b: { roomId: "library", x: 14.5, y: 0 },
      },
      {
        id: "tower-library-ladder",
        kind: "ladder",
        a: { roomId: "library", x: 1.25, y: 0 },
        b: { roomId: "bedchamber", x: 1.25, y: 0 },
      },
      {
        id: "tower-moon-ladder",
        kind: "ladder",
        a: { roomId: "bedchamber", x: 14.5, y: 0 },
        b: { roomId: "observatory", x: 14.5, y: 0 },
      },
    ],
    defaultFurniture: [
      ["tower-travel-chest", "vestibule", 3],
      ["tower-spiral-scratcher", "vestibule", 8],
      ["tower-star-cushion", "vestibule", 11],
      ["tower-potion-desk", "potions", 3],
      ["tower-alchemy-cabinet", "potions", 9],
      ["tower-herb-shelf", "potions", 4, 3],
      ["tower-book-stack", "library", 6],
      ["tower-arcane-bookcase", "library", 2],
      ["tower-reading-chair", "library", 11],
      ["tower-moon-bed", "bedchamber", 3],
      ["tower-star-cushion", "bedchamber", 10],
      ["tower-observatory-perch", "bedchamber", 7, 0],
      ["tower-crystal-plinth", "observatory", 0],
      ["tower-book-stack", "observatory", 4],
      ["tower-observatory-perch", "observatory", 7, 1],
    ],
  },
  {
    ...CABIN_V2_THEME,
    art: { ...CABIN_V2_ART, frame: { x: 0, y: 0, width: 1408, height: 792 } },
  },
  {
    ...RAMEN_V2_THEME,
    art: { ...RAMEN_V2_ART, frame: { x: 0, y: 0, width: 1408, height: 792 } },
  },
];

// Native art tools also load this module without Vite's environment object.
const defaultTheme =
  THEMES.find((theme) => theme.id === import.meta.env?.VITE_DEFAULT_HOUSE) ??
  THEMES[0];

export function readActiveTheme(
  backend?: Pick<Storage, "getItem">,
): HouseTheme {
  if (!backend && typeof window === "undefined") return defaultTheme;
  try {
    const id = (backend ?? window.localStorage).getItem(THEME_STORAGE_KEY);
    return THEMES.find((theme) => theme.id === id) ?? defaultTheme;
  } catch {
    // A host's default also works when storage is disabled; no saved data is rewritten.
    return defaultTheme;
  }
}
export const ACTIVE_THEME = readActiveTheme();

/** Persist the next startup's choice; the caller saves the current world before reloading. */
export function setActiveTheme(id: ThemeId, backend?: ThemeStorage): void {
  if (!THEMES.some((theme) => theme.id === id))
    throw Error("Unknown house style");
  (backend ?? globalThis.localStorage).setItem(THEME_STORAGE_KEY, id);
}

/** The original keys are deliberately unchanged, so existing houses need no migration. */
export function themeStorageKey(
  base: string,
  id: ThemeId = ACTIVE_THEME.id,
): string {
  return id === "original" ? base : `${base}.${id}`;
}
