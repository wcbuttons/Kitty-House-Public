import Phaser from "phaser";
import "./style.css";
import {
  ROOMS,
  cloneLayout,
  defaultLayout,
  defById,
  makeFurniture,
  placementError,
  roomById,
  type Furniture,
  type Layout,
} from "./model";
import { History, HouseStorage, CatStorage } from "./storage";
import { Simulation, type Cat } from "./simulation";
import { HouseScene } from "./scene";
import { FurnitureCatalogUI } from "./catalog";
import { CatCatalogUI } from "./cat-catalog";
import { FullscreenView } from "./fullscreen";
import { MAX_CATS, type CatProfile } from "./cat-model";
import { ACTIVE_THEME, THEMES, setActiveTheme } from "./house-theme";
import { VIEW_FRAME } from "./view-frame";
import { DaylightClock } from "./daylight";
type HouseEditSnapshot = { layout: Layout; cats: CatProfile[] };

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="topbar"><a class="brand" href="./" aria-label="Little House home"><span class="brand-mark">⌂</span><span>little house<span class="brand-sub">A HOME FOR CURIOUS CATS</span></span></a><div class="header-actions"><span class="live"><i></i><span id="cat-count">12</span> cats at home</span><button id="edit" class="primary">▦ &nbsp; Edit house</button></div></header>
<main><div class="scene-bar"><div class="place-name"><span class="small-label">WELCOME HOME</span><h1>Make yourself comfortable.</h1></div><div class="view-controls"><button id="pause" aria-label="Pause simulation" title="Pause simulation">Ⅱ</button><button id="zoom-out" aria-label="Zoom out">−</button><button id="fit">Whole house</button><button id="zoom-in" aria-label="Zoom in">+</button><button id="fullscreen" aria-label="Fullscreen house" aria-pressed="false" title="Fullscreen house · Esc to return" disabled><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg><span>Fullscreen</span></button></div></div>
<div class="workspace"><section class="house-stage" tabindex="-1" aria-label="Interactive kitty house"><div id="game" role="img" aria-label="Four rooms and an attic with animated cats and movable furniture"></div><div id="tip" class="stage-tip">Click a cat to get acquainted.</div><div id="debug-stats" hidden></div><div class="fullscreen-controls"><span id="fullscreen-hint"></span><button id="exit-fullscreen" aria-label="Exit fullscreen">↙ &nbsp; Exit fullscreen</button></div></section>
<aside id="editor" hidden aria-label="Furniture editor"><div class="drawer-head"><div><span class="small-label">MAKE ROOM FOR MISCHIEF</span><h2>Arrange the house</h2></div><button id="exit-edit" aria-label="Exit edit mode">×</button></div><p class="drawer-hint">Browse the catalog to add furniture, or choose In the house to move and remove pieces.</p><div class="editor-kinds" role="tablist" aria-label="Edit categories"><button id="furniture-mode" role="tab" aria-selected="true" aria-controls="furniture-tools">Furniture</button><button id="cats-mode" role="tab" aria-selected="false" aria-controls="cat-tools" tabindex="-1">Cats</button></div><div class="history-row"><button id="undo" disabled>↶ Undo</button><button id="redo" disabled>↷ Redo</button><button id="reset">Reset layout</button></div><div id="furniture-tools" role="tabpanel" aria-labelledby="furniture-mode"><form id="placement" hidden><div class="selection-heading"><strong id="piece-name"></strong><span id="anchor-badge"></span></div><label>Room<select id="room">${ROOMS.map((r) => `<option value="${r.id}">${r.name}</option>`).join("")}</select></label><div class="coordinates"><label>Across<input id="grid-x" type="number" step="1" min="0" value="0"/></label><label>Above floor<input id="grid-y" type="number" step="1" min="0" value="0"/></label></div><div id="placement-status" role="status"></div><div class="piece-actions"><button id="apply" class="primary" type="submit">Place piece</button><button id="flip" type="button">⇆ Flip</button><button id="remove" type="button">Remove</button><button id="cancel-piece" type="button">Cancel</button></div></form><section id="catalog" aria-label="Furniture catalog"></section></div><section id="cat-tools" role="tabpanel" aria-labelledby="cats-mode" hidden></section><div class="save-row"><span id="save-state">Saved on this browser</span><button id="save" class="primary">Save layout</button></div></aside>
<aside id="inspector" class="inspector" hidden aria-label="Cat details"><button id="close-inspector" class="close" aria-label="Close cat details">×</button><div class="cat-portrait" id="cat-portrait"></div><span class="small-label">A LITTLE INTRODUCTION</span><h2 id="cat-name"></h2><p id="cat-activity"></p><div id="cat-traits"></div></aside></div>
<footer><div id="activity"><span class="activity-dot"></span><span>A little wandering. A little napping. A very good day.</span></div><div class="footer-actions"><span id="furniture-count"></span><button id="debug" aria-pressed="false">Show paths</button><button id="stress" hidden>25 cats</button></div></footer>
<div id="toast" role="status" aria-live="polite"></div>
<details class="about"><summary>About this little house</summary><p>A local, autonomous dollhouse inspired by the house hub in Mewgenics. Each cat has a home room and wanders through doorways and climbing ladders to rest, visit, and explore. More curious cats venture farther from home. Rearrange furniture to change where they can go.</p><p>Original house and furniture • CC0 cat sprites by <a href="https://luizmelo.itch.io/pet-cat-pack" target="_blank" rel="noreferrer">LuizMelo</a> • Layouts stay in this browser.</p><button id="route-demo">Try the climbing demonstration</button><button id="restore-demo" hidden>Restore my house</button><span id="route-status"></span></details></main>`;
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
$(".place-name").insertAdjacentHTML(
  "beforeend",
  `<div class="house-settings"><label class="theme-picker">House style<select id="house-theme" disabled>${THEMES.map((theme) => `<option value="${theme.id}">${theme.name}</option>`).join("")}</select></label><details id="time-controls" class="time-controls"><summary aria-controls="time-panel">Time of day<span id="time-summary" aria-hidden="true"></span></summary><div id="time-panel" class="time-panel"><div class="time-readout"><strong id="time-value"></strong><span id="time-phase"></span></div><p id="time-mode"></p><label for="time-hour">Choose a time<input id="time-hour" type="range" min="0" max="24" step="0.25" aria-describedby="time-help"/></label><div class="time-scale" aria-hidden="true"><span>Midnight</span><span>Noon</span><span>Midnight</span></div><p id="time-help">Move the slider to hold this time in every house.</p><button id="time-live" type="button">Return to live time</button><p id="time-save-warning" role="status" hidden>Time will last for this visit. This browser could not save it.</p></div></details></div>`,
);
const themePicker = $<HTMLSelectElement>("#house-theme");
themePicker.value = ACTIVE_THEME.id;
themePicker.title = "Each house keeps its own furniture and cats.";
if (ACTIVE_THEME.id !== "original") {
  $(".house-stage").classList.add("illustrated-house");
  $(".place-name h1").textContent =
    ACTIVE_THEME.id === "cabin" || ACTIVE_THEME.id === "cabin-v2"
      ? "A quiet place in the woods."
      : ACTIVE_THEME.id === "tower"
        ? "A little magic on every floor."
        : "Come in. Stay a little longer.";
}
$(".house-stage").classList.toggle(
  "portrait-house",
  ACTIVE_THEME.id === "tower",
);
const hasClimbingDemo =
  ACTIVE_THEME.id === "original" || ACTIVE_THEME.id === "cabin";
$("#route-demo").hidden = !hasClimbingDemo;
$(".about").insertAdjacentHTML(
  "beforeend",
  "<p>Switch house styles above to visit another home. Each house keeps its own furniture and cats in this browser.</p>",
);
let catalog: FurnitureCatalogUI | undefined;
let catCatalog: CatCatalogUI | undefined;
let editorKind: "furniture" | "cats" = "furniture";
const storage = new HouseStorage(),
  catStorage = new CatStorage(),
  history = new History<HouseEditSnapshot>();
const daylight = new DaylightClock();
const timeControls = $<HTMLDetailsElement>("#time-controls");
const timeHome = timeControls.parentElement!;
const timeSlider = $<HTMLInputElement>("#time-hour");
const timePanel = $("#time-panel");
let endOfDaySelected = false;
function updateTimeControls(state = daylight.snapshot()) {
  $("#time-value").textContent = state.timeLabel;
  $("#time-phase").textContent = state.label;
  $("#time-mode").textContent =
    state.mode === "live"
      ? `Live · ${state.zoneLabel}`
      : "Manual time · held until you return to live";
  $("#time-summary").textContent =
    `${state.timeLabel} · ${state.mode === "live" ? "Live" : "Manual"}`;
  timeSlider.value = String(
    state.mode === "manual" && state.hour === 0 && endOfDaySelected
      ? 24
      : state.hour,
  );
  timeSlider.setAttribute(
    "aria-valuetext",
    `${state.timeLabel}, ${state.label}`,
  );
  $("#time-live").toggleAttribute("disabled", state.mode === "live");
  $("#time-save-warning").hidden = daylight.persistenceAvailable;
}
daylight.subscribe(updateTimeControls);
window.addEventListener("pagehide", (event) => {
  // A page restored from the back/forward cache keeps its clock and pageshow listener.
  if (!event.persisted) daylight.dispose();
});
import.meta.hot?.dispose(() => daylight.dispose());
function positionTimePanel() {
  if (!timeControls.open) return;
  const summary = timeControls
    .querySelector("summary")!
    .getBoundingClientRect();
  const below = innerHeight - summary.bottom - 20;
  const above = summary.top - 20;
  const opensAbove =
    below < Math.min(240, timePanel.scrollHeight) && above > below;
  timePanel.style.top = opensAbove ? "auto" : "calc(100% + 8px)";
  timePanel.style.bottom = opensAbove ? "calc(100% + 8px)" : "auto";
  timePanel.style.maxHeight = `${Math.max(60, opensAbove ? above : below)}px`;
  const panelWidth = timePanel.getBoundingClientRect().width;
  const left = Math.max(
    12,
    Math.min(summary.left, innerWidth - panelWidth - 12),
  );
  timePanel.style.left = `${left - timeControls.getBoundingClientRect().left}px`;
}
timeControls.addEventListener("toggle", positionTimePanel);
window.addEventListener("resize", positionTimePanel);
timeSlider.oninput = () => {
  endOfDaySelected = Number(timeSlider.value) === 24;
  daylight.setManual(Number(timeSlider.value));
};
$("#time-live").onclick = () => {
  endOfDaySelected = false;
  daylight.setLive();
};
document.addEventListener("pointerdown", (event) => {
  if (timeControls.open && !timeControls.contains(event.target as Node))
    timeControls.open = false;
});
timeControls.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !timeControls.open) return;
  event.preventDefault();
  event.stopPropagation();
  timeControls.open = false;
  timeControls.querySelector("summary")!.focus();
});
let initial = defaultLayout(),
  storageWarning = "";
try {
  initial = storage.load() ?? initial;
} catch (e) {
  storageWarning = `Could not load the saved layout. Using the demo. ${String(e)}`;
}
const params = new URLSearchParams(location.search);
const sim = new Simulation(
  initial,
  ACTIVE_THEME.defaultCatCount,
  Number(params.get("seed") ?? 47),
);
try {
  const cats = catStorage.load();
  if (cats) sim.replaceRoster(cats);
} catch (e) {
  storageWarning += ` Could not load the saved cats. Using this house's starting cats. ${String(e)}`;
}
let editMode = false,
  selection: Furniture | null = null,
  inspected: string | null = null,
  dirty = false,
  toastTimer: number | undefined,
  ready = false,
  routeBackup: HouseEditSnapshot | null = null,
  stressBackup: CatProfile[] | null = null,
  demoCatId: string | null = null;
const editSnapshot = (): HouseEditSnapshot => ({
  layout: cloneLayout(sim.layout),
  cats: sim.roster(),
});
function toast(message: string) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => $("#toast").classList.remove("show"),
    4200,
  );
}
function save() {
  try {
    storage.save(routeBackup?.layout ?? sim.layout);
    catStorage.save(routeBackup?.cats ?? stressBackup ?? sim.roster());
    dirty = false;
    $("#save-state").textContent = routeBackup
      ? "Demo · your house is saved"
      : "Saved on this browser";
    return true;
  } catch (e) {
    $("#save-state").textContent = "Could not save";
    toast(`Your browser could not save this layout. ${String(e)}`);
    return false;
  }
}
themePicker.onchange = () => {
  const next = THEMES.find((theme) => theme.id === themePicker.value);
  if (!next || next.id === ACTIVE_THEME.id) return;
  if (!save()) {
    themePicker.value = ACTIVE_THEME.id;
    return;
  }
  try {
    setActiveTheme(next.id);
    themePicker.disabled = true;
    location.reload();
  } catch (error) {
    themePicker.value = ACTIVE_THEME.id;
    toast(`Could not switch houses. ${String(error)}`);
  }
};
function syncHistory() {
  $("#undo").toggleAttribute("disabled", !history.canUndo);
  $("#redo").toggleAttribute("disabled", !history.canRedo);
  $("#furniture-count").textContent =
    `${sim.layout.furniture.length} pieces of furniture`;
  catalog?.render();
  catCatalog?.render();
  $("#cat-count").textContent = String(sim.cats.length);
  $("#stress").textContent = stressBackup
    ? `${stressBackup.length} cats`
    : "25 cats";
  $("#game").setAttribute(
    "aria-label",
    `${ACTIVE_THEME.id === "original" ? "Four rooms and an attic" : ACTIVE_THEME.name} with ${sim.cats.length} animated cats and movable furniture`,
  );
}
function changeLayout(layout: Layout, record = true) {
  if (record) history.push(editSnapshot());
  sim.rebuild(layout);
  dirty = true;
  scene.refresh();
  if (routeBackup)
    $("#save-state").textContent = "Demo layout · your house is saved";
  else save();
  syncHistory();
}
function applyEditSnapshot(snapshot: HouseEditSnapshot) {
  sim.rebuild(cloneLayout(snapshot.layout));
  sim.replaceRoster(snapshot.cats);
  scene.refresh();
  cancel();
  if (inspected && !sim.cats.some((cat) => cat.id === inspected)) inspect(null);
  dirty = true;
  if (!routeBackup) save();
  syncHistory();
}
function changeCats(cats: CatProfile[], message: string) {
  const previous = editSnapshot();
  try {
    sim.replaceRoster(cats);
  } catch (error) {
    toast(String(error instanceof Error ? error.message : error));
    catCatalog?.render();
    return;
  }
  history.push(previous);
  if (inspected && !sim.cats.some((cat) => cat.id === inspected)) {
    inspect(null);
    scene.selectedCat = null;
  }
  dirty = true;
  if (!routeBackup) save();
  else $("#save-state").textContent = "Demo cats · your house is saved";
  syncHistory();
  toast(message);
}
function addCat(variant: number, roomId: string) {
  if (sim.cats.length >= MAX_CATS) {
    toast(
      `The house has room for ${MAX_CATS} cats. Remove a cat before adding another.`,
    );
    return;
  }
  const cat = sim.makeCatProfile(variant, roomId);
  changeCats(
    [...sim.roster(), cat],
    `${cat.name} joined ${roomById(roomId).name.toLowerCase()}.`,
  );
}
function removeCat(id: string) {
  const cat = sim.cats.find((cat) => cat.id === id);
  if (cat)
    changeCats(
      sim.roster().filter((cat) => cat.id !== id),
      `${cat.name} removed from the house. Undo is available.`,
    );
}
function moveCat(id: string, roomId: string) {
  const cat = sim.cats.find((cat) => cat.id === id);
  if (cat && cat.homeRoomId !== roomId)
    changeCats(
      sim.roster().map((cat) => (cat.id === id ? { ...cat, roomId } : cat)),
      `${cat.name} moved to ${roomById(roomId).name.toLowerCase()}.`,
    );
}
function select(f: Furniture) {
  selection = { ...f };
  scene.candidate = selection;
  scene.selectedFurniture = f.instanceId;
  scene.refresh();
  $("#placement").hidden = false;
  const d = defById(f.definitionId);
  $("#piece-name").textContent = d.name;
  $("#anchor-badge").textContent = d.anchor === "wall" ? "Back wall" : d.anchor;
  $("#room").setAttribute("data-room", f.roomId);
  $<HTMLSelectElement>("#room").value = f.roomId;
  $<HTMLInputElement>("#grid-x").value = String(f.gridX);
  $<HTMLInputElement>("#grid-y").value = String(f.gridY);
  $("#flip").toggleAttribute("disabled", !d.canFlip);
  $("#remove").toggleAttribute(
    "disabled",
    !sim.layout.furniture.some((o) => o.instanceId === f.instanceId),
  );
  $("#apply").textContent = sim.layout.furniture.some(
    (o) => o.instanceId === f.instanceId,
  )
    ? "Apply position"
    : "Place piece";
  status();
}
function status() {
  if (!selection) return;
  const error = placementError(selection, sim.layout);
  $("#placement-status").textContent = error ?? "✓ This placement works";
  $("#placement-status").className = error ? "invalid" : "valid";
  $("#apply").toggleAttribute("disabled", !!error);
}
function cancel() {
  selection = null;
  scene.clearSelection();
  $("#placement").hidden = true;
}
function commit(f: Furniture) {
  const error = placementError(f, sim.layout);
  if (error) {
    select(f);
    toast(error);
    return false;
  }
  const next = cloneLayout(sim.layout),
    index = next.furniture.findIndex((o) => o.instanceId === f.instanceId);
  if (index >= 0) next.furniture[index] = { ...f };
  else next.furniture.push({ ...f });
  changeLayout(next);
  select(f);
  toast(
    `${defById(f.definitionId).name} placed. The cats are exploring their new routes.`,
  );
  return true;
}
function inspect(c: Cat | null) {
  inspected = c?.id ?? null;
  $("#inspector").hidden = !c;
  if (c) {
    $("#cat-name").textContent = c.name;
    $("#cat-portrait").style.backgroundImage =
      `url('${import.meta.env.BASE_URL}assets/cats/Cat-${c.variant}/Cat-${c.variant}-Sitting.png')`;
    updateInspector();
  }
}
const actionNames: Record<string, string> = {
  idle: "Taking it all in",
  walk: "On a little wander",
  jump: "Making a leap",
  drop: "Heading back down",
  sleep: "Enjoying a well-earned nap",
  sit: "Sitting pretty",
  groom: "Washing up",
  scratch: "Having a good scratch",
  perch: "Watching the world go by",
  hide: "Claiming a hideaway",
  play: "Watching, pouncing and playing",
  recover: "Finding a safe landing",
  anticipate: "Ready, set…",
  cross: "Exploring another room",
  climb: "Climbing between floors",
  wait: "Waiting for the passage",
};
const catActivity = $("#cat-activity");
const inspectorTraits = (
  [
    ["energy", "Energy"],
    ["curiosity", "Curiosity"],
    ["laziness", "Love of naps"],
    ["sociability", "Sociability"],
  ] as const
).map(([key, label]) => {
  const row = document.createElement("div");
  row.className = "trait";
  const name = document.createElement("span");
  name.textContent = label;
  const meter = document.createElement("meter");
  meter.min = 0;
  meter.max = 1;
  meter.setAttribute("aria-label", label);
  row.append(name, meter);
  $("#cat-traits").append(row);
  return { key, meter };
});
function updateInspector() {
  const c = sim.cats.find((c) => c.id === inspected);
  if (!c) return;
  const place = c.move?.passage
    ? `On the way to ${roomById(c.move.passage.toRoomId).name.toLowerCase()}`
    : roomById(c.roomId).name;
  const partner =
    c.social && sim.cats.find((cat) => cat.id === c.social!.partnerId);
  const target =
    c.goal?.interaction &&
    sim.layout.furniture.find(
      (piece) => piece.instanceId === c.goal!.interaction!.furnitureId,
    );
  let activity = actionNames[c.state];
  if (partner) {
    activity =
      c.social!.phase === "approach"
        ? c.social!.initiator
          ? `Going over to ${partner.name}`
          : `Watching ${partner.name} come over`
        : c.social!.kind === "greet"
          ? `Saying a quiet hello to ${partner.name}`
          : `Keeping ${partner.name} company`;
  } else if (target && (c.state === "scratch" || c.state === "hide")) {
    const item = defById(target.definitionId).name.toLowerCase();
    activity =
      c.state === "scratch"
        ? `Sharpening claws on the ${item}`
        : `Tucked into the ${item}`;
  }
  const description = `${activity} · ${place}${c.roomId !== c.homeRoomId ? ` · Home: ${roomById(c.homeRoomId).name.toLowerCase()}` : ""}`;
  if (catActivity.textContent !== description)
    catActivity.textContent = description;
  // Keep rows and unchanged text in place while a person scrolls or selects
  // the introduction; live refreshes only change the current cat's values.
  for (const { key, meter } of inspectorTraits) {
    const value = c[key];
    if (meter.value !== value) meter.value = value;
    const percentage = `${Math.round(value * 100)}%`;
    if (meter.textContent !== percentage) meter.textContent = percentage;
  }
}
const scene = new HouseScene(
  sim,
  {
    selectCat: inspect,
    selectFurniture: select,
    preview: select,
    commit,
    ready: () => {
      catalog = new FurnitureCatalogUI({
        element: $("#catalog"),
        layout: () => sim.layout,
        thumbnail: (id) => scene.catalogThumbnail(id),
        add: addFromCatalog,
        move: (f) => {
          select(f);
          $("#editor").scrollTop = 0;
        },
        remove: removeFurniture,
      });
      catCatalog = new CatCatalogUI({
        element: $("#cat-tools"),
        roster: () => sim.roster(),
        add: addCat,
        remove: removeCat,
        move: moveCat,
        meet: (id) => {
          const cat = sim.cats.find((cat) => cat.id === id);
          if (cat) {
            inspect(cat);
            scene.selectedCat = cat.id;
            $(".house-stage").scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
          }
        },
      });
      ready = true;
      $("#fullscreen").removeAttribute("disabled");
      themePicker.disabled = false;
      syncHistory();
      if (storageWarning) toast(storageWarning);
    },
  },
  daylight,
);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: VIEW_FRAME.width,
  height: VIEW_FRAME.height,
  backgroundColor: "#112d35",
  pixelArt: true,
  roundPixels: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [scene],
  audio: { noAudio: true },
});
function restoreStress() {
  if (!stressBackup) return;
  sim.replaceRoster(stressBackup);
  stressBackup = null;
  syncHistory();
}
function setEditorKind(kind: "furniture" | "cats") {
  editorKind = kind;
  cancel();
  inspect(null);
  scene.selectedCat = null;
  $("#furniture-tools").hidden = kind !== "furniture";
  $("#cat-tools").hidden = kind !== "cats";
  for (const name of ["furniture", "cats"] as const) {
    const tab = $<HTMLButtonElement>(`#${name}-mode`);
    tab.setAttribute("aria-selected", String(name === kind));
    tab.tabIndex = name === kind ? 0 : -1;
  }
  $("#editor").setAttribute(
    "aria-label",
    kind === "cats" ? "Cat editor" : "Furniture editor",
  );
  $(".drawer-hint").textContent =
    kind === "cats"
      ? "Welcome a cat from the catalog, or manage the cats already at home."
      : "Browse the catalog to add furniture, or choose In the house to move and remove pieces.";
  $("#reset").textContent = kind === "cats" ? "Reset cats" : "Reset layout";
  $("#save").textContent = kind === "cats" ? "Save cats" : "Save layout";
  $("#tip").textContent =
    kind === "cats"
      ? "Click a cat to get acquainted."
      : "The cats keep exploring while you rearrange.";
  scene.edit = editMode && kind === "furniture";
  scene.refresh();
}
$("#furniture-mode").onclick = () => setEditorKind("furniture");
$("#cats-mode").onclick = () => setEditorKind("cats");
$(".editor-kinds").onkeydown = (e) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  setEditorKind(
    e.key === "Home"
      ? "furniture"
      : e.key === "End"
        ? "cats"
        : editorKind === "cats"
          ? "furniture"
          : "cats",
  );
  $(`#${editorKind}-mode`).focus();
};
function setEdit(value: boolean) {
  if (value) restoreStress();
  editMode = value;
  scene.edit = value && editorKind === "furniture";
  scene.refresh();
  scene.fit();
  $("#editor").hidden = !value;
  $("#edit").textContent = value ? "✓ Finish editing" : "▦  Edit house";
  $("#edit").setAttribute("aria-pressed", String(value));
  $("#tip").textContent =
    value && editorKind === "furniture"
      ? "The cats keep exploring while you rearrange."
      : "Click a cat to get acquainted.";
  if (value) inspect(null);
  else {
    cancel();
    if (dirty) save();
  }
  window.setTimeout(() => game.scale.refresh(), 50);
}
$("#edit").onclick = () => setEdit(!editMode);
$("#exit-edit").onclick = () => setEdit(false);
function addFromCatalog(id: string) {
  const d = defById(id),
    room = selection?.roomId ?? ROOMS[0].id,
    r = roomById(room);
  let f = makeFurniture(
    id,
    room,
    0,
    d.anchor === "ceiling" ? r.height - 3 : d.anchor === "wall" ? 3 : 0,
  );
  for (let x = 0; x <= r.width - d.width; x++) {
    const candidate = { ...f, gridX: x };
    if (!placementError(candidate, sim.layout)) {
      f = candidate;
      break;
    }
  }
  select(f);
  $("#editor").scrollTop = 0;
}
function removeFurniture(id: string) {
  const existing = sim.layout.furniture.find((f) => f.instanceId === id);
  if (!existing) return;
  const next = cloneLayout(sim.layout);
  next.furniture = next.furniture.filter((f) => f.instanceId !== id);
  if (selection?.instanceId === id) cancel();
  changeLayout(next);
  if (selection) status();
  toast(`${defById(existing.definitionId).name} removed. Undo is available.`);
}
for (const id of ["room", "grid-x", "grid-y"])
  $(`#${id}`).oninput = () => {
    if (!selection) return;
    select({
      ...selection,
      roomId: $<HTMLSelectElement>("#room").value,
      gridX: Number($<HTMLInputElement>("#grid-x").value),
      gridY: Number($<HTMLInputElement>("#grid-y").value),
    });
  };
$("#placement").onsubmit = (e) => {
  e.preventDefault();
  if (selection) commit(selection);
};
$("#flip").onclick = () => {
  if (selection && defById(selection.definitionId).canFlip)
    select({ ...selection, flipX: !selection.flipX });
};
$("#remove").onclick = () => {
  if (selection) removeFurniture(selection.instanceId);
};
$("#cancel-piece").onclick = cancel;
$("#undo").onclick = () => {
  const next = history.undo(editSnapshot());
  if (next) {
    applyEditSnapshot(next);
    toast("Last change undone.");
  }
};
$("#redo").onclick = () => {
  const next = history.redo(editSnapshot());
  if (next) {
    applyEditSnapshot(next);
    toast("Change restored.");
  }
};
$("#reset").onclick = () => {
  if (editorKind === "cats") {
    changeCats(
      new Simulation(sim.layout, ACTIVE_THEME.defaultCatCount).roster(),
      ACTIVE_THEME.id === "original"
        ? "Original twelve cats restored. You can undo this."
        : "This house's starting cats restored. You can undo this.",
    );
    return;
  }
  changeLayout(defaultLayout());
  cancel();
  toast("Demo layout restored. You can undo this.");
};
$("#save").onclick = () => {
  if (save())
    toast(
      routeBackup
        ? "Your saved house is preserved while you try the demo."
        : editorKind === "cats"
          ? "Cats saved in this browser."
          : "Layout saved in this browser.",
    );
};
$("#pause").onclick = () => {
  sim.paused = !sim.paused;
  $("#pause").textContent = sim.paused ? "▶" : "Ⅱ";
  $("#pause").setAttribute(
    "aria-label",
    sim.paused ? "Resume simulation" : "Pause simulation",
  );
};
$("#zoom-in").onclick = () => scene.zoom(0.15);
$("#zoom-out").onclick = () => scene.zoom(-0.15);
$("#fit").onclick = () => scene.fit();
let previousZoom = 1;
const inspectorHome = $("#inspector").parentElement!;
new FullscreenView(
  $(".house-stage"),
  $<HTMLButtonElement>("#fullscreen"),
  $<HTMLButtonElement>("#exit-fullscreen"),
  $("#fullscreen-hint"),
  (active) => {
    if (active) {
      previousZoom = scene.zoomLevel;
      if (editMode) setEdit(false);
      inspect(null);
      scene.selectedCat = null;
      scene.fit();
      // Native fullscreen only renders descendants of the fullscreen element.
      $(".house-stage").append($("#inspector"));
      $(".house-stage").append(timeControls);
    } else {
      inspectorHome.append($("#inspector"));
      timeHome.append(timeControls);
      scene.zoom(previousZoom - scene.zoomLevel);
    }
    timeControls.open = false;
    scene.setPresentation(active);
    requestAnimationFrame(() => game.scale.refresh());
  },
);
// Keep the canvas fitted after fullscreen transitions and mobile rotation.
new ResizeObserver(() => game.scale.refresh()).observe($("#game"));
$("#close-inspector").onclick = () => {
  const hadFocus = document.activeElement === $("#close-inspector");
  inspect(null);
  scene.selectedCat = null;
  if (scene.presentation && hadFocus)
    $(".house-stage").focus({ preventScroll: true });
};
$("#debug").onclick = () => {
  scene.debug = !scene.debug;
  $("#debug").setAttribute("aria-pressed", String(scene.debug));
  $("#debug").textContent = scene.debug ? "Hide paths" : "Show paths";
  $("#debug-stats").hidden = !scene.debug;
  $("#stress").hidden = !scene.debug;
};
$("#stress").onclick = () => {
  if (stressBackup) restoreStress();
  else {
    if (editMode) setEdit(false);
    stressBackup = sim.roster();
    sim.setCount(25);
    syncHistory();
  }
};
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).matches("input,select,textarea")) return;
  if (e.key === "Escape") {
    cancel();
    inspect(null);
  }
  if (editMode && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    $(e.shiftKey ? "#redo" : "#undo").click();
  }
});
let routeStep = 0;
function routeDemo() {
  if (!hasClimbingDemo) return;
  if (routeStep === 0) {
    restoreStress();
    routeBackup = editSnapshot();
    if (!sim.cats.some((cat) => cat.roomId === "lounge")) {
      if (sim.cats.length) sim.relocate(sim.cats[0], "lounge");
      else sim.replaceRoster([sim.makeCatProfile(1, "lounge")]);
    }
    demoCatId = sim.cats.find((cat) => cat.roomId === "lounge")!.id;
    const next = cloneLayout(sim.layout);
    next.furniture = next.furniture.filter((f) => f.roomId !== "lounge");
    next.furniture.push(
      makeFurniture("shelf", "lounge", 8, 3, "route-perch"),
      makeFurniture("large-crate", "lounge", 1, 0, "route-step"),
    );
    changeLayout(next);
    const c = sim.cats.find((cat) => cat.id === demoCatId);
    if (!c) {
      toast(
        "Restore your house and restart the demonstration to choose a cat.",
      );
      return;
    }
    c.goal = null;
    c.path = [];
    c.move = null;
    c.surfaceId = sim.graph.surfaces.find(
      (s) => s.roomId === "lounge" && s.y === 0 && s.x0 > 3,
    )!.id;
    c.x = 5;
    c.y = 0;
    c.state = "idle";
    c.timer = 999;
    routeStep = 1;
    $("#route-demo").textContent = "Move the stepping crate";
    $("#route-status").textContent =
      "The high shelf is unreachable. Move the crate closer to create a route.";
    $("#restore-demo").hidden = false;
    inspect(c);
    scene.selectedCat = c.id;
  } else if (routeStep === 1) {
    const next = cloneLayout(sim.layout);
    next.furniture.find((f) => f.instanceId === "route-step")!.gridX = 6;
    changeLayout(next);
    const c = sim.cats.find((cat) => cat.id === demoCatId);
    if (!c) {
      toast(
        "Restore your house and restart the demonstration to choose a cat.",
      );
      return;
    }
    const goal = sim.graph.goals.find(
      (g) => sim.surface(g.surfaceId)?.owner === "route-perch",
    )!;
    sim.requestGoal(c, goal);
    routeStep = 2;
    $("#route-demo").textContent = "Remove the occupied shelf";
    $("#route-status").textContent =
      `Watch ${c.name} hop onto the crate, then onto the shelf. Remove it after arrival.`;
  } else {
    const next = cloneLayout(sim.layout);
    next.furniture = next.furniture.filter(
      (f) => f.instanceId !== "route-perch",
    );
    changeLayout(next);
    $("#route-status").textContent =
      "The cat finds a safe landing. Restore your house when you are ready.";
    $("#route-demo").hidden = true;
  }
}
$("#route-demo").onclick = routeDemo;
$("#restore-demo").onclick = () => {
  const original = routeBackup;
  routeBackup = null;
  if (original) {
    history.push(editSnapshot());
    applyEditSnapshot(original);
  }
  demoCatId = null;
  routeStep = 0;
  $("#route-demo").hidden = false;
  $("#route-demo").textContent = "Try the climbing demonstration";
  $("#restore-demo").hidden = true;
  $("#route-status").textContent = "";
};
window.setInterval(() => {
  if (!ready) return;
  updateInspector();
  const latest = sim.events[0];
  if (latest) {
    $("#activity").innerHTML =
      '<span class="activity-dot"></span><span><strong></strong></span>';
    $("#activity strong").textContent = latest.cat;
    $("#activity strong").after(document.createTextNode(` ${latest.text}.`));
  }
  if (scene.debug)
    $("#debug-stats").textContent =
      `${Math.round(game.loop.actualFps)} FPS · ${sim.cats.length} cats · ${sim.graph.surfaces.length} surfaces · ${sim.graph.edges.length} links · ${sim.pathSearches} route searches`;
}, 500);
// Read-only observability by default; controlled test hooks are enabled only with ?test=1.
const api = {
  theme: () => ACTIVE_THEME.id,
  daylight: () => daylight.snapshot(),
  snapshot: () => sim.snapshot(),
  layout: () => cloneLayout(sim.layout),
  ready: () => ready,
  roster: () => sim.roster(),
};
Object.assign(window, {
  kitty: params.has("test")
    ? {
        ...api,
        simulation: sim,
        daylightClock: daylight,
        scene,
        setLayout: (l: Layout) => changeLayout(l),
        step: (seconds: number) => {
          for (let t = 0; t < seconds; t += 1 / 60) sim.step(1 / 60);
        },
        selectFurniture: (id: string) => {
          setEdit(true);
          setEditorKind("furniture");
          const f = sim.layout.furniture.find((f) => f.instanceId === id);
          if (f) select(f);
        },
      }
    : api,
});
