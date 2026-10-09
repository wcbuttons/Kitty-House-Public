import { ACTIVE_THEME } from "./house-theme";
import { defaultLayout, type Layout } from "./model";
import previousDefaults from "./default-layouts-v0.9.0.json";
import v2PreviousDefaults from "./default-layouts-v0.9.4.3.json";

const historicalDefaults = { ...previousDefaults, ...v2PreviousDefaults };

/** Only update a completely untouched saved starting layout; every customization wins. */
export function refreshDefaultLayout(layout: Layout): Layout {
  const previous =
    historicalDefaults[ACTIVE_THEME.id as keyof typeof historicalDefaults];
  // New worlds have no historical default layout to migrate.
  if (!previous) return layout;
  if (layout.furniture.length !== previous.length) return layout;
  const unchanged = previous.every(
    ([definitionId, roomId, gridX, gridY = 0], index) => {
      const item = layout.furniture.find(
        (piece) => piece.instanceId === `demo-${index}`,
      );
      return (
        item &&
        item.definitionId === definitionId &&
        item.roomId === roomId &&
        item.gridX === gridX &&
        item.gridY === gridY &&
        item.flipX === false
      );
    },
  );
  return unchanged ? defaultLayout() : layout;
}
