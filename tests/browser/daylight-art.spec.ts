import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, theme: string, hour: number) {
  await page.addInitScript(
    ({ theme, hour }) => {
      localStorage.setItem("little-house.theme.v1", theme);
      localStorage.setItem(
        "little-house.daylight.v1",
        JSON.stringify({ version: 1, mode: "manual", manualHour: hour }),
      );
    },
    { theme, hour },
  );
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  await settledFrame(page);
}

async function settledFrame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function alphaSamples(
  page: Page,
  points: [number, number][],
  keys: string[],
): Promise<Record<string, number[]>> {
  return page.evaluate(
    ({ points, keys }) => {
      const scene = (window as any).kitty.scene;
      return Object.fromEntries(
        keys.map((key) => {
          const image =
            key === "effects"
              ? scene.children
                  .getByName("daylight-sky")
                  .texture.getSourceImage()
              : scene.textures.get(key).getSourceImage();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          return [
            key,
            points.map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]),
          ];
        }),
      );
    },
    { points, keys },
  );
}

test("ramen twilight reaches the sky beside the roof without coloring its tiles", async ({
  page,
}) => {
  await ready(page, "ramen", 18.5);
  // These sky gaps previously stayed blue inside conservative roof and wall
  // exclusions, including the pocket just below the right eave.
  const sky = await alphaSamples(
    page,
    [
      [450, 50],
      [550, 50],
      [700, 50],
      [890, 80],
      [330, 80],
      [900, 160],
      [886, 171],
      [874, 182],
      [894, 221],
      [910, 230],
      [915, 242],
    ],
    ["theme-sky-mask", "effects"],
  );
  expect(sky["theme-sky-mask"]).toEqual(Array(11).fill(255));
  expect(sky.effects.every((alpha) => alpha > 100)).toBe(true);
  const roof = await alphaSamples(
    page,
    [
      [400, 100],
      [663, 90],
      [550, 110],
      [450, 180],
    ],
    ["theme-sky-mask", "effects"],
  );
  expect(roof["theme-sky-mask"]).toEqual([0, 0, 0, 0]);
  expect(roof.effects).toEqual([0, 0, 0, 0]);
});

test("tower twilight colors cloud cover while roofs, rooms and hills remain occluded", async ({
  page,
}) => {
  await ready(page, "tower", 6.5);
  const clouds: [number, number][] = [
    [50, 500],
    [740, 700],
  ];
  const cloud = await alphaSamples(page, clouds, [
    "theme-sky-mask",
    "theme-atmosphere-mask",
    "effects",
  ]);
  expect(cloud["theme-sky-mask"]).toEqual([0, 0]);
  expect(cloud["theme-atmosphere-mask"]).toEqual([255, 255]);
  expect(cloud.effects.every((alpha) => alpha > 100)).toBe(true);
  const solid = await alphaSamples(
    page,
    [
      [396, 140],
      [590, 270],
      [50, 950],
      [750, 940],
    ],
    ["theme-sky-mask", "theme-atmosphere-mask", "effects"],
  );
  for (const values of Object.values(solid))
    expect(values).toEqual([0, 0, 0, 0]);
  // The temporary twilight buffer must clear completely at noon and midnight;
  // celestial objects continue to be hidden behind these same cloud pockets.
  for (const hour of [12, 0]) {
    await page.evaluate(
      (hour) => (window as any).kitty.daylightClock.setManual(hour),
      hour,
    );
    await settledFrame(page);
    expect((await alphaSamples(page, clouds, ["effects"])).effects).toEqual([
      0, 0,
    ]);
  }
});

test("tower window scenery follows twilight without painting over its frames", async ({ page }) => {
  await ready(page, "tower", 18.5);
  // Include the pointed lower window's topmost sky pixel, above its wide body.
  const windows: [number, number][] = [[385, 308], [389, 548], [381, 764], [388, 970], [405, 942]];
  const panes = await alphaSamples(page, windows, ["effects"]);
  expect(panes.effects.every((alpha) => alpha > 65)).toBe(true);
  const frames = await alphaSamples(page, [[365, 318], [357, 542], [353, 767], [364, 976]], ["effects"]);
  expect(frames.effects.every((alpha) => alpha < 26)).toBe(true);
  await page.evaluate(() => (window as any).kitty.daylightClock.setManual(12));
  await settledFrame(page);
  expect((await alphaSamples(page, windows, ["effects"])).effects).toEqual([0, 0, 0, 0, 0]);
});

test("cabin upper window sky takes on the same warm twilight as the exterior", async ({ page }) => {
  await ready(page, "cabin", 6.5);
  const windows: [number, number][] = [[693, 214], [617, 384], [1043, 384]];
  expect((await alphaSamples(page, windows, ["effects"])).effects.every((alpha) => alpha > 35)).toBe(true);
  expect((await alphaSamples(page, [[702, 227], [626, 394], [1054, 394]], ["effects"])).effects.every((alpha) => alpha < 26)).toBe(true);
});

test("illustrated placement previews share room lighting and retain their source ghost alpha", async ({ page }) => {
  await ready(page, "ramen", 18.5);
  const catalog = await page.evaluate(() => (window as any).kitty.scene.catalogThumbnail("noodle-table"));
  await page.getByRole("button", { name: "Edit house" }).click();
  const selected = await page.evaluate(() => {
    const app = (window as any).kitty;
    const furniture = app.layout().furniture.find((item: any) => item.definitionId === "noodle-table");
    app.selectFurniture(furniture.instanceId);
    return furniture;
  });
  await page.getByLabel("Across", { exact: true }).fill(String(selected.gridX + 0.5));
  await settledFrame(page);
  const appearance = () => page.evaluate(() => {
    const scene = (window as any).kitty.scene;
    const layer = (depth: number) => scene.children.getByName(`theme-layer-${depth}`);
    const visible = (depth: number) => layer(depth).list.find((image: any) => image.visible);
    const color = (image: any) => [image.tintTopLeft, image.tintTopRight, image.tintBottomLeft, image.tintBottomRight];
    return {
      ghost: color(visible(11)), preview: color(visible(39)),
      ghostAlpha: layer(11).alpha, previewAlpha: layer(39).alpha,
    };
  });
  const sunset = await appearance();
  expect(sunset.ghostAlpha).toBeCloseTo(0.23);
  expect(sunset.previewAlpha).toBe(1);
  for (let corner = 0; corner < 4; corner++) {
    for (const shift of [0, 8, 16])
      expect(Math.abs(((sunset.ghost[corner] >> shift) & 255) - ((sunset.preview[corner] >> shift) & 255))).toBeLessThanOrEqual(1);
  }
  await page.evaluate(() => (window as any).kitty.daylightClock.setManual(12));
  await settledFrame(page);
  const noon = await appearance();
  expect(noon.preview).not.toEqual(sunset.preview);
  expect(noon.ghost).toEqual(noon.preview);
  expect(await page.evaluate(() => (window as any).kitty.scene.catalogThumbnail("noodle-table"))).toBe(catalog);
});

test("flipped furniture keeps directional light on the same side in its preview and placed image", async ({ page }) => {
  await ready(page, "ramen", 18.5);
  await page.getByRole("button", { name: "Edit house" }).click();
  const id = await page.evaluate(() => {
    const app = (window as any).kitty;
    const item = app.layout().furniture.find((item: any) => item.definitionId === "ramen-counter");
    app.selectFurniture(item.instanceId);
    return item.instanceId;
  });
  const appearance = (depth: number) => page.evaluate(({ id, depth }) => {
    const scene = (window as any).kitty.scene;
    const image = scene.children.getByName(`theme-layer-${depth}`).list.find(
      (image: any) => image.name === id && image.visible,
    );
    return {
      flipX: image.flipX,
      colors: [image.tintTopLeft, image.tintTopRight, image.tintBottomLeft, image.tintBottomRight],
    };
  }, { id, depth });
  const original = await appearance(10);
  expect(original.flipX).toBe(false);
  expect(original.colors[0]).not.toBe(original.colors[1]);
  await page.locator("#flip").click();
  await settledFrame(page);
  const preview = await appearance(39);
  expect(preview.flipX).toBe(true);
  const swapped = [original.colors[1], original.colors[0], original.colors[3], original.colors[2]];
  expect(preview.colors).toEqual(swapped);
  expect((await appearance(11)).colors).toEqual(original.colors);
  await page.getByRole("button", { name: "Apply position", exact: true }).click();
  await settledFrame(page);
  const placed = await appearance(10);
  expect(placed.flipX).toBe(true);
  expect(placed.colors).toEqual(swapped);
});
