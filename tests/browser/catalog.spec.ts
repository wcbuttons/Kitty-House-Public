import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  await page.getByRole("button", { name: "Edit house" }).click();
}
const layout = (page: Page) =>
  page.evaluate(() => (window as any).kitty.layout());

test("browse and filter the expanded catalog, add a new style, and manage it from In the house", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(page.getByRole("tab", { name: /Catalog/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("[data-piece]")).toHaveCount(28);
  expect(
    await page
      .locator(".furniture-thumbnail img")
      .evaluateAll((imgs) =>
        imgs.every(
          (img) =>
            (img as HTMLImageElement).complete &&
            (img as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  await page.getByRole("searchbox", { name: "Search furniture" }).fill("sofa");
  await expect(page.locator("[data-piece]")).toHaveCount(2);
  await page.getByRole("searchbox", { name: "Search furniture" }).fill("");
  await page
    .getByRole("combobox", { name: "Furniture category" })
    .selectOption("Comfort");
  await expect(page.locator("[data-piece]")).toHaveCount(8);
  await page.screenshot({
    path: "docs/screenshots/furniture-catalog.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Add Reading armchair", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Room", exact: true })
    .selectOption("attic");
  await page.getByLabel("Across", { exact: true }).fill("18");
  await page.getByLabel("Above floor", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Place piece", exact: true }).click();
  expect((await layout(page)).furniture).toHaveLength(23);
  await page.getByRole("tab", { name: /In the house/ }).click();
  await page
    .getByRole("searchbox", { name: "Search furniture" })
    .fill("armchair");
  await expect(page.locator("[data-placed]")).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Remove Reading armchair from The little attic",
    }),
  ).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  expect(
    (await layout(page)).furniture.some(
      (f: any) => f.definitionId === "armchair",
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Edit house" }).click();
  await page.getByRole("tab", { name: /In the house/ }).click();
  await page
    .getByRole("searchbox", { name: "Search furniture" })
    .fill("armchair");
  await page
    .getByRole("button", { name: "Move Reading armchair in The little attic" })
    .click();
  await expect(page.locator("#piece-name")).toHaveText("Reading armchair");
  await page.getByLabel("Across", { exact: true }).fill("19");
  await page
    .getByRole("button", { name: "Apply position", exact: true })
    .click();
  expect(
    (await layout(page)).furniture.find(
      (f: any) => f.definitionId === "armchair",
    ).gridX,
  ).toBe(19);
  await page
    .getByRole("button", {
      name: "Remove Reading armchair from The little attic",
    })
    .click();
  expect((await layout(page)).furniture).toHaveLength(22);
  await expect(page.locator("#placement")).toBeHidden();
  await page.getByRole("button", { name: /Undo/ }).click();
  expect((await layout(page)).furniture).toHaveLength(23);
  await page.getByRole("tab", { name: /Catalog/ }).click();
  await expect(
    page.locator('[data-piece="armchair"] .placed-quantity'),
  ).toHaveText("1 in house");
  await page
    .getByRole("searchbox", { name: "Search furniture" })
    .fill("no such piece");
  await expect(
    page.getByText("No furniture found.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("[data-piece]")).toHaveCount(28);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

async function pixel(page: Page, x: number, y: number) {
  return page.evaluate(
    ({ x, y }) =>
      new Promise<{ r: number; g: number; b: number }>((resolve) => {
        (window as any).kitty.scene.game.renderer.snapshotPixel(
          x,
          y,
          (color: any) =>
            resolve({ r: color.red, g: color.green, b: color.blue }),
        );
      }),
    { x, y },
  );
}
test("dragging renders a translucent old position and a solid preview; cancel restores it", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "little-house.daylight.v1",
      JSON.stringify({ version: 1, mode: "manual", manualHour: 0 }),
    );
  });
  await ready(page);
  await page.getByRole("button", { name: "Pause simulation" }).click();
  // Use a clear room to measure the real rendered pixel independent of cats and nearby pieces.
  const original = await layout(page);
  const sparse = {
    ...original,
    furniture: original.furniture.filter(
      (f: any) => f.roomId !== "lounge" || f.instanceId === "demo-1",
    ),
  };
  await page.evaluate((l) => (window as any).kitty.setLayout(l), sparse);
  const sample = { x: 130 + 7 * 26 + 10, y: 709 - 52 + 30 };
  const full = await pixel(page, sample.x, sample.y);
  await page.evaluate(
    (l) =>
      (window as any).kitty.setLayout({
        ...l,
        furniture: l.furniture.filter((f: any) => f.instanceId !== "demo-1"),
      }),
    sparse,
  );
  const background = await pixel(page, sample.x, sample.y);
  await page.evaluate((l) => (window as any).kitty.setLayout(l), sparse);
  const rect = await page.locator("canvas").boundingBox();
  const point = (x: number, y: number) => ({
    x: rect!.x + (x * rect!.width) / 1120,
    y: rect!.y + (y * rect!.height) / 790,
  });
  const start = point(130 + 8 * 26, 709 - 26),
    end = point(130 + 12 * 26, 709 - 26);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 15 });
  const ghost = await pixel(page, sample.x, sample.y);
  const preview = await pixel(page, sample.x + 4 * 26, sample.y);
  for (const channel of ["r", "g", "b"] as const) {
    expect(
      Math.abs(
        ghost[channel] - (full[channel] * 0.23 + background[channel] * 0.77),
      ),
    ).toBeLessThan(9);
    expect(Math.abs(preview[channel] - full[channel])).toBeLessThan(5);
  }
  expect(
    (await layout(page)).furniture.find((f: any) => f.instanceId === "demo-1")
      .gridX,
  ).toBe(7);
  await page.screenshot({
    path: "docs/screenshots/furniture-drag-ghost.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  const restored = await pixel(page, sample.x, sample.y);
  expect(restored).toEqual(full);
  await expect(page.locator("#placement")).toBeHidden();
  // Reposition through numeric controls too; a committed position must return to full opacity.
  await page.evaluate(() => (window as any).kitty.selectFurniture("demo-1"));
  await page.getByLabel("Across", { exact: true }).fill("11");
  await page
    .getByRole("button", { name: "Apply position", exact: true })
    .click();
  expect(
    (await layout(page)).furniture.find((f: any) => f.instanceId === "demo-1")
      .gridX,
  ).toBe(11);
  expect(await pixel(page, sample.x + 4 * 26, sample.y)).toEqual(full);
});
