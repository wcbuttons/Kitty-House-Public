import type { HouseTheme, HouseArtSettings } from "./house-theme";
import type { FurnitureDef } from "./model";

/** An independent elevation and catalog. No original cabin objects are inherited. */
export const CABIN_V2_THEME: HouseTheme = {
  id: "cabin-v2",
  name: "Mountain Cabin",
  description: "A cedar retreat with a sleeping loft, open veranda, and furniture made to move.",
  defaultCatCount: 8,
  world: { width: 1408, height: 792 },
  rooms: [
    { id: "hearth", name: "The cedar room", x: 234, floor: 682, width: 24, height: 8, color: 0xa88458 },
    { id: "loft", name: "The quilt loft", x: 234, floor: 422, width: 24, height: 6, color: 0xaca37a },
    { id: "veranda", name: "The fern veranda", x: 884, floor: 682, width: 11, height: 8, color: 0x789381, outdoor: true },
  ],
  passages: [
    { id: "cedar-ladder", kind: "ladder", a: { roomId: "hearth", x: 4, y: 0 }, b: { roomId: "loft", x: 4, y: 0 } },
    { id: "veranda-opening", kind: "door", a: { roomId: "hearth", x: 23.5, y: 0 }, b: { roomId: "veranda", x: 0.5, y: 0 } },
  ],
  defaultFurniture: [
    ["cabin-v2-fern-sofa", "hearth", 5],
    ["cabin-v2-trestle-table", "hearth", 11],
    ["cabin-v2-stump-stool", "hearth", 15],
    ["cabin-v2-bookcase", "hearth", 18],
    ["cabin-v2-stump-stool", "hearth", 22],
    ["cabin-v2-wall-shelf", "hearth", 10, 4],
    ["cabin-v2-quilt-bed", "loft", 5],
    ["cabin-v2-stump-stool", "loft", 9],
    ["cabin-v2-blanket-chest", "loft", 11],
    ["cabin-v2-reading-chair", "loft", 14],
    ["cabin-v2-wall-shelf", "loft", 11, 3],
    ["cabin-v2-wicker-hide", "veranda", 3],
    ["cabin-v2-stump-stool", "veranda", 7],
    ["cabin-v2-birch-scratcher", "veranda", 8],
    ["cabin-v2-blanket-chest", "loft", 21],
  ],
};

export const CABIN_V2_CATALOG: FurnitureDef[] = [
  { id: "cabin-v2-fern-sofa", name: "Fern linen sofa", category: "Comfort", art: "couch", width: 4, height: 2, anchor: "floor", color: 0x7d9265, canFlip: true, placementCells: Array.from({ length: 8 }, (_, i): [number, number] => [i % 4, Math.floor(i / 4)]), cells: [[0, 0], [1, 0], [2, 0], [3, 0]], surfaces: [{ x: 0.45, y: 1.05, width: 3.1, actions: ["sit", "sleep", "groom"] }], description: "A soft linen seat in a carved cedar frame." },
  { id: "cabin-v2-quilt-bed", name: "Patchwork quilt bed", category: "Comfort", art: "bed", width: 4, height: 2, anchor: "floor", color: 0xb48459, canFlip: true, placementCells: Array.from({ length: 8 }, (_, i): [number, number] => [i % 4, Math.floor(i / 4)]), cells: [[0, 0], [1, 0], [2, 0], [3, 0]], surfaces: [{ x: 0.8, y: 1, width: 2.85, actions: ["sleep", "sit"] }], description: "A low, generous quilt on a timber sleeping platform." },
  { id: "cabin-v2-reading-chair", name: "Cedar reading chair", category: "Comfort", art: "couch", width: 2, height: 3, anchor: "floor", color: 0x9d704f, canFlip: true, placementCells: Array.from({ length: 6 }, (_, i): [number, number] => [i % 2, Math.floor(i / 2)]), cells: [[0, 0], [1, 0]], surfaces: [{ x: 0.3, y: 1.25, width: 1.4, actions: ["sit", "sleep", "groom"] }], description: "A tall slatted back above a real cushioned seat." },
  { id: "cabin-v2-trestle-table", name: "Cedar trestle table", category: "Tables", art: "table", width: 3, height: 2, anchor: "floor", color: 0xb78b58, canFlip: true, surfaces: [{ x: 0.05, y: 2, width: 2.9, actions: ["sit", "groom", "perch"] }], description: "A level table top with two sturdy visible supports." },
  { id: "cabin-v2-stump-stool", name: "Carved stump stool", category: "Tables", art: "table", width: 1, height: 1, anchor: "floor", color: 0xa07548, canFlip: true, surfaces: [{ x: 0.05, y: 1, width: 0.9, actions: ["sit", "perch"] }], description: "A little first step, carved from fallen cedar." },
  { id: "cabin-v2-blanket-chest", name: "Leaf-carved blanket chest", category: "Storage", art: "cabinet", width: 3, height: 1, anchor: "floor", color: 0xb48b59, canFlip: true, surfaces: [{ x: 0.1, y: 1, width: 2.8, actions: ["sit", "sleep", "groom"] }], description: "A low chest with a flat lid and small brass hinges." },
  { id: "cabin-v2-bookcase", name: "Forest bookcase", category: "Storage", art: "bookcase", width: 3, height: 4, anchor: "floor", color: 0x9a7752, canFlip: true, surfaces: [{ x: 0.1, y: 4, width: 2.8, actions: ["perch", "groom"] }], description: "Quiet rows of well-read books below a clear climbing top." },
  { id: "cabin-v2-wall-shelf", name: "Braced cedar shelf", category: "Climbing", art: "shelf", width: 3, height: 1, anchor: "wall", color: 0xb58b5b, canFlip: true, surfaces: [{ x: 0.05, y: 1, width: 2.9, actions: ["perch", "sit", "groom"] }], description: "A clear level shelf with small visible wall brackets." },
  { id: "cabin-v2-birch-scratcher", name: "Birch scratching perch", category: "Play", art: "scratcher", width: 2, height: 3, anchor: "floor", color: 0xb7ae82, canFlip: true, placementCells: Array.from({ length: 6 }, (_, i): [number, number] => [i % 2, Math.floor(i / 2)]), cells: [[0, 0], [1, 0], [0.5, 1], [0.5, 2]], surfaces: [{ x: 0.4, y: 3, width: 1.2, actions: ["perch", "sit"] }], interaction: "scratch", description: "Rope wraps a birch post below a small level lookout." },
  { id: "cabin-v2-wicker-hide", name: "Woven woodland hide", category: "Play", art: "tunnel", width: 3, height: 2, anchor: "floor", color: 0xb49b70, canFlip: true, surfaces: [{ x: 0.85, y: 2, width: 1.3, actions: ["sit", "perch"] }], interaction: "hide", description: "A woven hideaway with a dark, quiet open entrance." },
];

/** Coordinates are authored directly in the 1408×792 plates. */
export const CABIN_V2_ART: HouseArtSettings = {
  furnitureNight: [118, 126, 139],
  furnitureOutdoorNight: [60, 74, 94],
  nightFixtures: true,
  foregroundFixtures: true,
  atmosphereMask: true,
  windowMask: true,
  fireplace: { x: 252, y: 608, width: 45, height: 66, frameCount: 16, frameRate: 10 },
  windows: [[668, 294, 130, 58], [668, 504, 130, 67]] as [number, number, number, number][],
  lamps: [
    { x: 384, y: 330, glow: 32, flame: [8, 14] as [number, number] },
    { x: 384, y: 545, glow: 36, flame: [8, 14] as [number, number] },
    { x: 274, y: 645, glow: 36, flame: [18, 24] as [number, number] },
    { x: 1159, y: 532, glow: 34, flame: [8, 14] as [number, number] },
  ],
  roomLights: [[384, 545, 250, 174], [384, 330, 230, 145], [274, 645, 160, 100], [1159, 532, 170, 170]] as [number, number, number, number][],
};
