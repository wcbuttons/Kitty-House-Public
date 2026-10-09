import type { HouseArtSettings, HouseTheme } from './house-theme';
import type { FurnitureDef, SurfaceDef, Action } from './model';

const top = (width: number, height: number, actions: Action[]): SurfaceDef[] =>
  [{ x: 0, y: height, width, actions }];

/** Every raster and fixture for this experiment is newly made; no V1 art aliases. */
export const RAMEN_V2_CATALOG: FurnitureDef[] = [
  { id: 'ramen-v2-counter', name: 'Indigo service counter', category: 'Tables', art: 'cabinet', width: 6, height: 2, anchor: 'floor', color: 0x8a6040, canFlip: true, surfaces: top(6, 2, ['sit', 'groom', 'perch']), description: 'A broad walnut landing above indigo sliding panels' },
  { id: 'ramen-v2-stool', name: 'Round noodle stool', category: 'Tables', art: 'table', width: 1, height: 1, anchor: 'floor', color: 0xb07b50, canFlip: false, surfaces: top(1, 1, ['sit', 'perch']), description: 'A low lacquered seat and a useful first step' },
  { id: 'ramen-v2-table', name: 'Walnut dining table', category: 'Tables', art: 'table', width: 3, height: 2, anchor: 'floor', color: 0x976b48, canFlip: true, surfaces: top(3, 2, ['sit', 'groom']), description: 'A clear level tabletop with traditional trestle joinery' },
  { id: 'ramen-v2-futon', name: 'Sashiko futon', category: 'Comfort', art: 'bed', width: 4, height: 1, anchor: 'floor', color: 0xac7062, canFlip: true, surfaces: top(4, 1, ['sleep', 'sit', 'groom']), description: 'A thick cotton quilt on a low walnut platform' },
  { id: 'ramen-v2-tansu', name: 'Three-drawer tansu', category: 'Storage', art: 'cabinet', width: 3, height: 3, anchor: 'floor', color: 0x926b4c, canFlip: true, surfaces: top(3, 3, ['perch', 'groom']), description: 'Iron fittings and a clear perch above three drawers' },
  { id: 'ramen-v2-shelf', name: 'Carved wall shelf', category: 'Climbing', art: 'shelf', width: 3, height: 1, anchor: 'wall', color: 0x956640, canFlip: true, surfaces: top(3, 1, ['perch', 'sit']), description: 'A level walnut ledge on two carved brackets' },
  { id: 'ramen-v2-bench', name: 'Veranda bench', category: 'Comfort', art: 'couch', width: 4, height: 2, anchor: 'floor', color: 0x8b6144, canFlip: true, cells: [[0, 0], [1, 0], [2, 0], [3, 0]], placementCells: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]], surfaces: [{ x: 0.25, y: 1, width: 3.5, actions: ['sit', 'sleep', 'groom'] }], description: 'A low comfortable seat below a slender spindle back' },
  { id: 'ramen-v2-planter', name: 'Glazed fern planter', category: 'Play', art: 'cat-tree', width: 2, height: 3, anchor: 'floor', color: 0x7e9770, canFlip: true, surfaces: [], description: 'A lush fern in a hand-thrown blue-green ceramic pot' },
  { id: 'ramen-v2-zabuton', name: 'Indigo zabuton', category: 'Comfort', art: 'cushion', width: 2, height: 1, anchor: 'floor', color: 0x677e98, canFlip: true, surfaces: top(2, 1, ['sleep', 'sit', 'groom']), description: 'A plump woven cotton cushion with cream sashiko stitching' },
  { id: 'ramen-v2-scratcher', name: 'Rope landing post', category: 'Play', art: 'scratcher', width: 2, height: 3, anchor: 'floor', color: 0xb09c77, canFlip: false, cells: [[0.5, 0], [0.5, 1], [0.5, 2]], placementCells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]], surfaces: top(2, 3, ['perch', 'sit']), interaction: 'scratch', description: 'A tightly wrapped post below a small square platform' },
  { id: 'ramen-v2-hide', name: 'Cedar cat cubby', category: 'Play', art: 'box', width: 2, height: 2, anchor: 'floor', color: 0xa67551, canFlip: true, surfaces: top(2, 2, ['sit', 'groom']), interaction: 'hide', description: 'A sheltered round entrance below a level cedar lid' },
  { id: 'ramen-v2-bowl-rack', name: 'Ceramic bowl dresser', category: 'Storage', art: 'bookcase', width: 3, height: 3, anchor: 'floor', color: 0x8c674b, canFlip: true, surfaces: top(3, 3, ['perch', 'groom']), description: 'Neatly nested handmade bowls below a clear walnut top' },
  { id: 'ramen-v2-noren', name: 'Indigo noodle noren', category: 'Comfort', art: 'cushion', width: 4, height: 2, anchor: 'wall', color: 0x334b61, canFlip: false, surfaces: [], description: 'A split cotton curtain bearing a hand-sewn noodle bowl emblem' },
];

export const RAMEN_V2_ART: HouseArtSettings = {
  windows: [[777, 248, 214, 93], [1065, 259, 43, 42]],
  lamps: [
    { x: 215, y: 443, glow: 26, flame: [4, 8] },
    { x: 1225, y: 443, glow: 26, flame: [4, 8] },
    { x: 409, y: 487, glow: 18, flame: [3, 7] },
    { x: 754, y: 487, glow: 18, flame: [3, 7] },
    { x: 1035, y: 231, glow: 16, flame: [3, 6] },
  ],
  roomLights: [[775, 291, 150, 110], [1078, 279, 100, 80]],
  windowMask: true,
  nightFixtures: true,
  foregroundFixtures: true,
  furnitureNight: [132, 129, 127],
  furnitureOutdoorNight: [60, 79, 116],
};

export const RAMEN_V2_THEME: HouseTheme = {
  id: 'ramen-v2', name: 'Cat Cafe',
  description: 'A fresh walnut noodle house with a sunny veranda and a quiet home upstairs.',
  defaultCatCount: 7,
  world: { width: 1408, height: 792 },
  rooms: [
    { id: 'shop', name: 'The walnut noodle shop', x: 276, floor: 663, width: 34, height: 8, color: 0xcdb998 },
    { id: 'studio', name: 'The sashiko sleeping room', x: 675, floor: 373, width: 19, height: 6, color: 0xbcae91 },
    { id: 'veranda', name: 'The hillside veranda', x: 270, floor: 373, width: 15.3, height: 7, color: 0x94a18a, outdoor: true },
  ],
  passages: [
    { id: 'ramen-v2-stairs', kind: 'stairs', a: { roomId: 'shop', x: (1102 - 276) / 26, y: 0 }, b: { roomId: 'studio', x: (974 - 675) / 26, y: 0 } },
    { id: 'ramen-v2-veranda', kind: 'door', a: { roomId: 'veranda', x: 15.05, y: 0 }, b: { roomId: 'studio', x: 0.5, y: 0 } },
  ],
  defaultFurniture: [
    ['ramen-v2-counter', 'shop', 8],
    ['ramen-v2-stool', 'shop', 6],
    ['ramen-v2-stool', 'shop', 15],
    ['ramen-v2-table', 'shop', 20],
    ['ramen-v2-shelf', 'shop', 9, 3],
    ['ramen-v2-hide', 'shop', 17],
    ['ramen-v2-bowl-rack', 'shop', 25],
    ['ramen-v2-noren', 'shop', 19, 5],
    ['ramen-v2-futon', 'studio', 4],
    ['ramen-v2-tansu', 'studio', 8],
    ['ramen-v2-shelf', 'studio', 0, 3],
    ['ramen-v2-zabuton', 'studio', 14],
    ['ramen-v2-scratcher', 'studio', 17],
    ['ramen-v2-bench', 'veranda', 6],
    ['ramen-v2-zabuton', 'veranda', 11],
    ['ramen-v2-planter', 'veranda', 0],
    ['ramen-v2-planter', 'veranda', 3],
  ],
};
