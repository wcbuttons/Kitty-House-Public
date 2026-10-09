import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, theme: string) {
  await page.addInitScript(
    (id) => localStorage.setItem("little-house.theme.v1", id),
    theme,
  );
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  return page.evaluate(() => {
    const app = (window as any).kitty;
    app.simulation.paused = true;
    app.simulation.replaceRoster(app.roster().slice(0, 1));
    const cat = app.simulation.cats[0];
    app.simulation.relocate(cat, cat.homeRoomId);
    app.scene.update(0, 0);
    return cat.name;
  });
}

async function catPoint(page: Page) {
  // Wait for the camera and CSS canvas size to settle after fullscreen/rotation.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return page.evaluate(() => {
    const app = (window as any).kitty;
    const scene = app.scene;
    const sprite = scene.children.getByName(
      `resident-${app.simulation.cats[0].id}`,
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

async function openCat(page: Page, name: string, touch = false) {
  const point = await catPoint(page);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await expect(
    page.getByRole("complementary", { name: "Cat details" }),
  ).toBeVisible();
  await expect(page.locator("#cat-name")).toHaveText(name);
}

async function boundedPanel(page: Page) {
  await expect
    .poll(() =>
      page.locator("#inspector").evaluate((panel) => {
        const bounds = panel.getBoundingClientRect();
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

for (const theme of ["original", "cabin", "ramen"]) {
  test(`${theme}: canvas cat clicks open fullscreen details with keyboard access and restore normally`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const name = await ready(page, theme);
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
    await expect(page.locator("#inspector")).toBeHidden();
    await openCat(page, name);
    await expect(page.locator(".house-stage #inspector")).toBeVisible();
    await boundedPanel(page);
    await page.mouse.wheel(0, 250);
    expect(
      await page.evaluate(() => (window as any).kitty.scene.cameras.main.zoom),
    ).toBe(1);
    if (theme === "cabin")
      await page.screenshot({ path: "/tmp/kitty-fullscreen-cat-desktop.png" });

    const exit = page.getByRole("button", {
      name: "Exit fullscreen",
      exact: true,
    });
    const close = page.getByRole("button", {
      name: "Close cat details",
      exact: true,
    });
    await page.keyboard.press("Tab");
    await expect(exit).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(exit).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("#inspector")).toBeHidden();
    await expect(page.locator(".house-stage")).toBeFocused();
    await openCat(page, name);

    await page.evaluate(() => document.exitFullscreen());
    await expect(page.locator("body")).not.toHaveClass(/house-fullscreen/);
    await expect(page.locator(".workspace > #inspector")).toBeVisible();
    await expect(page.locator("#cat-name")).toHaveText(name);
    await expect(
      page.getByRole("button", { name: "Fullscreen house", exact: true }),
    ).toBeFocused();
    await close.click();
    await openCat(page, name);
    expect(errors).toEqual([]);
  });
}

test("touch fallback keeps cat details usable and scrollable after a short landscape rotation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() =>
      Object.defineProperty(Element.prototype, "requestFullscreen", {
        value: undefined,
        configurable: true,
      }),
    );
    const name = await ready(page, "ramen");
    await page
      .getByRole("button", { name: "Fullscreen house", exact: true })
      .tap();
    await expect(page.locator("body")).toHaveClass(/house-fullscreen/);
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    await expect(page.locator("#inspector")).toBeHidden();
    await openCat(page, name, true);
    await boundedPanel(page);
    await page.setViewportSize({ width: 844, height: 320 });
    await boundedPanel(page);
    await expect(page.locator("#inspector")).toHaveCSS("overflow-y", "auto");
    await page.screenshot({ path: "/tmp/kitty-fullscreen-cat-landscape.png" });
    const introduction = await page.evaluateHandle(() => {
      const text = document.querySelector("#cat-activity")!.firstChild!;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, Math.min(12, text.textContent!.length));
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      return {
        rows: Array.from(document.querySelectorAll("#cat-traits .trait")),
        meters: Array.from(document.querySelectorAll("#cat-traits meter")),
        text,
        selectedText: selection.toString(),
      };
    });
    await page.locator("#cat-traits .trait").last().scrollIntoViewIfNeeded();
    expect(
      await page
        .locator("#inspector")
        .evaluate(
          (panel) =>
            panel.scrollHeight > panel.clientHeight && panel.scrollTop > 0,
        ),
    ).toBe(true);
    const scrollTop = await page
      .locator("#inspector")
      .evaluate((panel) => panel.scrollTop);
    // Wait for two real inspector refreshes by changing a displayed value.
    // Paused activity text, selected text, row identities and scroll stay put.
    for (const energy of [0.2, 0.8]) {
      await page.evaluate((value) => {
        (window as any).kitty.simulation.cats[0].energy = value;
      }, energy);
      await expect(
        page.getByRole("meter", { name: "Energy", exact: true }),
      ).toHaveJSProperty("value", energy);
      await expect(
        page.getByRole("meter", { name: "Energy", exact: true }),
      ).toHaveText(`${Math.round(energy * 100)}%`);
      expect(
        await introduction.evaluate((saved) => ({
          rows:
            saved.rows.length === 4 &&
            saved.rows.every(
              (row, index) =>
                row ===
                  document.querySelectorAll("#cat-traits .trait")[index] &&
                row.isConnected,
            ),
          meters: saved.meters.every(
            (meter, index) =>
              meter === document.querySelectorAll("#cat-traits meter")[index] &&
              meter.isConnected,
          ),
          activity:
            saved.text === document.querySelector("#cat-activity")!.firstChild,
          selection:
            window.getSelection()!.toString() === saved.selectedText &&
            saved.selectedText.length > 0,
        })),
      ).toEqual({ rows: true, meters: true, activity: true, selection: true });
      expect(
        await page.locator("#inspector").evaluate((panel) => panel.scrollTop),
      ).toBeCloseTo(scrollTop, 0);
    }
    await introduction.dispose();
    await page
      .getByRole("button", { name: "Close cat details", exact: true })
      .tap();
    await expect(page.locator("#inspector")).toBeHidden();
    await openCat(page, name, true);
    await boundedPanel(page);
    // Tapping the panel also reveals the fullscreen controls without clearing selection.
    await page.locator("#cat-name").tap();
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .tap();
    await expect(page.locator("body")).not.toHaveClass(/house-fullscreen/);
    await expect(page.locator(".workspace > #inspector")).toBeVisible();
    await expect(page.locator("#cat-name")).toHaveText(name);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
