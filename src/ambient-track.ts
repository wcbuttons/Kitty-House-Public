import type { ThemeId } from "./house-theme";

export const AMBIENT_TRACKS = {
  original: "Fireplace crackle",
  cabin: "Woodland blackbird",
  ramen: "Quiet kitchen simmer",
  tower: "Cricket after dark",
  "cabin-v2": "Babbling woodland brook",
  "ramen-v2": "Tea and ceramic cups",
} as const satisfies Record<ThemeId, string>;

export type AmbientTrackId = keyof typeof AMBIENT_TRACKS;

export function isAmbientTrackId(value: string | null): value is AmbientTrackId {
  return value !== null && Object.hasOwn(AMBIENT_TRACKS, value);
}

export const ambientTrackPath = (track: AmbientTrackId) =>
  `assets/ambience/${track}.mp3`;
