import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
}

async function expectQuietHouse(page: Page) {
  await expect(page.locator(".house-stage")).not.toHaveClass(
    /controls-visible/,
  );
  await expect(page.locator(".fullscreen-controls")).toHaveCSS("opacity", "0");
}

async function expectFittedHouse(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stage = document
          .querySelector(".house-stage")!
          .getBoundingClientRect();
        const canvas = document
          .querySelector("canvas")!
          .getBoundingClientRect();
        return (
          Math.abs(stage.width - innerWidth) < 2 &&
          Math.abs(stage.height - innerHeight) < 2 &&
          stage.x === 0 &&
          stage.y === 0 &&
          canvas.width > 0 &&
          canvas.height > 0 &&
          canvas.left >= -1 &&
          canvas.top >= -1 &&
          canvas.right <= innerWidth + 1 &&
          canvas.bottom <= innerHeight + 1 &&
          (Math.abs(canvas.width - innerWidth) < 2 ||
            Math.abs(canvas.height - innerHeight) < 2)
        );
      }),
    )
    .toBe(true);
}

test("fullscreen shows only the animated house and restores controls when the browser exits", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  const saved = await page.evaluate(() => ({
    layout: (window as any).kitty.layout(),
    roster: (window as any).kitty.roster(),
  }));
  await page.getByRole("button", { name: "Show paths", exact: true }).click();
  await page.getByRole("button", { name: "Edit house" }).click();
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
  await expectFittedHouse(page);
  for (const selector of [
    ".topbar",
    ".scene-bar",
    "#editor",
    "#inspector",
    "footer",
    ".about",
    "#tip",
    "#debug-stats",
  ])
    await expect(page.locator(selector)).toBeHidden();
  const elapsed = await page.evaluate(
    () => (window as any).kitty.simulation.elapsed,
  );
  await expectQuietHouse(page);
  expect(
    await page.evaluate(() => (window as any).kitty.simulation.elapsed),
  ).toBeGreaterThan(elapsed);
  expect(
    await page.evaluate(
      () =>
        (window as any).kitty.scene.children.list.filter(
          (child: any) => child.type === "Text" && child.visible,
        ).length,
    ),
  ).toBe(0);
  await page.screenshot({ path: "docs/screenshots/fullscreen-house.png" });
  // Browser chrome / Esc can leave fullscreen without using our exit button.
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator("body")).not.toHaveClass(/house-fullscreen/);
  await expect(
    page.getByRole("button", { name: "Fullscreen house", exact: true }),
  ).toBeFocused();
  await expect(page.locator("#editor")).toBeHidden();
  await expect(page.locator("#debug-stats")).toBeVisible();
  expect(
    await page.evaluate(() => ({
      layout: (window as any).kitty.layout(),
      roster: (window as any).kitty.roster(),
    })),
  ).toEqual(saved);
  await page
    .getByRole("button", { name: "Fullscreen house", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect(page.locator("body")).not.toHaveClass(/house-fullscreen/);
  expect(errors).toEqual([]);
});

for (const unavailable of ["missing", "rejected"] as const) {
  test(`house-only fallback remains usable when fullscreen is ${unavailable}`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(Element.prototype, "requestFullscreen", {
        configurable: true,
        value:
          mode === "missing"
            ? undefined
            : () => Promise.reject(new Error("Not allowed")),
      });
    }, unavailable);
    await ready(page);
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page
      .getByRole("button", { name: "Fullscreen house", exact: true })
      .click();
    await expect(page.locator("body")).toHaveClass(/house-fullscreen/);
    await expect(page.locator("#fullscreen-hint")).toContainText(
      "House-only view",
    );
    await expectFittedHouse(page);
    await expectQuietHouse(page);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Exit fullscreen", exact: true }),
    ).toBeFocused();
    await expect(page.locator(".fullscreen-controls")).toHaveCSS(
      "opacity",
      "1",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/house-fullscreen/);
    expect(
      await page.evaluate(() => (window as any).kitty.scene.zoomLevel),
    ).toBeCloseTo(1.15);
    await page
      .getByRole("button", { name: "Fullscreen house", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .click();
    await expect(page.locator("body")).not.toHaveClass(/house-fullscreen/);
  });
}

test("touch house view fits portrait and landscape and reveals a way out", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() =>
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto(`${test.info().project.use.baseURL}/?test=1`);
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  await page
    .getByRole("button", { name: "Fullscreen house", exact: true })
    .tap();
  await expectFittedHouse(page);
  await expectQuietHouse(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expectFittedHouse(page);
  await expectQuietHouse(page);
  await page.screenshot({ path: "docs/screenshots/fullscreen-mobile.png" });
  await page.touchscreen.tap(420, 250);
  await expect(page.locator(".fullscreen-controls")).toHaveCSS("opacity", "1");
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .tap();
  await expect(page.locator("body")).not.toHaveClass(/house-fullscreen/);
  await context.close();
});
