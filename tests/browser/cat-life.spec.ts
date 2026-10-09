import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const previousDefaults = JSON.parse(
  readFileSync(
    new URL("../../src/default-layouts-v0.9.0.json", import.meta.url),
    "utf8",
  ),
) as Record<
  "original" | "cabin" | "ramen",
  [string, string, number, number?][]
>;

async function ready(page: Page, theme = "original") {
  await page.addInitScript(
    (id) => localStorage.setItem("little-house.theme.v1", id),
    theme,
  );
  await page.goto("/?test=1&seed=101");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
}

const observe = (page: Page) =>
  page.evaluate(() => {
    const app = (window as any).kitty;
    return {
      elapsed: app.simulation.elapsed,
      cats: app.simulation.cats.map((cat: any) => {
        const sprite = app.scene.children.getByName(`resident-${cat.id}`);
        return {
          id: cat.id,
          state: cat.state,
          timer: cat.timer,
          actionElapsed: cat.actionElapsed,
          energy: cat.energy,
          needs: { ...cat.needs },
          texture: sprite.texture.key,
          frame: sprite.frame.name,
          x: sprite.x,
          y: sprite.y,
          scaleX: sprite.scaleX,
          scaleY: sprite.scaleY,
          angle: sprite.angle,
          depth: sprite.depth,
        };
      }),
    };
  });

test("Pause freezes grooming frames, breathing, and needs; Resume continues varied washing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  const loaded = await page.evaluate(() => {
    const scene = (window as any).kitty.scene;
    return Array.from({ length: 18 }, (_, index) => index + 1).every(
      (variant) =>
        [
          ["greet", 4],
          ["wash", 5],
        ].every(([state, frames]) => {
          const key = `cat-${variant}-${state}`;
          return (
            scene.textures.exists(key) &&
            scene.textures.get(key).getFrameNames().length === frames
          );
        }),
    );
  });
  expect(loaded).toBe(true);
  await page.evaluate(() => {
    const app = (window as any).kitty,
      sim = app.simulation;
    sim.paused = true;
    app.setLayout({
      version: 1,
      furniture: [
        {
          instanceId: "quiet-couch",
          definitionId: "couch",
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
      (s: any) => s.owner === "quiet-couch",
    );
    for (const [index, cat] of sim.cats.entries()) {
      const action = index === 0 ? "groom" : "sleep";
      const goals = sim.graph.goals.filter(
        (g: any) => g.surfaceId === surface.id && g.action === action,
      );
      const goal = index === 0 ? goals[0] : goals[goals.length - 1];
      Object.assign(cat, {
        x: goal.x,
        y: surface.y,
        surfaceId: surface.id,
        state: "idle",
        goal: null,
        move: null,
        path: [],
        sociability: 0,
        timer: 0,
      });
      if (!sim.requestGoal(cat, goal)) throw Error(`Cannot start ${action}`);
    }
    sim.paused = false;
    for (
      let frame = 0;
      frame < 60 &&
      sim.cats.some((cat: any) => !["groom", "sleep"].includes(cat.state));
      frame++
    )
      sim.step(1 / 60);
    // Keep this visual observation inside a single activity, independent of sampled duration.
    sim.cats.forEach((cat: any) => {
      cat.timer = 90;
    });
    app.scene.update(0, 0);
  });
  await expect
    .poll(async () => (await observe(page)).cats.map((cat: any) => cat.state))
    .toEqual(["groom", "sleep"]);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  const frozen = await observe(page);
  await page.waitForTimeout(650);
  expect(await observe(page)).toEqual(frozen);
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect
    .poll(async () => {
      const after = await observe(page);
      return (
        after.elapsed > frozen.elapsed &&
        after.cats[0].timer < frozen.cats[0].timer &&
        after.cats[0].frame !== frozen.cats[0].frame
      );
    })
    .toBe(true);
  const washing = await page.evaluate(() => {
    const app = (window as any).kitty,
      sim = app.simulation;
    const cat = sim.cats[0];
    const textures = new Set<string>();
    for (let frame = 0; frame < 1200; frame++) {
      sim.step(1 / 60);
      app.scene.update(0, 0);
      textures.add(
        app.scene.children.getByName(`resident-${cat.id}`).texture.key,
      );
    }
    sim.paused = true;
    return {
      textures: [...textures],
      variant: cat.variant,
      states: sim.cats.map((c: any) => c.state),
    };
  });
  expect(washing.textures).toEqual(
    expect.arrayContaining([
      `cat-${washing.variant}-groom`,
      `cat-${washing.variant}-wash`,
      `cat-${washing.variant}-sit`,
    ]),
  );
  expect(washing.states).toEqual(["groom", "sleep"]);
  expect(errors).toEqual([]);
});

test("a cat scratches from the floor and tucks into a box behind its artwork", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, "cabin");
  await page.evaluate(() => {
    const app = (window as any).kitty,
      sim = app.simulation;
    sim.paused = true;
    app.setLayout({
      version: 1,
      furniture: [
        {
          instanceId: "post",
          definitionId: "scratcher",
          roomId: "lounge",
          gridX: 4,
          gridY: 0,
          flipX: false,
        },
        {
          instanceId: "box",
          definitionId: "box",
          roomId: "lounge",
          gridX: 10,
          gridY: 0,
          flipX: false,
        },
      ],
    });
    sim.replaceRoster(
      sim
        .roster()
        .slice(0, 1)
        .map((profile: any) => ({ ...profile, roomId: "lounge" })),
    );
    // The fixture replaces the starting sofa; begin after that cat has landed.
    sim.relocate(sim.cats[0], "lounge");
  });
  for (const action of ["scratch", "hide"] as const) {
    const result = await page.evaluate((requested) => {
      const app = (window as any).kitty,
        sim = app.simulation,
        cat = sim.cats[0];
      const goals = sim.graph.goals.filter(
        (goal: any) => goal.interaction?.kind === requested,
      );
      if (!goals.some((goal: any) => sim.requestGoal(cat, goal)))
        throw Error(`No ${requested} route`);
      sim.paused = false;
      for (let frame = 0; frame < 7200 && cat.state !== requested; frame++)
        sim.step(1 / 60);
      if (cat.state !== requested) throw Error(`Did not reach ${requested}`);
      for (let frame = 0; frame < (requested === "scratch" ? 20 : 65); frame++)
        sim.step(1 / 60);
      sim.paused = true;
      app.scene.update(0, 0);
      const sprite = app.scene.children.getByName(`resident-${cat.id}`);
      const target = cat.goal.interaction;
      return {
        id: cat.id,
        name: cat.name,
        variant: cat.variant,
        state: cat.state,
        y: cat.y,
        facing: cat.facing,
        targetFacing: target.facing,
        texture: sprite.texture.key,
        flipX: sprite.flipX,
        depth: sprite.depth,
        angle: sprite.angle,
        spriteX: sprite.x,
        spriteY: sprite.y,
        targetX: 130 + target.targetX * 26,
        targetY: 709 - target.targetY * 26,
        furnitureDepth: app.scene.children.getByName("theme-layer-10").depth,
      };
    }, action);
    expect(result.state).toBe(action);
    expect(result.y).toBe(0);
    if (action === "scratch") {
      expect(result.texture).toBe(`cat-${result.variant}-scratch`);
      expect(result.flipX).toBe(result.targetFacing < 0);
      expect(Math.sign(result.targetX - result.spriteX)).toBe(
        result.targetFacing,
      );
      expect(Math.abs(result.angle)).toBeGreaterThan(0);
      expect(result.spriteY).toBeGreaterThan(705);
      expect(result.spriteY).toBeLessThanOrEqual(710);
      expect(result.targetY).toBeLessThan(result.spriteY);
    } else {
      expect(result.texture).toBe(`cat-${result.variant}-hide`);
      expect(result.depth).toBe(9);
      expect(result.depth).toBeLessThan(result.furnitureDepth);
      expect(result.spriteX).toBeCloseTo(result.targetX, 4);
      expect(result.spriteY).toBeCloseTo(result.targetY, 4);
    }
  }
  expect(errors).toEqual([]);
});

test("a quiet mutual greeting names its partner and resumes without waking a nearby sleeper", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  const encounter = await page.evaluate(() => {
    const app = (window as any).kitty,
      sim = app.simulation;
    sim.paused = true;
    app.setLayout({ version: 1, furniture: [] });
    sim.replaceRoster(
      sim
        .roster()
        .slice(0, 3)
        .map((profile: any) => ({ ...profile, roomId: "lounge" })),
    );
    const surface = sim.graph.surfaces.find(
      (s: any) => s.roomId === "lounge" && s.actions.includes("sit"),
    );
    const seats = sim.graph.goals.filter(
      (g: any) => g.surfaceId === surface.id && g.action === "sit",
    );
    sim.elapsed = 1000;
    sim.random.next = () => 0;
    for (const [index, cat] of sim.cats.entries()) {
      const seat = seats[[3, 5, 1][index]];
      Object.assign(cat, {
        roomId: "lounge",
        surfaceId: surface.id,
        x: seat.x,
        y: 0,
        state: ["idle", "sit", "sleep"][index],
        timer: index === 2 ? 180 : 60,
        goal:
          index === 0
            ? null
            : { ...seat, action: index === 2 ? "sleep" : "sit" },
        actionElapsed: 0,
        sociability: 1,
        energy: 0.8,
        socialCooldown: 0,
        move: null,
        path: [],
      });
    }
    const [visitor, resident, sleeper] = sim.cats;
    if (!sim.trySocial(visitor)) throw Error("Greeting did not start");
    sim.paused = false;
    for (
      let frame = 0;
      frame < 600 && visitor.social?.phase !== "settled";
      frame++
    )
      sim.step(1 / 60);
    sim.paused = true;
    app.scene.update(0, 0);
    return {
      names: [visitor.name, resident.name],
      ids: [visitor.id, resident.id],
      kind: visitor.social?.kind,
      phases: [visitor.social?.phase, resident.social?.phase],
      textures: [visitor, resident].map(
        (cat: any) =>
          app.scene.children.getByName(`resident-${cat.id}`).texture.key,
      ),
      variants: [visitor.variant, resident.variant],
      opposite: visitor.facing === -resident.facing,
      separation: Math.abs(visitor.x - resident.x),
      residentGoal: resident.social?.resume?.goal,
      sleeperX: sleeper.x,
      sleeperTimer: sleeper.timer,
    };
  });
  expect(encounter.kind).toBe("greet");
  expect(encounter.phases).toEqual(["settled", "settled"]);
  expect(encounter.opposite).toBe(true);
  expect(encounter.separation).toBeGreaterThanOrEqual(1.15);
  expect(encounter.textures).toEqual(
    encounter.variants.map((variant: number) => `cat-${variant}-greet`),
  );
  await page.getByRole("button", { name: "Edit house" }).click();
  await page.getByRole("tab", { name: "Cats", exact: true }).click();
  await page.getByRole("tab", { name: /At home/ }).click();
  await page
    .getByRole("button", { name: `Meet ${encounter.names[0]}`, exact: true })
    .click();
  await expect(page.locator("#cat-activity")).toContainText(
    `Saying a quiet hello to ${encounter.names[1]}`,
  );
  const resumed = await page.evaluate(() => {
    const app = (window as any).kitty,
      sim = app.simulation;
    sim.paused = false;
    for (let frame = 0; frame < 210; frame++) sim.step(1 / 60);
    sim.paused = true;
    app.scene.update(0, 0);
    return sim.cats.map((cat: any) => ({
      state: cat.state,
      goal: cat.goal,
      social: cat.social,
      x: cat.x,
      timer: cat.timer,
    }));
  });
  expect(resumed[0].social).toBeNull();
  expect(resumed[1].social).toBeNull();
  expect(resumed[1].state).toBe("sit");
  expect(resumed[1].goal).toEqual(encounter.residentGoal);
  expect(resumed[1].timer).toBeGreaterThan(50);
  expect(resumed[2].state).toBe("sleep");
  expect(resumed[2].x).toBe(encounter.sleeperX);
  expect(resumed[2].timer).toBeGreaterThan(encounter.sleeperTimer - 4);
  await expect(page.locator("#cat-activity")).not.toContainText(
    "Saying a quiet hello",
  );
  expect(errors).toEqual([]);
});

test("browser reload updates untouched milestone layouts and preserves customized saves in every house", async ({
  page,
}) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  for (const theme of ["original", "cabin", "ramen"] as const) {
    const key = `little-house.layout.v1${theme === "original" ? "" : `.${theme}`}`;
    await page.evaluate(
      ({ theme, key }) => {
        localStorage.setItem("little-house.theme.v1", theme);
        localStorage.removeItem(key);
      },
      { theme, key },
    );
    await page.reload();
    await page.waitForFunction(() => !!(window as any).kitty?.ready());
    const current = await page.evaluate(() => (window as any).kitty.layout());
    const previous = {
      version: 1,
      furniture: previousDefaults[theme].map(
        ([definitionId, roomId, gridX, gridY = 0], index) => ({
          instanceId: `demo-${index}`,
          definitionId,
          roomId,
          gridX,
          gridY,
          flipX: false,
        }),
      ),
    };
    expect(previous).not.toEqual(current);
    await page.evaluate(
      ({ key, layout }) => localStorage.setItem(key, JSON.stringify(layout)),
      { key, layout: previous },
    );
    await page.reload();
    await page.waitForFunction(() => !!(window as any).kitty?.ready());
    expect(await page.evaluate(() => (window as any).kitty.layout())).toEqual(
      current,
    );
    const customized = structuredClone(previous);
    customized.furniture[0].flipX = true;
    await page.evaluate(
      ({ key, layout }) => localStorage.setItem(key, JSON.stringify(layout)),
      { key, layout: customized },
    );
    await page.reload();
    await page.waitForFunction(() => !!(window as any).kitty?.ready());
    expect(await page.evaluate(() => (window as any).kitty.layout())).toEqual(
      customized,
    );
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      JSON.stringify(customized),
    );
  }
});
