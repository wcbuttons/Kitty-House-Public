import {
  CATALOG,
  defById,
  roomById,
  type Furniture,
  type Layout,
} from "./model";

type CatalogMode = "catalog" | "house";
type CatalogOptions = {
  element: HTMLElement;
  layout: () => Layout;
  thumbnail: (id: string) => string;
  add: (id: string) => void;
  move: (furniture: Furniture) => void;
  remove: (id: string) => void;
};
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const anchorLabel = (anchor: string) =>
  anchor === "wall" ? "Back wall" : anchor === "ceiling" ? "Ceiling" : "Floor";

/** The catalog stays independent of simulation timing and pointer movement. */
export class FurnitureCatalogUI {
  private mode: CatalogMode = "catalog";
  private thumbnails = new Map<string, string>();
  private search: HTMLInputElement;
  private category: HTMLSelectElement;
  private list: HTMLElement;
  constructor(private options: CatalogOptions) {
    const root = options.element;
    root.innerHTML = `<div class="catalog-tabs" role="tablist" aria-label="Furniture views">
      <button id="catalog-tab" role="tab" aria-controls="catalog-panel" aria-selected="true" data-mode="catalog">Catalog <span>${CATALOG.length}</span></button>
      <button id="house-tab" role="tab" aria-controls="catalog-panel" aria-selected="false" tabindex="-1" data-mode="house">In the house <span id="placed-count"></span></button>
      </div><div id="catalog-panel" role="tabpanel" aria-labelledby="catalog-tab">
      <div class="catalog-filters"><input id="catalog-search" type="search" placeholder="Search furniture…" aria-label="Search furniture"/><select id="catalog-category" aria-label="Furniture category"><option value="">All categories</option>${["Comfort", "Climbing", "Tables", "Storage", "Play"].map((c) => `<option>${c}</option>`).join("")}</select></div>
      <p class="catalog-summary" id="catalog-summary" role="status" aria-live="polite"></p><div id="inventory" class="inventory"></div></div>`;
    this.search = root.querySelector<HTMLInputElement>("#catalog-search")!;
    this.category = root.querySelector<HTMLSelectElement>("#catalog-category")!;
    this.list = root.querySelector<HTMLElement>("#inventory")!;
    this.search.addEventListener("input", () => this.render());
    this.category.addEventListener("change", () => this.render());
    root.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "button",
      );
      if (!target) return;
      if (target.dataset.mode) this.setMode(target.dataset.mode as CatalogMode);
      if (target.dataset.piece) options.add(target.dataset.piece);
      if (target.dataset.select) {
        const f = options
          .layout()
          .furniture.find((f) => f.instanceId === target.dataset.select);
        if (f) options.move({ ...f });
      }
      if (target.dataset.remove) options.remove(target.dataset.remove);
      if (target.dataset.clear !== undefined) {
        this.search.value = "";
        this.category.value = "";
        this.render();
        this.search.focus();
      }
    });
    root
      .querySelector('[role="tablist"]')!
      .addEventListener("keydown", (event) => {
        const e = event as KeyboardEvent;
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        this.setMode(
          e.key === "Home"
            ? "catalog"
            : e.key === "End"
              ? "house"
              : this.mode === "catalog"
                ? "house"
                : "catalog",
        );
        root
          .querySelector<HTMLButtonElement>(`[data-mode="${this.mode}"]`)!
          .focus();
      });
    this.render();
  }
  private thumbnail(id: string) {
    let source = this.thumbnails.get(id);
    if (!source) {
      source = this.options.thumbnail(id);
      this.thumbnails.set(id, source);
    }
    return source;
  }
  private setMode(mode: CatalogMode) {
    this.mode = mode;
    for (const tab of Array.from(
      this.options.element.querySelectorAll<HTMLButtonElement>("[data-mode]"),
    )) {
      const selected = tab.dataset.mode === mode;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    this.options.element
      .querySelector("#catalog-panel")!
      .setAttribute(
        "aria-labelledby",
        mode === "catalog" ? "catalog-tab" : "house-tab",
      );
    this.render();
  }
  render() {
    const layout = this.options.layout(),
      query = this.search.value.trim().toLowerCase(),
      category = this.category.value;
    this.options.element.querySelector("#placed-count")!.textContent = String(
      layout.furniture.length,
    );
    const matches = (id: string, extra = "") => {
      const d = defById(id);
      return (
        (!category || d.category === category) &&
        `${d.name} ${d.description} ${d.category} ${d.surfaces.flatMap((s) => s.actions).join(" ")} ${extra}`
          .toLowerCase()
          .includes(query)
      );
    };
    let count = 0;
    if (this.mode === "catalog") {
      const definitions = CATALOG.filter((d) => matches(d.id));
      count = definitions.length;
      this.list.className = "inventory";
      this.list.innerHTML = definitions
        .map((d) => {
          const placed = layout.furniture.filter(
            (f) => f.definitionId === d.id,
          ).length;
          return `<button class="inventory-piece" data-piece="${d.id}" aria-label="Add ${escape(d.name)}" title="${escape(d.description)}"><span class="furniture-thumbnail"><img src="${this.thumbnail(d.id)}" alt=""/><span class="piece-dimensions">${d.width}×${d.height}</span></span><strong>${escape(d.name)}</strong><span class="piece-description">${escape(d.description)}</span><span class="piece-meta">${anchorLabel(d.anchor)} · ${d.category}</span><span class="catalog-card-footer"><span class="add-piece-label">+ Add</span><span class="placed-quantity">${placed ? `${placed} in house` : "Available"}</span></span></button>`;
        })
        .join("");
    } else {
      const furniture = layout.furniture.filter((f) =>
        matches(f.definitionId, roomById(f.roomId).name),
      );
      count = furniture.length;
      this.list.className = "house-inventory";
      this.list.innerHTML = furniture
        .map((f) => {
          const d = defById(f.definitionId),
            room = roomById(f.roomId),
            id = escape(f.instanceId);
          return `<article class="house-piece" data-placed="${id}"><img src="${this.thumbnail(d.id)}" alt=""/><div class="house-piece-info"><strong>${escape(d.name)}</strong><span>${escape(room.name)}</span><small>Across ${f.gridX} · Height ${f.gridY}</small></div><div class="house-piece-actions"><button data-select="${id}" aria-label="Move ${escape(d.name)} in ${escape(room.name)}">Move</button><button data-remove="${id}" aria-label="Remove ${escape(d.name)} from ${escape(room.name)}">Remove</button></div></article>`;
        })
        .join("");
    }
    this.options.element.querySelector("#catalog-summary")!.textContent =
      this.mode === "catalog"
        ? `${count} of ${CATALOG.length} styles · choose a piece to add`
        : `${count} of ${layout.furniture.length} pieces placed`;
    if (!count)
      this.list.innerHTML = `<div class="catalog-empty"><strong>${this.mode === "house" && !layout.furniture.length ? "Your house is ready to furnish." : "No furniture found."}</strong><p>${query || category ? "Try a different name or category." : "Choose Catalog to find something for your cats."}</p>${query || category ? "<button data-clear>Clear filters</button>" : ""}</div>`;
  }
}
