import type { ThemeId } from "./house-theme";

export const AMBIENT_TRACKS = {
  original: "Fireplace crackle",
  cabin: "Woodland blackbird",
  ramen: "Quiet kitchen simmer",
  tower: "Cricket after dark",
  "cabin-v2": "Forest water drops",
  "ramen-v2": "Tea and ceramic cups",
} as const satisfies Record<ThemeId, string>;

export const ambientTrackPath = (theme: ThemeId) =>
  `assets/ambience/${theme}.mp3`;
