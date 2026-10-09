import { ACTIVE_THEME } from "./house-theme";
import { WORLD } from "./model";

// Illustration margins surround the existing simulation coordinates. Changing the
// view must never move furniture, room entrances, or positions in saved layouts.
export const VIEW_FRAME = ACTIVE_THEME.art?.frame ?? (
  ACTIVE_THEME.id === "original"
    ? { x: 0, y: 0, width: WORLD.width, height: WORLD.height }
    : ACTIVE_THEME.id === "tower"
      ? { x: 0, y: 0, width: 792, height: 1408 }
      : { x: -144, y: -1, width: 1408, height: 792 });

export const VIEW_CENTER = {
  x: VIEW_FRAME.x + VIEW_FRAME.width / 2,
  y: VIEW_FRAME.y + VIEW_FRAME.height / 2,
};
