import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
}

async function switchHouse(page: Page, id: string) {
  await Promise.all([
    page.waitForEvent("load"),
    page
      .getByRole("combobox", { name: "House style", exact: true })
      .selectOption(id),
  ]);
  await page.waitForFunction(
    (theme) =>
      !!(window as any).kitty?.ready() &&
      (window as any).kitty.theme() === theme,
    id,
  );
  await expect(
    page.getByRole("combobox", { name: "House style", exact: true }),
  ).toHaveValue(id);
}

const savedHouse = (page: Page) =>
  page.evaluate(() => ({
    layout: (window as any).kitty.layout(),
    cats: (window as any).kitty.roster(),
  }));

async function adoptCat(page: Page) {
  await page.getByRole("button", { name: "Edit house" }).click();
  await page.getByRole("tab", { name: "Cats", exact: true }).click();
  await page
    .getByRole("button", { name: "Add Classic Tuxedo cat", exact: true })
    .click();
  await page.getByRole("button", { name: "Finish editing" }).click();
}

test("each house preserves its own layout and residents when switching, including a temporary demo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await expect(
    page.getByRole("combobox", { name: "House style", exact: true }),
  ).toHaveValue("original");
  await expect(page.locator("#cat-count")).toHaveText("12");
  await page.evaluate(() => {
    const app = (window as any).kitty;
    const layout = app.layout();
    layout.furniture.splice(0, 1);
    app.setLayout(layout);
  });
  await adoptCat(page);
  const original = await savedHouse(page);
  const originalRaw = await page.evaluate(() => [
    localStorage.getItem("little-house.layout.v1"),
    localStorage.getItem("little-house.cats.v1"),
  ]);
  await page.getByText("About this little house", { exact: true }).click();
  await page
    .getByRole("button", { name: "Try the climbing demonstration" })
    .click();

  await switchHouse(page, "cabin");
  await expect(page.locator("#cat-count")).toHaveText("10");
  await page.evaluate(() => {
    const app = (window as any).kitty;
    const layout = app.layout();
    layout.furniture.splice(-1, 1);
    app.setLayout(layout);
  });
  await adoptCat(page);
  const cabin = await savedHouse(page);

  await switchHouse(page, "ramen");
  await expect(page.locator("#cat-count")).toHaveText("6");
  await page.getByText("About this little house", { exact: true }).click();
  await expect(page.locator("#route-demo")).toBeHidden();
  await page.evaluate(() => {
    const app = (window as any).kitty;
    app.setLayout({ ...app.layout(), furniture: [] });
  });
  await page.getByRole("button", { name: "Edit house" }).click();
  await page.locator('[data-piece="box"]').click();
  const firstRoom = await page
    .locator("#room option")
    .first()
    .getAttribute("value");
  expect(firstRoom).not.toBe("lounge");
  await expect(
    page.getByRole("combobox", { name: "Room", exact: true }),
  ).toHaveValue(firstRoom!);
  await page.getByRole("button", { name: "Place piece", exact: true }).click();
  await page.getByRole("button", { name: "Finish editing" }).click();
  await adoptCat(page);
  const ramen = await savedHouse(page);
  expect(ramen.layout.furniture).toHaveLength(1);
  expect(ramen.cats).toHaveLength(7);
  expect(
    await page.evaluate(() => [
      localStorage.getItem("little-house.layout.v1"),
      localStorage.getItem("little-house.cats.v1"),
    ]),
  ).toEqual(originalRaw);

  for (const [id, expected] of [
    ["original", original],
    ["cabin", cabin],
    ["ramen", ramen],
  ] as const) {
    await switchHouse(page, id);
    expect(await savedHouse(page)).toEqual(expected);
    await expect(page.locator("#undo")).toBeDisabled();
  }
  await page.reload();
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  expect(await savedHouse(page)).toEqual(ramen);
  expect(errors).toEqual([]);
});

test("both new houses animate, edit, reset their own cats, and present without controls in fullscreen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await ready(page);
  for (const [theme, count] of [
    ["cabin", 10],
    ["ramen", 6],
  ] as const) {
    await switchHouse(page, theme);
    const moving = await page.evaluate(() => {
      const app = (window as any).kitty;
      const before = app.snapshot().cats;
      app.step(10);
      return app
        .snapshot()
        .cats.filter(
          (cat: any, index: number) =>
            cat.x !== before[index].x ||
            cat.y !== before[index].y ||
            cat.state !== before[index].state,
        ).length;
    });
    expect(moving).toBeGreaterThan(1);
    await page
      .getByRole("button", { name: "Fullscreen house", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "House style", exact: true }),
    ).toBeHidden();
    await expect(page.locator(".house-stage")).not.toHaveClass(
      /controls-visible/,
    );
    await expect(page.locator(".fullscreen-controls")).toHaveCSS(
      "opacity",
      "0",
    );
    await page.screenshot({ path: `docs/screenshots/${theme}-house.png` });
    await page.mouse.move(20, 20);
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .click();
    await adoptCat(page);
    await expect(page.locator("#cat-count")).toHaveText(String(count + 1));
    await page.getByRole("button", { name: "Edit house" }).click();
    await page.getByRole("button", { name: "Reset cats", exact: true }).click();
    await expect(page.locator("#cat-count")).toHaveText(String(count));
    await page.getByRole("tab", { name: "Furniture", exact: true }).click();
    expect(
      await page.evaluate(() => {
        const scene = (window as any).kitty.scene;
        return (
          scene.textures.exists("theme-house") &&
          scene.textures.exists("theme-fixtures") &&
          Array.from(
            document.querySelectorAll<HTMLElement>("[data-piece]"),
          ).every((button) =>
            scene.textures.exists(`theme-furniture-${button.dataset.piece}`),
          )
        );
      }),
    ).toBe(true);
    expect(
      await page
        .locator(".furniture-thumbnail img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    ).toBe(true);
    const selected = await page.evaluate(() => {
      const app = (window as any).kitty;
      const furniture = app.layout().furniture[0];
      app.selectFurniture(furniture.instanceId);
      return furniture;
    });
    await page
      .getByLabel("Across", { exact: true })
      .fill(String(selected.gridX + 1));
    await expect
      .poll(() =>
        page.evaluate(() => {
          const scene = (window as any).kitty.scene;
          const ghost = scene.children.getByName("theme-layer-11");
          const preview = scene.children.getByName("theme-layer-39");
          return (
            ghost?.list.some((image: any) => image.visible) &&
            preview?.list.some((image: any) => image.visible)
          );
        }),
      )
      .toBe(true);
    const texturePreview = await page.evaluate(() => {
      const scene = (window as any).kitty.scene;
      const layer = (depth: number) =>
        scene.children.getByName(`theme-layer-${depth}`);
      const visible = (depth: number) =>
        layer(depth).list.filter((image: any) => image.visible);
      const ghost = visible(11)[0];
      const preview = visible(39)[0];
      const before = [10, 11, 39].map((depth) => layer(depth).list.length);
      for (let frame = 0; frame < 120; frame++) {
        scene.refresh();
        scene.update(0, 0);
      }
      return {
        sourceAlpha: layer(11).alpha,
        previewAlpha: layer(39).alpha,
        sourceCount: visible(11).length,
        previewCount: visible(39).length,
        sourceInRegularLayer: visible(10).some(
          (image: any) => image.name === ghost.name,
        ),
        matchingTexture: ghost.texture.key === preview.texture.key,
        offset: preview.x - ghost.x,
        matchingSize:
          ghost.displayWidth === preview.displayWidth &&
          ghost.displayHeight === preview.displayHeight,
        before,
        after: [10, 11, 39].map((depth) => layer(depth).list.length),
      };
    });
    expect(texturePreview).toMatchObject({
      sourceAlpha: 0.23,
      previewAlpha: 1,
      sourceCount: 1,
      previewCount: 1,
      sourceInRegularLayer: false,
      matchingTexture: true,
      matchingSize: true,
      offset: 26,
    });
    expect(texturePreview.after).toEqual(texturePreview.before);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const scene = (window as any).kitty.scene;
          return [11, 39].every((depth) =>
            scene.children
              .getByName(`theme-layer-${depth}`)
              .list.every((image: any) => !image.visible),
          );
        }),
      )
      .toBe(true);
    await page.screenshot({
      path: `docs/screenshots/${theme}-editor.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("combobox", { name: "House style", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  expect(errors).toEqual([]);
});

test("a failed save leaves the current house and selection in place", async ({
  page,
}) => {
  await ready(page);
  const before = await savedHouse(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "little-house.layout.v1") throw new Error("Storage is full");
      original.call(this, key, value);
    };
  });
  await page
    .getByRole("combobox", { name: "House style", exact: true })
    .selectOption("cabin");
  await expect(
    page.getByRole("combobox", { name: "House style", exact: true }),
  ).toHaveValue("original");
  await expect(page.locator("#toast")).toContainText("could not save");
  expect(await savedHouse(page)).toEqual(before);
  expect(
    await page.evaluate(() => localStorage.getItem("little-house.theme.v1")),
  ).toBeNull();
});
