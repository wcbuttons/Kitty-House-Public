import { type Layout, placementError } from "./model";
import { validateRoster, type CatProfile } from "./cat-model";
import { themeStorageKey } from "./house-theme";
import { refreshDefaultLayout } from "./layout-updates";
export const STORAGE_KEY = themeStorageKey("little-house.layout.v1");
export function deserializeLayout(raw: string): Layout {
  const x = JSON.parse(raw);
  if (
    x?.version !== 1 ||
    !Array.isArray(x.furniture) ||
    x.furniture.length > 200
  )
    throw Error("Unrecognized layout");
  const ids = new Set<string>();
  for (const f of x.furniture) {
    if (
      typeof f.instanceId !== "string" ||
      ids.has(f.instanceId) ||
      typeof f.flipX !== "boolean"
    )
      throw Error("Invalid furniture identity");
    ids.add(f.instanceId);
    const error = placementError(f, x);
    if (error) throw Error(error);
  }
  return x;
}
export class HouseStorage {
  constructor(private backend?: Pick<Storage, "getItem" | "setItem">) {}
  load(): Layout | null {
    const raw = (this.backend ?? localStorage).getItem(STORAGE_KEY);
    return raw ? refreshDefaultLayout(deserializeLayout(raw)) : null;
  }
  save(layout: Layout): void {
    deserializeLayout(JSON.stringify(layout));
    (this.backend ?? localStorage).setItem(STORAGE_KEY, JSON.stringify(layout));
  }
}
export const CAT_STORAGE_KEY = themeStorageKey("little-house.cats.v1");
export class CatStorage {
  constructor(private backend?: Pick<Storage, "getItem" | "setItem">) {}
  load(): CatProfile[] | null {
    const raw = (this.backend ?? localStorage).getItem(CAT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 1) throw Error("Unrecognized cat roster version");
    return validateRoster(data.cats);
  }
  save(cats: CatProfile[]): void {
    (this.backend ?? localStorage).setItem(
      CAT_STORAGE_KEY,
      JSON.stringify({ version: 1, cats: validateRoster(cats) }),
    );
  }
}
export class History<T = Layout> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];
  get canUndo() {
    return !!this.undoStack.length;
  }
  get canRedo() {
    return !!this.redoStack.length;
  }
  push(previous: T) {
    this.undoStack.push(structuredClone(previous));
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack = [];
  }
  undo(current: T) {
    const l = this.undoStack.pop();
    if (l) this.redoStack.push(structuredClone(current));
    return l;
  }
  redo(current: T) {
    const l = this.redoStack.pop();
    if (l) this.undoStack.push(structuredClone(current));
    return l;
  }
}
