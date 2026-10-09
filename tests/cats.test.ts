import { expect, test } from "vitest";
import { Simulation } from "../src/simulation";
import { defaultLayout } from "../src/model";
import { CAT_LOOKS, MAX_CATS, validateRoster } from "../src/cat-model";
import { CatStorage, CAT_STORAGE_KEY, History } from "../src/storage";
import { bodyClear } from "../src/navigation";

test("catalog cats spawn on clear supports, keep identities and traits, and release removed reservations", () => {
  const sim = new Simulation(defaultLayout());
  const original = sim.roster();
  for (const look of CAT_LOOKS) {
    const profile = sim.makeCatProfile(look.id, "lounge");
    sim.replaceRoster([...sim.roster(), profile]);
    const cat = sim.cats.find((cat) => cat.id === profile.id)!;
    expect(cat.variant).toBe(look.id);
    expect(cat.roomId).toBe("lounge");
    expect(
      bodyClear(cat.roomId, cat.x, cat.y, sim.graph.solids.get(cat.roomId)!),
    ).toBe(true);
    expect(sim.surface(cat.surfaceId)?.roomId).toBe("lounge");
  }
  expect(new Set(sim.cats.map((cat) => cat.id)).size).toBe(sim.cats.length);
  const cat = sim.cats[0];
  const goal = sim.graph.goals.find(
    (g) => sim.surface(g.surfaceId)?.roomId === cat.roomId,
  )!;
  cat.goal = goal;
  sim.replaceRoster(sim.roster().filter((c) => c.id !== cat.id));
  expect(sim.cats.some((c) => c.goal?.key === goal.key)).toBe(false);
  sim.replaceRoster(original);
  expect(sim.roster()).toEqual(original);
});

test("moving a cat changes its room and motion safely without restarting other cats", () => {
  const sim = new Simulation(defaultLayout());
  sim.step(0.5);
  const other = structuredClone(sim.cats[1]);
  const profile = sim.roster()[0];
  sim.replaceRoster(
    sim
      .roster()
      .map((cat) =>
        cat.id === profile.id ? { ...cat, roomId: "playroom" } : cat,
      ),
  );
  const moved = sim.cats[0];
  expect(moved.roomId).toBe("playroom");
  expect(sim.surface(moved.surfaceId)?.roomId).toBe("playroom");
  expect(moved.goal).toBeNull();
  expect(moved.path).toEqual([]);
  expect(sim.cats[1]).toEqual(other);
  expect(moved.curiosity).toBe(profile.curiosity);
  // No landing is available: the existing roster must survive the rejected move.
  const before = sim.roster();
  sim.graph.surfaces = sim.graph.surfaces.filter((s) => s.roomId !== "attic");
  expect(() =>
    sim.replaceRoster(
      before.map((cat) =>
        cat.id === moved.id ? { ...cat, roomId: "attic" } : cat,
      ),
    ),
  ).toThrow("clear surface");
  expect(sim.roster()).toEqual(before);
});

test("cat persistence supports an empty house, validates stored identities, and keeps active identities unique after reload", () => {
  const data = new Map<string, string>();
  const storage = new CatStorage({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  });
  const sim = new Simulation(defaultLayout());
  storage.save(sim.roster());
  const restored = new Simulation(defaultLayout(), 0);
  restored.replaceRoster(storage.load()!);
  expect(restored.roster()).toEqual(sim.roster());
  const profile = restored.makeCatProfile(CAT_LOOKS.at(-1)!.id, "attic");
  expect(sim.cats.some((cat) => cat.id === profile.id)).toBe(false);
  storage.save([]);
  expect(storage.load()).toEqual([]);
  restored.replaceRoster([]);
  restored.step(3);
  expect(restored.cats).toEqual([]);
  data.set(
    CAT_STORAGE_KEY,
    JSON.stringify({ version: 1, cats: [{ ...profile, variant: 999 }] }),
  );
  expect(() => storage.load()).toThrow("appearance");
  expect(() => validateRoster([profile, profile])).toThrow("identity");
  expect(() => validateRoster(Array(MAX_CATS + 1).fill(profile))).toThrow(
    "roster",
  );
  expect(() => validateRoster([{ ...profile, curiosity: Infinity }])).toThrow(
    "traits",
  );
});

test("one edit history restores furniture and cat choices together", () => {
  const sim = new Simulation(defaultLayout());
  const initial = { layout: defaultLayout(), cats: sim.roster() };
  const history = new History<typeof initial>();
  history.push(initial);
  const edited = {
    layout: { ...defaultLayout(), furniture: [] },
    cats: sim.roster().slice(1),
  };
  expect(history.undo(edited)).toEqual(initial);
  expect(history.redo(initial)).toEqual(edited);
});
