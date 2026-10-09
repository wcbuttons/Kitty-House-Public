import { CAT_LOOKS, MAX_CATS, catLook, type CatProfile } from "./cat-model";
import { ROOMS, roomById } from "./model";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
type Options = {
  element: HTMLElement;
  roster: () => CatProfile[];
  add: (variant: number, roomId: string) => void;
  remove: (id: string) => void;
  move: (id: string, roomId: string) => void;
  meet: (id: string) => void;
};
const portrait = (variant: number, animated = true) =>
  `<span class="cat-sprite ${animated ? "animated-cat" : ""}" aria-hidden="true" style="background-image:url('${import.meta.env.BASE_URL}assets/cats/Cat-${variant}/Cat-${variant}-${animated ? "Idle" : "Sitting"}.png')"></span>`;
export class CatCatalogUI {
  private mode: "catalog" | "home" = "catalog";
  private search: HTMLInputElement;
  private category: HTMLSelectElement;
  private room: HTMLSelectElement;
  private list: HTMLElement;
  constructor(private options: Options) {
    const root = options.element;
    root.innerHTML = `<div class="catalog-tabs" role="tablist" aria-label="Cat views">
      <button id="cat-catalog-tab" role="tab" aria-controls="cat-catalog-panel" aria-selected="true" data-cat-mode="catalog">Cat catalog <span>${CAT_LOOKS.length}</span></button>
      <button id="cat-home-tab" role="tab" aria-controls="cat-catalog-panel" aria-selected="false" tabindex="-1" data-cat-mode="home">At home <span id="resident-cat-count"></span></button>
      </div><div id="cat-catalog-panel" role="tabpanel" aria-labelledby="cat-catalog-tab">
      <div class="catalog-filters cat-filters"><input id="cat-search" type="search" placeholder="Search cats…" aria-label="Search cats"/><label id="coat-label">Coat type<select id="cat-category" aria-label="Coat type"><option value="">All coats</option>${Array.from(
        new Set(CAT_LOOKS.map((look) => look.category)),
      )
        .map((category) => `<option>${escape(category)}</option>`)
        .join("")}</select></label>
      <label id="cat-room-label" class="cat-room-label">New cat’s room<select id="new-cat-room" aria-label="New cat's room">${ROOMS.map((room) => `<option value="${room.id}">${room.name}</option>`).join("")}</select></label></div>
      <p id="cat-catalog-summary" class="catalog-summary" role="status" aria-live="polite"></p><div id="cat-inventory" class="inventory"></div></div>`;
    this.search = root.querySelector("#cat-search")!;
    this.category = root.querySelector("#cat-category")!;
    this.room = root.querySelector("#new-cat-room")!;
    this.list = root.querySelector("#cat-inventory")!;
    this.search.oninput = () => this.render();
    this.category.onchange = () => this.render();
    root.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "button",
      );
      if (!target) return;
      if (target.dataset.catMode)
        this.setMode(target.dataset.catMode as "catalog" | "home");
      if (target.dataset.catAdd)
        options.add(Number(target.dataset.catAdd), this.room.value);
      if (target.dataset.catRemove) options.remove(target.dataset.catRemove);
      if (target.dataset.catMeet) options.meet(target.dataset.catMeet);
      if (target.dataset.catClear !== undefined) {
        this.search.value = "";
        this.category.value = "";
        this.render();
        this.search.focus();
      }
    });
    root.addEventListener("change", (event) => {
      const target = event.target as HTMLSelectElement;
      if (target.dataset.catRoom)
        options.move(target.dataset.catRoom, target.value);
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
              ? "home"
              : this.mode === "catalog"
                ? "home"
                : "catalog",
        );
        root
          .querySelector<HTMLButtonElement>(`[data-cat-mode="${this.mode}"]`)!
          .focus();
      });
    this.render();
  }
  private setMode(mode: "catalog" | "home") {
    this.mode = mode;
    for (const tab of Array.from(
      this.options.element.querySelectorAll<HTMLButtonElement>(
        "[data-cat-mode]",
      ),
    )) {
      tab.setAttribute("aria-selected", String(tab.dataset.catMode === mode));
      tab.tabIndex = tab.dataset.catMode === mode ? 0 : -1;
    }
    this.options.element
      .querySelector("#cat-catalog-panel")!
      .setAttribute(
        "aria-labelledby",
        mode === "catalog" ? "cat-catalog-tab" : "cat-home-tab",
      );
    this.render();
  }
  render() {
    const root = this.options.element,
      cats = this.options.roster(),
      query = this.search.value.trim().toLowerCase(),
      category = this.category.value;
    root.querySelector("#resident-cat-count")!.textContent = String(
      cats.length,
    );
    (root.querySelector("#cat-room-label") as HTMLElement).hidden =
      this.mode !== "catalog";
    const matches = (variant: number, extra = "") => {
      const look = catLook(variant);
      return (
        (!category || look.category === category) &&
        `${look.name} ${look.description} ${extra}`
          .toLowerCase()
          .includes(query)
      );
    };
    let count = 0;
    if (this.mode === "catalog") {
      const looks = CAT_LOOKS.filter((look) => matches(look.id)).sort(
        (a, b) => Number(b.id > 6) - Number(a.id > 6) || a.id - b.id,
      );
      count = looks.length;
      this.list.className = "inventory cat-look-inventory";
      this.list.innerHTML = looks
        .map((look) => {
          const placed = cats.filter((cat) => cat.variant === look.id).length;
          return `<button class="inventory-piece cat-look" data-cat-add="${look.id}" aria-label="Add ${escape(look.name)} cat" ${cats.length >= MAX_CATS ? "disabled" : ""}><span class="cat-thumbnail">${portrait(look.id)}${look.id > 6 ? '<span class="new-coat">New</span>' : ""}</span><strong>${escape(look.name)}</strong><span class="piece-description">${escape(look.description)}</span><span class="piece-meta">${escape(look.category)}</span><span class="catalog-card-footer"><span class="add-piece-label">+ Add cat</span><span class="placed-quantity">${placed ? `${placed} at home` : "Available"}</span></span></button>`;
        })
        .join("");
    } else {
      const residents = cats.filter((cat) =>
        matches(cat.variant, `${cat.name} ${roomById(cat.roomId).name}`),
      );
      count = residents.length;
      this.list.className = "house-inventory cat-residents";
      this.list.innerHTML = residents
        .map(
          (cat) =>
            `<article class="house-piece resident-cat" data-cat-resident="${escape(cat.id)}"><span class="resident-portrait">${portrait(cat.variant, false)}</span><div class="house-piece-info"><strong>${escape(cat.name)}</strong><span>${escape(catLook(cat.variant).name)}</span></div><label class="resident-room">Home room<select data-cat-room="${escape(cat.id)}" aria-label="Home room for ${escape(cat.name)}">${ROOMS.map((room) => `<option value="${room.id}" ${room.id === cat.roomId ? "selected" : ""}>${room.name}</option>`).join("")}</select></label><div class="house-piece-actions"><button data-cat-meet="${escape(cat.id)}" aria-label="Meet ${escape(cat.name)}">Find cat</button><button data-cat-remove="${escape(cat.id)}" aria-label="Remove ${escape(cat.name)}">Remove</button></div></article>`,
        )
        .join("");
    }
    root.querySelector("#cat-catalog-summary")!.textContent =
      this.mode === "catalog"
        ? `${count} of ${CAT_LOOKS.length} looks · ${cats.length} / ${MAX_CATS} cats at home${cats.length >= MAX_CATS ? " · House full" : ""}`
        : `${count} of ${cats.length} cats at home`;
    if (!count)
      this.list.innerHTML = `<div class="catalog-empty"><strong>${this.mode === "home" && !cats.length ? "A quiet house, ready for cats." : "No cats found."}</strong><p>${query || category ? "Try a different name or coat." : "Choose Cat catalog to welcome a cat."}</p>${query || category ? "<button data-cat-clear>Clear cat filters</button>" : ""}</div>`;
  }
}
