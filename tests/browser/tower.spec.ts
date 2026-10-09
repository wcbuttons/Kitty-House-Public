import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("little-house.theme.v1", "tower");
    localStorage.setItem(
      "little-house.daylight.v1",
      JSON.stringify({ version: 1, mode: "manual", manualHour: 12 }),
    );
  });
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
}

async function settledFrame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function catPoint(page: Page) {
  await settledFrame(page);
  return page.evaluate(() => {
    const { scene, simulation } = (window as any).kitty;
    const sprite = scene.children.getByName(
      `resident-${simulation.cats[0].id}`,
    );
    const camera = scene.cameras.main;
    const canvas = scene.game.canvas;
    const bounds = canvas.getBoundingClientRect();
    return {
      x:
        bounds.left +
        ((sprite.x - camera.worldView.x) * camera.zoom * bounds.width) /
          canvas.width,
      y:
        bounds.top +
        ((sprite.y - 12 - camera.worldView.y) * camera.zoom * bounds.height) /
          canvas.height,
    };
  });
}

async function portraitFrame(page: Page, fullscreen = false) {
  await expect
    .poll(() =>
      page.evaluate((fillsViewport) => {
        const canvas = document
          .querySelector("canvas")!
          .getBoundingClientRect();
        const stage = document
          .querySelector(".house-stage")!
          .getBoundingClientRect();
        return (
          Math.abs(canvas.width / canvas.height - 9 / 16) < 0.001 &&
          Math.abs(stage.width - canvas.width) < 1 &&
          Math.abs(stage.height - canvas.height) < 1 &&
          Math.abs(stage.left - canvas.left) < 1 &&
          Math.abs(stage.top - canvas.top) < 1 &&
          (!fillsViewport ||
            (Math.abs(canvas.width - innerWidth) < 1 &&
              Math.abs(canvas.height - innerHeight) < 1))
        );
      }, fullscreen),
    )
    .toBe(true);
}

async function bounded(page: Page, selector: string) {
  await expect
    .poll(() =>
      page.locator(selector).evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          bounds.width > 0 &&
          bounds.left >= 0 &&
          bounds.top >= 0 &&
          bounds.right <= innerWidth + 1 &&
          bounds.bottom <= innerHeight + 1
        );
      }),
    )
    .toBe(true);
}

test("the tower fills a portrait display, supports fullscreen cat introductions and keeps editing aligned", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1080, height: 1920 });
  await ready(page);
  await expect(page.locator("#cat-count")).toHaveText("8");
  await expect(
    page.getByRole("combobox", { name: "House style", exact: true }),
  ).toHaveValue("tower");
  await portraitFrame(page);
  const name = await page.evaluate(() => {
    const app = (window as any).kitty;
    const sim = app.simulation;
    sim.paused = true;
    sim.replaceRoster(sim.roster().slice(0, 1));
    sim.relocate(sim.cats[0], sim.cats[0].homeRoomId);
    app.scene.update(0, 0);
    return sim.cats[0].name;
  });
  await page
    .getByRole("button", { name: "Fullscreen house", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fullscreenElement?.classList.contains("house-stage"),
      ),
    )
    .toBe(true);
  await portraitFrame(page, true);
  expect(
    await page.evaluate(() => {
      const { scene } = (window as any).kitty;
      const camera = scene.cameras.main;
      return [
        scene.game.canvas.width,
        scene.game.canvas.height,
        camera.worldView.x,
        camera.worldView.y,
        camera.zoom,
      ];
    }),
  ).toEqual([792, 1408, 0, 0, 1]);
  await expect(page.locator(".house-stage > #time-controls")).toHaveCSS(
    "opacity",
    "0",
  );
  const point = await catPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".house-stage #inspector")).toBeVisible();
  await expect(page.locator("#cat-name")).toHaveText(name);
  await bounded(page, "#inspector");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Exit fullscreen", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close cat details", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#time-controls > summary")).toBeFocused();
  // Closed disclosure contents must not enter the fullscreen focus loop.
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Exit fullscreen", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#time-controls > summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#time-panel")).toBeVisible();
  await bounded(page, "#time-panel");
  await expect(page.locator("#time-panel")).toHaveCSS("cursor", "auto");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("slider", { name: "Choose a time" }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.locator("#time-value")).toHaveText("12:00 AM");
  await expect(page.locator("#time-hour")).toHaveValue("24");
  // Native fullscreen reserves Escape for the browser's own exit gesture.
  // The summary remains a keyboard-accessible way to close only this panel.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("#time-panel")).toBeHidden();
  await expect(page.locator("body")).toHaveClass(/house-fullscreen/);
  await expect(page.locator("#time-controls > summary")).toBeFocused();
  await page.screenshot({ path: "/tmp/kitty-tower-fullscreen-inspector.png" });
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator(".house-settings > #time-controls")).toBeVisible();
  await expect(page.locator(".workspace > #inspector")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fullscreen house", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Close cat details", exact: true })
    .click();

  // Real pointer dragging after the fullscreen transition checks the portrait
  // frame, CSS scaling, and the editor's world-to-grid conversion together.
  await page.getByRole("button", { name: "Edit house" }).click();
  expect(
    await page.evaluate(() => {
      const house = document
        .querySelector(".house-stage")!
        .getBoundingClientRect();
      const editor = document.querySelector("#editor")!.getBoundingClientRect();
      return house.right <= editor.left && editor.right <= innerWidth;
    }),
  ).toBe(true);
  await page.evaluate(() => {
    const app = (window as any).kitty;
    app.setLayout({ ...app.layout(), furniture: [] });
  });
  await page.locator('[data-piece="tower-travel-chest"]').click();
  await expect(page.locator("#piece-name")).toHaveText("Wayfarer's chest");
  await page.getByLabel("Across", { exact: true }).fill("6");
  await page.getByRole("button", { name: "Place piece", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await settledFrame(page);
  const drag = await page.evaluate(() => {
    const { scene } = (window as any).kitty;
    const image = scene.children
      .getByName("theme-layer-10")
      .list.find((child: any) => child.visible);
    const camera = scene.cameras.main;
    const canvas = scene.game.canvas.getBoundingClientRect();
    const scale = canvas.width / scene.game.canvas.width;
    return {
      x:
        canvas.left +
        (image.x + image.displayWidth / 2 - camera.worldView.x) *
          camera.zoom *
          scale,
      y:
        canvas.top +
        (image.y + image.displayHeight / 2 - camera.worldView.y) *
          camera.zoom *
          scale,
      distance: 3 * 26 * camera.zoom * scale,
    };
  });
  await page.mouse.move(drag.x, drag.y);
  await page.mouse.down();
  await page.mouse.move(drag.x + drag.distance, drag.y, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const piece = (window as any).kitty.layout().furniture[0];
        return { definitionId: piece.definitionId, gridX: piece.gridX, gridY: piece.gridY };
      }),
    )
    .toEqual({ definitionId: "tower-travel-chest", gridX: 9, gridY: 0 });
  await page
    .getByRole("button", { name: "Exit edit mode", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await portraitFrame(page);
  await page.getByRole("button", { name: "Edit house" }).click();
  expect(
    await page.evaluate(() => {
      const house = document
        .querySelector(".house-stage")!
        .getBoundingClientRect();
      const editor = document.querySelector("#editor")!.getBoundingClientRect();
      return (
        editor.top >= house.bottom &&
        editor.left >= 0 &&
        editor.right <= innerWidth
      );
    }),
  ).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("a tower cat travels through every floor without recovery and retains its home room", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const { simulation: sim, scene } = (window as any).kitty;
    sim.paused = true;
    sim.replaceRoster(sim.roster().slice(0, 1));
    const cat = sim.cats[0];
    const originalHome = sim.roster()[0].roomId;
    const rooms = Array.from(
      document.querySelectorAll<HTMLOptionElement>("#room option"),
      (option) => option.value,
    );
    sim.relocate(cat, rooms[0]);
    const recoveries = sim.recoveries;
    const destination = rooms[rooms.length - 1];
    const candidates = sim.graph.goals.filter(
      (goal: any) =>
        sim.surface(goal.surfaceId)?.roomId === destination &&
        goal.action === "sit",
    );
    if (!candidates.some((goal: any) => sim.requestGoal(cat, goal)))
      throw new Error("The observatory has no reachable sitting spot");
    const passages = new Set<string>();
    sim.paused = false;
    for (
      let frame = 0;
      frame < 14400 && !(cat.roomId === destination && cat.state === "sit");
      frame++
    ) {
      sim.step(1 / 60);
      if (cat.move?.passage) passages.add(cat.move.passage.id);
    }
    sim.paused = true;
    scene.update(0, 0);
    const sprite = scene.children.getByName(`resident-${cat.id}`);
    return {
      rooms,
      destination,
      roomId: cat.roomId,
      state: cat.state,
      homeRoomId: cat.homeRoomId,
      originalHome,
      visited: cat.visitedRooms,
      passages: [...passages],
      recoveries: sim.recoveries - recoveries,
      spriteY: sprite.y,
    };
  });
  expect(result.roomId).toBe(result.destination);
  expect(result.state).toBe("sit");
  expect(result.visited).toEqual(expect.arrayContaining(result.rooms));
  expect(result.passages).toHaveLength(4);
  expect(result.recoveries).toBe(0);
  expect(result.homeRoomId).toBe(result.originalHome);
  expect(result.spriteY).toBeLessThanOrEqual(424);
  await page.screenshot({ path: "/tmp/kitty-tower-observatory-visit.png" });
});

test("tower time controls work by touch and remain bounded after fallback fullscreen rotation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() =>
      Object.defineProperty(Element.prototype, "requestFullscreen", {
        value: undefined,
        configurable: true,
      }),
    );
    await ready(page);
    await page
      .getByRole("button", { name: "Fullscreen house", exact: true })
      .tap();
    await page.locator("#time-controls > summary").tap();
    await bounded(page, "#time-panel");
    await page.locator(".house-stage").focus();
    await page.waitForTimeout(2800);
    await expect(page.locator("#time-controls")).toHaveCSS("opacity", "1");
    await expect(page.locator("#time-panel")).toBeVisible();
    const slider = page.getByRole("slider", { name: "Choose a time" });
    const bounds = (await slider.boundingBox())!;
    await page.touchscreen.tap(
      bounds.x + bounds.width * 0.75,
      bounds.y + bounds.height / 2,
    );
    await expect(page.locator("#time-mode")).toContainText("Manual time");
    expect(
      await page.evaluate(() => (window as any).kitty.daylight().hour),
    ).toBeGreaterThan(16);
    await page.keyboard.press("Escape");
    await expect(page.locator("#time-panel")).toBeHidden();
    await expect(page.locator("body")).toHaveClass(/house-fullscreen/);
    await expect(page.locator("#time-controls > summary")).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("button", { name: "Exit fullscreen", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#time-panel")).toBeHidden();
    await expect(page.locator("body")).toHaveClass(/house-fullscreen/);
    await expect(page.locator("#time-controls > summary")).toBeFocused();
    await page.keyboard.press("Enter");
    await page.setViewportSize({ width: 844, height: 320 });
    await bounded(page, "#time-panel");
    await expect(page.locator("#time-panel")).toHaveCSS("overflow-y", "auto");
    await page
      .getByRole("button", { name: "Return to live time", exact: true })
      .scrollIntoViewIfNeeded();
    await page
      .getByRole("button", { name: "Return to live time", exact: true })
      .tap();
    await expect(page.locator("#time-mode")).toContainText(
      "Live · Central Time",
    );
    await page.screenshot({ path: "/tmp/kitty-tower-time-landscape.png" });
    await page.locator("#time-controls > summary").tap();
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .tap();
    await expect(page.locator("body")).not.toHaveClass(/house-fullscreen/);
    await expect(
      page.locator(".house-settings > #time-controls"),
    ).toBeVisible();
    await page.locator("#time-controls > summary").tap();
    await bounded(page, "#time-panel");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(844);
  } finally {
    await context.close();
  }
});
