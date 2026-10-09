import { afterEach, expect, test, vi } from "vitest";
import { buildSync } from "esbuild";
import type { ThemeId } from "../src/house-theme";

const data = new Map<string, string>();
const backend = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value),
};

async function startup(defaultHouse?: string) {
  vi.stubEnv("VITE_DEFAULT_HOUSE", defaultHouse);
  vi.stubGlobal("window", { localStorage: backend });
  vi.stubGlobal("localStorage", backend);
  vi.resetModules();
  return import("../src/house-theme");
}

async function world(defaultHouse?: string) {
  const theme = await startup(defaultHouse);
  return {
    ...theme,
    ...(await import("../src/model")),
    ...(await import("../src/storage")),
    ...(await import("../src/simulation")),
  };
}

afterEach(() => {
  data.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("ordinary builds and invalid default configuration open the original house", async () => {
  for (const value of [undefined, "", "removed-style"]) {
    expect((await startup(value)).ACTIVE_THEME.id).toBe("original");
    expect(data.size).toBe(0);
  }
});

test("a fresh ramen build opens the shop with its own world and save names", async () => {
  const app = await world("ramen");
  expect(app.ACTIVE_THEME.id).toBe("ramen");
  expect(app.ROOMS.map((room) => room.id)).toEqual([
    "shop",
    "studio",
    "terrace",
  ]);
  const sim = new app.Simulation(
    app.defaultLayout(),
    app.ACTIVE_THEME.defaultCatCount,
  );
  expect(sim.cats).toHaveLength(6);
  expect(app.STORAGE_KEY).toBe("little-house.layout.v1.ramen");
  expect(app.CAT_STORAGE_KEY).toBe("little-house.cats.v1.ramen");
  expect(data.size).toBe(0); // Choosing a default does not overwrite a preference.
});

test.each(["original", "cabin", "ramen", "tower", "cabin-v2", "ramen-v2"] as const)(
  "a returning %s visitor keeps their choice, customized furniture, cats and time",
  async (id: ThemeId) => {
    data.set("little-house.theme.v1", id);
    const previous = await world();
    const layout = previous.defaultLayout();
    layout.furniture.pop();
    const sim = new previous.Simulation(
      layout,
      previous.ACTIVE_THEME.defaultCatCount,
    );
    const cats = sim.roster().slice(0, 2);
    cats[0].name = "Saved resident";
    new previous.HouseStorage(backend).save(layout);
    new previous.CatStorage(backend).save(cats);
    const previousClock = new (await import("../src/daylight")).DaylightClock({
      storage: backend,
      window: null,
      document: null,
    });
    previousClock.setManual(17.25);
    previousClock.dispose();
    const saved = new Map(data);

    const hosted = await world("ramen");
    expect(hosted.ACTIVE_THEME.id).toBe(id);
    expect(new hosted.HouseStorage(backend).load()).toEqual(layout);
    expect(new hosted.CatStorage(backend).load()).toEqual(cats);
    const { DaylightClock } = await import("../src/daylight");
    const clock = new DaylightClock({
      storage: backend,
      window: null,
      document: null,
    });
    try {
      expect(clock.snapshot()).toMatchObject({ mode: "manual", hour: 17.25 });
    } finally {
      clock.dispose();
    }
    expect(data).toEqual(saved);
  },
);

test("corrupt theme preferences use the configured default without rewriting saved data", async () => {
  data.set("little-house.layout.v1", "existing original layout");
  data.set("little-house.cats.v1", "existing original roster");
  data.set("little-house.daylight.v1", "existing time preference");
  for (const preference of ["", "removed-style", "{broken"]) {
    data.set("little-house.theme.v1", preference);
    const saved = new Map(data);
    expect((await startup("ramen")).ACTIVE_THEME.id).toBe("ramen");
    expect(data).toEqual(saved);
  }
});

test("blocked storage reads and a blocked localStorage getter still open the configured home", async () => {
  const app = await startup("ramen");
  expect(
    app.readActiveTheme({
      getItem: () => {
        throw Error("Blocked");
      },
    }).id,
  ).toBe("ramen");
  vi.stubGlobal("window", {
    get localStorage(): Storage {
      throw Error("Blocked");
    },
  });
  vi.resetModules();
  expect((await import("../src/house-theme")).ACTIVE_THEME.id).toBe("ramen");
  expect(data.size).toBe(0);
});

test("native art tools can bundle the model as CommonJS without Vite's environment", () => {
  // Match both native art builders' in-memory model loading, without exporting art.
  const output = buildSync({
    stdin: {
      contents:
        "export {CATALOG,TOWER_CATALOG} from './src/model'; export {THEMES,ACTIVE_THEME} from './src/house-theme';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    logOverride: { "empty-import-meta": "silent" },
  }).outputFiles[0].text;
  for (const id of [null, "ramen", "tower", "cabin-v2", "ramen-v2"] as const) {
    const moduleData = { exports: {} };
    new Function("module", "exports", "window", output)(
      moduleData,
      moduleData.exports,
      { localStorage: { getItem: () => id } },
    );
    const manifest = moduleData.exports as {
      ACTIVE_THEME: { id: ThemeId };
      THEMES: { id: ThemeId }[];
      CATALOG: { id: string }[];
      TOWER_CATALOG: { id: string }[];
    };
    expect(manifest.ACTIVE_THEME.id).toBe(id ?? "original");
    expect(manifest.THEMES.map((theme) => theme.id)).toEqual([
      "original",
      "cabin",
      "ramen",
      "tower",
      "cabin-v2",
      "ramen-v2",
    ]);
    if (id === "cabin-v2" || id === "ramen-v2")
      expect(manifest.CATALOG.length).toBeGreaterThanOrEqual(10);
    else
      expect(manifest.CATALOG).toHaveLength(id === "tower" ? 12 : id === "ramen" ? 34 : 28);
    expect(manifest.TOWER_CATALOG).toHaveLength(12);
  }
});
