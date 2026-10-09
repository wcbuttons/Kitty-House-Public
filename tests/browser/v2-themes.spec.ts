import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { CABIN_V2_CATALOG, CABIN_V2_THEME } from "../../src/cabin-v2";
import { RAMEN_V2_CATALOG, RAMEN_V2_THEME } from "../../src/ramen-v2";

const THEMES = ["cabin-v2", "ramen-v2"] as const;
const METADATA = {
  "cabin-v2": { catalog: CABIN_V2_CATALOG, rooms: CABIN_V2_THEME.rooms },
  "ramen-v2": { catalog: RAMEN_V2_CATALOG, rooms: RAMEN_V2_THEME.rooms },
};
const EVIDENCE = resolve(process.env.V2_REVIEW_DIR ?? "test-results/v2-review");

async function ready(page: Page, theme: string) {
  await page.addInitScript((theme) => {
    localStorage.setItem("little-house.theme.v1", theme);
    localStorage.setItem("little-house.daylight.v1", JSON.stringify({ version: 1, mode: "manual", manualHour: 12 }));
  }, theme);
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  await settled(page);
}

async function settled(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

for (const theme of THEMES) {
  test(`${theme} loads only its fresh environmental assets and paints every advertised landing`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await ready(page, theme);
    const result = await page.evaluate((metadata) => {
      const CATALOG = metadata.catalog, CELL = 26;
      const { scene } = (window as any).kitty;
      const sources = performance.getEntriesByType("resource")
        .map((entry) => new URL(entry.name).pathname)
        .filter((path) => path.includes("/assets/houses/"));
      const furniture = CATALOG.map((definition: any) => {
        const image = scene.textures.get(`theme-furniture-${definition.id}`).getSourceImage();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const alpha = (x: number, y: number) =>
          x < 0 || y < 0 || x >= canvas.width || y >= canvas.height ? 0 : pixels[(Math.floor(y) * canvas.width + Math.floor(x)) * 4 + 3];
        const scale = canvas.height / (definition.height * CELL);
        const surfaces = definition.surfaces.map((surface: any) => ({
          y: surface.y,
          support: [0.3, 0.5, 0.7].map((part) => {
            const x = (surface.x + surface.width * part) * canvas.width / definition.width;
            const y = (definition.height - surface.y) * canvas.height / definition.height;
            let strongest = 0;
            for (let dy = -scale; dy <= scale * 2.5; dy++)
              for (let dx = -scale; dx <= scale; dx++)
                strongest = Math.max(strongest, alpha(x + dx, y + dy));
            return strongest;
          }),
        }));
        let painted = 0;
        for (let index = 3; index < pixels.length; index += 4)
          if (pixels[index] > 160) painted++;
        return {
          id: definition.id, width: canvas.width, height: canvas.height,
          aspect: canvas.width / canvas.height,
          expectedAspect: definition.width / definition.height,
          paintedFraction: painted / (canvas.width * canvas.height),
          surfaces,
        };
      });
      const fixture = (key: string) => {
        const image = scene.textures.get(key).getSourceImage();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const dayFixture = fixture("theme-fixtures");
      const nightFixture = fixture("theme-fixtures-night");
      const atmosphere = scene.textures.exists("theme-atmosphere-mask")
        ? fixture("theme-atmosphere-mask") : undefined;
      let alphaDifferences = 0, painted = 0, transparent = 0;
      for (let i = 3; i < dayFixture.length; i += 4) {
        if (dayFixture[i] !== nightFixture[i]) alphaDifferences++;
        if (dayFixture[i] > 160) painted++;
        if (dayFixture[i] === 0) transparent++;
      }
      return {
        sources, furniture,
        cabinAtmosphere: atmosphere ? {
          protectedMaterial: [[258, 95], [254, 148], [1230, 220], [1280, 260]]
            .map(([x, y]) => atmosphere[(y * 1408 + x) * 4 + 3]),
          cloudCenter: atmosphere[(56 * 1408 + 360) * 4 + 3],
        } : undefined,
        plates: ["theme-house", "theme-house-day"].map((key) => {
          const pixels = fixture(key);
          let transparent = 0;
          for (let i = 3; i < pixels.length; i += 4)
            if (pixels[i] !== 255) transparent++;
          return { key, transparent };
        }),
        fixture: { alphaDifferences, painted, transparent,
          dayDepth: scene.children.getByName("theme-fixtures").depth,
          nightDepth: scene.children.getByName("theme-fixtures-night").depth,
          nearRail: [[979, 500], [1006, 550], [1033, 600], [1060, 650]].map(([x, y]) => dayFixture[(y * 1408 + x) * 4 + 3]),
          clearTreads: [[1038, 518], [1074, 600], [1008, 450]].map(([x, y]) => dayFixture[(y * 1408 + x) * 4 + 3]),
          cabinNearRail: [450, 550, 675].map((y) => dayFixture[(y * 1408 + 355) * 4 + 3]),
          cabinFormerRail: [450, 550, 675].map((y) => dayFixture[(y * 1408 + 303) * 4 + 3]),
        },
      };
    }, METADATA[theme]);
    expect(result.sources.length).toBeGreaterThanOrEqual(result.furniture.length + 4);
    if (theme === "cabin-v2") {
      expect(result.cabinAtmosphere?.protectedMaterial).toEqual([0, 0, 0, 0]);
      expect(result.cabinAtmosphere?.cloudCenter).toBe(255);
      expect(result.fixture.cabinNearRail, "The foreground rail follows the relocated ladder beside the fireplace").toEqual([255, 255, 255]);
      expect(result.fixture.cabinFormerRail, "No old ladder rail remains in front of the masonry").toEqual([0, 0, 0]);
    }
    for (const path of result.sources) {
      const assetPath = path.slice(path.indexOf("/assets/houses/"));
      expect(assetPath.startsWith(`/assets/houses/${theme}/`) || assetPath.startsWith(`/assets/houses/furniture/${theme}-`), path).toBe(true);
    }
    for (const item of result.furniture) {
      expect(item.aspect, `${item.id} preserves its world proportions`).toBeCloseTo(item.expectedAspect, 5);
      expect(item.paintedFraction, `${item.id} contains painted artwork`).toBeGreaterThan(0.08);
      expect(item.paintedFraction, `${item.id} retains transparency around its outline`).toBeLessThan(1);
      for (const surface of item.surfaces)
        expect(surface.support.every((alpha) => alpha > 160), `${item.id} support y${surface.y}: ${surface.support}`).toBe(true);
    }
    expect(result.fixture.alphaDifferences).toBe(0);
    for (const plate of result.plates)
      expect(plate.transparent, `${plate.key} must be fully opaque so the opposite lighting plate cannot leak through`).toBe(0);
    expect(result.fixture.painted).toBeGreaterThan(0);
    expect(result.fixture.transparent).toBeGreaterThan(result.fixture.painted);
    expect(result.fixture.dayDepth).toBeGreaterThan(20);
    expect(result.fixture.nightDepth).toBeGreaterThan(20);
    if (theme === "ramen-v2") {
      expect(result.fixture.nearRail.every((alpha) => alpha > 160)).toBe(true);
      expect(result.fixture.clearTreads).toEqual([0, 0, 0]);
    }
    await mkdir(EVIDENCE, { recursive: true });
    await writeFile(`${EVIDENCE}/${theme}-asset-support.json`, JSON.stringify(result, null, 2));
    expect(errors).toEqual([]);
  });

  test(`${theme} moves, flips, removes and saves furniture with an aligned translucent origin ghost`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await ready(page, theme);
    const initial = await page.evaluate((metadata) => {
      const CATALOG = metadata.catalog, ROOMS = metadata.rooms;
      const app = (window as any).kitty;
      const old = JSON.stringify({ version: 1, furniture: [] });
      for (const theme of ["cabin", "ramen", "tower"])
        localStorage.setItem(`little-house.layout.v1.${theme}`, old);
      app.setLayout({ version: 1, furniture: [] });
      return {
        id: CATALOG.find((item: any) => item.anchor === "floor" && item.canFlip && item.width >= 3)!.id,
        room: ROOMS[0].id, old,
      };
    }, METADATA[theme]);
    await settled(page);
    expect(await page.evaluate(() => {
      const scene = (window as any).kitty.scene;
      return {
        pieces: scene.children.getByName("theme-layer-10").list.filter((image: any) => image.visible).length,
        shell: scene.children.getByName("theme-house-day").visible,
        structure: scene.children.getByName("theme-fixtures").visible,
      };
    })).toEqual({ pieces: 0, shell: true, structure: true });
    await mkdir(EVIDENCE, { recursive: true });
    await page.screenshot({ path: `${EVIDENCE}/${theme}-empty-shell.png` });
    await page.getByRole("button", { name: "Edit house" }).click();
    await page.locator(`[data-piece="${initial.id}"]`).click();
    await page.getByLabel("Across", { exact: true }).fill("6");
    await page.getByRole("button", { name: "Place piece", exact: true }).click();
    await page.locator("#flip").click();
    await settled(page);
    const ghost = await page.evaluate(() => {
      const scene = (window as any).kitty.scene;
      const layer = (depth: number) => scene.children.getByName(`theme-layer-${depth}`);
      const source = layer(11).list.find((image: any) => image.visible);
      const preview = layer(39).list.find((image: any) => image.visible);
      return {
        sourceAlpha: layer(11).alpha, previewAlpha: layer(39).alpha,
        source: [source.x, source.y, source.displayWidth, source.displayHeight],
        preview: [preview.x, preview.y, preview.displayWidth, preview.displayHeight],
        sourceFlipped: source.flipX, previewFlipped: preview.flipX,
      };
    });
    expect(ghost.sourceAlpha).toBeCloseTo(0.23);
    expect(ghost.previewAlpha).toBe(1);
    expect(ghost.source).toEqual(ghost.preview);
    expect(ghost.sourceFlipped).toBe(false);
    expect(ghost.previewFlipped).toBe(true);
    await page.getByRole("button", { name: "Apply position", exact: true }).click();
    await settled(page);
    const drag = await page.evaluate(() => {
      const { scene } = (window as any).kitty;
      const image = scene.children.getByName("theme-layer-10").list.find((image: any) => image.visible);
      const camera = scene.cameras.main;
      const canvas = scene.game.canvas.getBoundingClientRect();
      const scale = canvas.width / scene.game.canvas.width;
      return {
        x: canvas.left + (image.x + image.displayWidth / 2 - camera.worldView.x) * camera.zoom * scale,
        y: canvas.top + (image.y + image.displayHeight * 0.7 - camera.worldView.y) * camera.zoom * scale,
        distance: 3 * 26 * camera.zoom * scale,
      };
    });
    await page.mouse.move(drag.x, drag.y);
    await page.mouse.down();
    await page.mouse.move(drag.x + drag.distance, drag.y, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => {
      const piece = (window as any).kitty.layout().furniture[0];
      return [piece.gridX, piece.gridY, piece.flipX];
    })).toEqual([9, 0, true]);
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    expect(await page.evaluate(() => (window as any).kitty.layout().furniture)).toHaveLength(0);
    await page.getByRole("button", { name: "Undo", exact: false }).click();
    const saved = await page.evaluate(() => (window as any).kitty.layout());
    expect(saved.furniture).toHaveLength(1);
    await page.getByRole("button", { name: "Exit edit mode", exact: true }).click();
    await page.reload();
    await page.waitForFunction(() => !!(window as any).kitty?.ready());
    expect(await page.evaluate(() => (window as any).kitty.layout())).toEqual(saved);
    for (const oldTheme of ["cabin", "ramen", "tower"])
      expect(await page.evaluate((theme) => localStorage.getItem(`little-house.layout.v1.${theme}`), oldTheme)).toBe(initial.old);
    expect(await page.evaluate(() => (window as any).kitty.theme())).toBe(theme);
    expect(errors).toEqual([]);
  });

  test(`${theme} keeps cat feet on each rendered furniture support and preserves fullscreen introductions and time controls`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await ready(page, theme);
    const visits = await page.evaluate((metadata) => {
      const CATALOG = metadata.catalog;
      const roomById = (id: string) => metadata.rooms.find((room) => room.id === id)!;
      const worldPoint = (room: typeof metadata.rooms[number], x: number, y: number) => ({
        x: room.x + x * 26, y: room.floor - y * 26,
      });
      const { simulation: sim, scene } = (window as any).kitty;
      sim.paused = true;
      sim.replaceRoster(sim.roster().slice(0, 1));
      const cat = sim.cats[0];
      const recoveries = sim.recoveries;
      const visits = [];
      for (const definition of CATALOG) {
        if (!definition.surfaces.length) continue;
        const piece = sim.layout.furniture.find((piece: any) => piece.definitionId === definition.id);
        if (!piece) continue;
        const candidates = sim.graph.goals.filter((goal: any) =>
          sim.surface(goal.surfaceId)?.owner === piece.instanceId && ["sit", "perch", "groom", "sleep"].includes(goal.action));
        const goal = candidates.find((goal: any) => sim.requestGoal(cat, goal));
        if (!goal) throw Error(`No route to ${definition.id}`);
        sim.paused = false;
        for (let frame = 0; frame < 14400 && !(cat.surfaceId === goal.surfaceId && cat.state === goal.action); frame++)
          sim.step(1 / 60);
        sim.paused = true;
        scene.update(0, 0);
        const sprite = scene.children.getByName(`resident-${cat.id}`);
        const expected = worldPoint(roomById(cat.roomId), cat.x, cat.y);
        visits.push({
          id: definition.id, action: cat.state, expectedAction: goal.action,
          surface: cat.surfaceId, expectedSurface: goal.surfaceId,
          sprite: [sprite.x, sprite.y], expected: [expected.x, expected.y],
          y: cat.y, supportY: sim.surface(goal.surfaceId).y,
        });
      }
      return { visits, recoveries: sim.recoveries - recoveries, name: cat.name };
    }, METADATA[theme]);
    expect(visits.visits.length).toBeGreaterThanOrEqual(9);
    expect(visits.recoveries).toBe(0);
    for (const visit of visits.visits) {
      expect(visit.surface, visit.id).toBe(visit.expectedSurface);
      expect(visit.action, visit.id).toBe(visit.expectedAction);
      expect(visit.y, visit.id).toBeCloseTo(visit.supportY);
      expect(visit.sprite[0], visit.id).toBeCloseTo(visit.expected[0]);
      expect(visit.sprite[1], visit.id).toBeCloseTo(visit.expected[1]);
    }
    await page.getByRole("button", { name: "Fullscreen house", exact: true }).click();
    await settled(page);
    expect(await page.evaluate(() => {
      const app = (window as any).kitty;
      const camera = app.scene.cameras.main;
      return [app.scene.game.canvas.width, app.scene.game.canvas.height, camera.worldView.x, camera.worldView.y, camera.zoom];
    })).toEqual([1408, 792, 0, 0, 1]);
    expect(await page.locator(".house-stage").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.width - innerWidth) < 1 && Math.abs(rect.height - innerHeight) < 1;
    })).toBe(true);
    const point = await page.evaluate(() => {
      const { scene, simulation } = (window as any).kitty;
      const sprite = scene.children.getByName(`resident-${simulation.cats[0].id}`);
      const camera = scene.cameras.main;
      const canvas = scene.game.canvas.getBoundingClientRect();
      const scale = canvas.width / scene.game.canvas.width;
      return {
        x: canvas.left + (sprite.x - camera.worldView.x) * camera.zoom * scale,
        y: canvas.top + (sprite.y - 12 - camera.worldView.y) * camera.zoom * scale,
      };
    });
    await page.mouse.click(point.x, point.y);
    await expect(page.locator(".house-stage #inspector")).toBeVisible();
    await expect(page.locator("#cat-name")).toHaveText(visits.name);
    await page.getByRole("button", { name: "Close cat details", exact: true }).click();
    await page.locator("#time-controls > summary").click();
    const slider = page.getByRole("slider", { name: "Choose a time" });
    await slider.focus();
    await slider.press("End");
    await expect(page.locator("#time-value")).toHaveText("12:00 AM");
    await settled(page);
    expect(await page.evaluate(() => (window as any).kitty.scene.children.getByName("theme-house-day").alpha)).toBe(0);
    await page.evaluate(() => (window as any).kitty.daylightClock.setManual(12));
    await settled(page);
    expect(await page.evaluate(() => (window as any).kitty.scene.children.getByName("theme-house-day").alpha)).toBe(1);
    await page.getByRole("button", { name: "Return to live time", exact: true }).click();
    expect(await page.evaluate(() => (window as any).kitty.daylight().mode)).toBe("live");
    await page.evaluate(() => (window as any).kitty.daylightClock.setManual(18.5));
    await page.locator("#time-controls > summary").click();
    await mkdir(EVIDENCE, { recursive: true });
    await page.screenshot({ path: `${EVIDENCE}/${theme}-fullscreen-sunset.png` });
    await writeFile(`${EVIDENCE}/${theme}-cat-support-visits.json`, JSON.stringify(visits, null, 2));
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.locator(".house-settings > #time-controls")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
