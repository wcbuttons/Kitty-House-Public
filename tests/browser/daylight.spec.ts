import { expect, test, type Page } from "@playwright/test";

test.use({ timezoneId: "Asia/Tokyo" });

async function ready(page: Page) {
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
}

async function chooseHour(page: Page, hour: number) {
  const slider = page.getByRole("slider", { name: "Choose a time" });
  // Use the real range control, including its keyboard and input-event behavior.
  await slider.press(hour < 12 ? "Home" : "End");
  const steps = Math.round((hour < 12 ? hour : 24 - hour) * 4);
  for (let step = 0; step < steps; step++)
    await slider.press(hour < 12 ? "ArrowRight" : "ArrowLeft");
  await expect(slider).toHaveValue(String(hour));
}

async function renderedBrightness(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const renderer = (window as any).kitty.scene.game.renderer;
        renderer.snapshot((image: HTMLImageElement) => {
          const canvas = document.createElement("canvas");
          canvas.width = 48;
          canvas.height = 48;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0, 48, 48);
          const pixels = context.getImageData(0, 0, 48, 48).data;
          let total = 0;
          for (let i = 0; i < pixels.length; i += 4)
            total +=
              pixels[i] * 0.2126 +
              pixels[i + 1] * 0.7152 +
              pixels[i + 2] * 0.0722;
          resolve(total / (48 * 48));
        });
      }),
  );
}

for (const theme of ["original", "cabin", "ramen", "tower"]) {
  test(`${theme}: the time slider visibly changes the house and holds its setting after reload`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (id) => localStorage.setItem("little-house.theme.v1", id),
      theme,
    );
    await ready(page);
    await page
      .getByRole("button", { name: "Pause simulation", exact: true })
      .click();
    const saved = await page.evaluate(() => ({
      layout: (window as any).kitty.layout(),
      roster: (window as any).kitty.roster(),
    }));
    await page.locator("#time-controls > summary").click();
    await chooseHour(page, 12);
    await expect(page.locator("#time-value")).toHaveText("12:00 PM");
    await expect(page.locator("#time-phase")).toHaveText("Afternoon");
    const day = await renderedBrightness(page);
    await chooseHour(page, 23);
    await expect(page.locator("#time-value")).toHaveText("11:00 PM");
    await expect(page.locator("#time-phase")).toHaveText("Night");
    const night = await renderedBrightness(page);
    expect(night).toBeLessThan(day * 0.9);
    // Night must keep a visible scene, rather than switching to a black screen.
    expect(night).toBeGreaterThan(12);
    expect(
      await page.evaluate(() => ({
        layout: (window as any).kitty.layout(),
        roster: (window as any).kitty.roster(),
      })),
    ).toEqual(saved);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("little-house.daylight.v1")!),
      ),
    ).toMatchObject({ version: 1, mode: "manual", manualHour: 23 });
    await page.reload();
    await page.waitForFunction(() => !!(window as any).kitty?.ready());
    await page.locator("#time-controls > summary").click();
    await expect(page.locator("#time-hour")).toHaveValue("23");
    await expect(page.locator("#time-phase")).toHaveText("Night");
    await expect(page.locator("#time-mode")).toContainText("Manual time");
    expect(errors).toEqual([]);
  });
}

test("live Central time crosses a phase while cats are paused, and manual time follows a house switch", async ({
  page,
}) => {
  // The browser itself uses Tokyo; the house must still follow Chicago's CDT.
  await page.clock.install({ time: new Date("2026-09-06T13:28:00Z") });
  await ready(page);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.locator("#time-controls > summary").click();
  await page.clock.pauseAt(new Date("2026-09-06T13:29:59Z"));
  await expect(page.locator("#time-value")).toHaveText("8:29 AM");
  await expect(page.locator("#time-phase")).toHaveText("Dawn");
  await expect(page.locator("#time-mode")).toHaveText(
    "Live · Central Time (CDT)",
  );
  const before = await page.evaluate(() => {
    const sim = (window as any).kitty.simulation;
    return { elapsed: sim.elapsed, cats: sim.snapshot().cats };
  });
  await page.clock.runFor(2500);
  await expect(page.locator("#time-value")).toHaveText("8:30 AM");
  await expect(page.locator("#time-phase")).toHaveText("Morning");
  expect(
    await page.evaluate(() => {
      const sim = (window as any).kitty.simulation;
      return { elapsed: sim.elapsed, cats: sim.snapshot().cats };
    }),
  ).toEqual(before);
  await page.clock.resume();
  await chooseHour(page, 24);
  await page
    .getByRole("combobox", { name: "House style", exact: true })
    .selectOption("tower");
  await page.waitForFunction(
    () =>
      !!(window as any).kitty?.ready() &&
      (window as any).kitty.theme() === "tower",
  );
  await page.locator("#time-controls > summary").click();
  await expect(page.locator("#time-value")).toHaveText("12:00 AM");
  await expect(page.locator("#time-hour")).toHaveValue("0");
  expect(await page.evaluate(() => (window as any).kitty.daylight().hour)).toBe(
    0,
  );
  await expect(page.locator("#time-mode")).toContainText("Manual time");
  await page
    .getByRole("button", { name: "Return to live time", exact: true })
    .click();
  await expect(page.locator("#time-mode")).toHaveText(
    "Live · Central Time (CDT)",
  );
  await expect(page.locator("#time-value")).toHaveText("8:30 AM");
  await expect(
    page.getByRole("button", { name: "Return to live time", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("little-house.daylight.v1")!).mode,
    ),
  ).toBe("live");
});
