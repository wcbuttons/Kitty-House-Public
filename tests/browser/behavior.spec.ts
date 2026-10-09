import { expect, test } from "@playwright/test";

test("a cat passes a long-napping neighbor on the sofa and settles for a longer groom", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  await page.evaluate(() => {
    const api = (window as any).kitty;
    const sim = api.simulation;
    sim.paused = true;
    api.setLayout({
      version: 1,
      furniture: [
        {
          definitionId: "couch",
          instanceId: "traffic-couch",
          roomId: "lounge",
          gridX: 4,
          gridY: 0,
          flipX: false,
        },
      ],
    });
    sim.replaceRoster(
      sim
        .roster()
        .slice(0, 2)
        .map((profile: any) => ({ ...profile, roomId: "lounge" })),
    );
    const surface = sim.graph.surfaces.find(
      (s: any) => s.owner === "traffic-couch",
    );
    const [walker, sleeper] = sim.cats;
    const sleep = sim.graph.goals.find(
      (g: any) =>
        g.surfaceId === surface.id && g.x === 6 && g.action === "sleep",
    );
    const groom = sim.graph.goals.find(
      (g: any) => g.surfaceId === surface.id && g.x > 7 && g.action === "groom",
    );
    for (const cat of sim.cats)
      Object.assign(cat, {
        surfaceId: surface.id,
        y: surface.y,
        state: "idle",
        move: null,
        path: [],
        goal: null,
        laziness: 1,
        energy: 0,
        curiosity: 0,
        timer: 0,
        stuck: 0,
      });
    walker.x = surface.x0 + 0.3;
    sleeper.x = sleep.x;
    sim.requestGoal(sleeper, sleep);
    // Let the normal arrival state assign the nap duration, rather than forcing a timer.
    sim.paused = false;
    sim.step(1 / 60);
    sim.requestGoal(walker, groom);
    sim.paused = true;
  });
  const before = await page.evaluate(() => (window as any).kitty.snapshot());
  expect(before.cats[1].state).toBe("sleep");
  expect(before.cats[1].timer).toBeGreaterThan(100);
  await page.evaluate(() => {
    (window as any).kitty.simulation.paused = false;
  });
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (window as any).kitty.snapshot())).cats[0].x,
      { timeout: 10000 },
    )
    .toBeGreaterThan(6.6);
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (window as any).kitty.snapshot())).cats[0]
          .state,
      { timeout: 5000 },
    )
    .toBe("groom");
  await page.evaluate(() => {
    (window as any).kitty.simulation.paused = true;
  });
  const after = await page.evaluate(() => (window as any).kitty.snapshot());
  expect(after.cats[1].state).toBe("sleep");
  expect(after.cats[1].x).toBe(6);
  expect(after.cats[1].timer).toBeGreaterThan(90);
  expect(after.cats[0].timer).toBeGreaterThan(25);
  expect(after.cats[0].y).toBe(after.cats[1].y);
  expect(after.recoveries).toBe(before.recoveries);
  expect(after.pathSearches).toBe(before.pathSearches);
  expect(errors).toEqual([]);
});
