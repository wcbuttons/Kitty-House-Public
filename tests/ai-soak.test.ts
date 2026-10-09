import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test.each(["original", "cabin", "ramen"])(
  "%s cats sustain varied, safe, independent routines for 20 simulated minutes",
  async (theme) => {
    const storage = { getItem: () => theme };
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("localStorage", storage);
    vi.resetModules();
    const { Simulation } = await import("../src/simulation");
    const { defaultLayout, ROOMS } = await import("../src/model");
    const { ACTIVE_THEME } = await import("../src/house-theme");
    const { bodyClear } = await import("../src/navigation");
    const sim = new Simulation(
      defaultLayout(),
      ACTIVE_THEME.defaultCatCount,
      917,
    );
    const states = new Set<string>();
    let pairedFrames = 0;
    for (let frame = 0; frame < 24000; frame++) {
      sim.step(0.05);
      if (frame % 20 !== 0) continue;
      for (const cat of sim.cats) {
        states.add(cat.state);
        if (cat.social?.phase === "settled") pairedFrames++;
        expect(Number.isFinite(cat.x) && Number.isFinite(cat.y)).toBe(true);
        if (!cat.move?.passage)
          expect(
            bodyClear(
              cat.roomId,
              cat.x,
              cat.y,
              sim.graph.solids.get(cat.roomId)!,
            ),
          ).toBe(true);
        if (cat.social) {
          const partner = sim.cats.find(
            (other) => other.id === cat.social!.partnerId,
          )!;
          expect(partner?.social?.partnerId).toBe(cat.id);
          expect(partner.state).not.toBe("sleep");
        }
      }
    }
    expect(sim.recoveries).toBe(0);
    for (const state of ["sleep", "sit", "groom", "walk", "perch", "play"])
      expect(states.has(state), state).toBe(true);
    expect(new Set(sim.cats.flatMap((cat) => cat.visitedRooms))).toEqual(
      new Set(ROOMS.map((room) => room.id)),
    );
    expect(sim.cats.every((cat) => cat.visited.length > 3)).toBe(true);
    expect(pairedFrames / (1200 * sim.cats.length)).toBeLessThan(0.04);
    const socialCount = sim.cats.reduce(
      (sum, cat) => sum + (cat.actions.greet ?? 0) + (cat.actions.company ?? 0),
      0,
    );
    expect(socialCount).toBeGreaterThan(0);
    expect(socialCount).toBeLessThan(sim.cats.length * 5);
  },
  15000,
);
