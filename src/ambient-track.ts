import type { ThemeId } from "./house-theme";

export const AMBIENT_TRACKS = {
  original: "Rain on the window",
  cabin: "Pines and birds",
  ramen: "Rain on the awning",
  tower: "Night wind and crickets",
  "cabin-v2": "Woodland creek",
  "ramen-v2": "Courtyard drizzle",
} as const satisfies Record<ThemeId, string>;

export const ambientTrackPath = (theme: ThemeId) =>
  `assets/ambience/${theme}.mp3`;
