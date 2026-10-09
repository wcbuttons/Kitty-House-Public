import { test, expect, type Page } from "@playwright/test";
const roster = (page: Page) =>
  page.evaluate(() => (window as any).kitty.roster());
async function ready(page: Page) {
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
}
async function editCats(page: Page) {
  await page.getByRole("button", { name: "Edit house" }).click();
  await page.getByRole("tab", { name: "Cats", exact: true }).click();
}

test("18 animated looks, catalog filters, saved adoption, room changes, removal and shared undo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await ready(page);
  await editCats(page);
  await expect(
    page.getByRole("tab", { name: "Cats", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-cat-add]")).toHaveCount(18);
  await expect(page.locator(".new-coat")).toHaveCount(12);
  expect(
    await page.evaluate(() => {
      const scene = (window as any).kitty.scene;
      return Array.from({ length: 18 }, (_, i) => i + 1).every((id) =>
        [
          "idle",
          "walk",
          "sleep",
          "sit",
          "groom",
          "scratch",
          "perch",
          "hide",
          "play",
          "jump",
          "drop",
          "recover",
          "anticipate",
        ].every(
          (state) =>
            scene.textures.exists(`cat-${id}-${state}`) &&
            scene.anims.exists(`cat-${id}-${state}`),
        ),
      );
    }),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/cat-catalog.png",
    fullPage: true,
  });
  await page
    .getByRole("searchbox", { name: "Search cats", exact: true })
    .fill("tabby");
  await expect(page.locator("[data-cat-add]")).toHaveCount(3);
  await page
    .getByRole("searchbox", { name: "Search cats", exact: true })
    .fill("tuxedo");
  await expect(page.locator("[data-cat-add]")).toHaveCount(1);
  await page
    .getByLabel("New cat's room", { exact: true })
    .selectOption("library");
  const before = await roster(page);
  await page
    .getByRole("button", { name: "Add Classic Tuxedo cat", exact: true })
    .click();
  const added = (await roster(page)).find(
    (cat: any) => !before.some((old: any) => old.id === cat.id),
  );
  expect(added.variant).toBe(7);
  expect(added.roomId).toBe("library");
  await expect(page.locator("#cat-count")).toHaveText("13");
  await page.getByRole("tab", { name: /At home/ }).click();
  await expect(page.locator("[data-cat-resident]")).toHaveCount(1);
  await page.getByLabel(`Home room for ${added.name}`).selectOption("attic");
  expect(
    (await roster(page)).find((cat: any) => cat.id === added.id).roomId,
  ).toBe("attic");
  await page
    .getByRole("button", { name: `Meet ${added.name}`, exact: true })
    .click();
  await expect(page.locator("#cat-name")).toHaveText(added.name);
  await page.screenshot({
    path: "docs/screenshots/cats-at-home.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: `Remove ${added.name}`, exact: true })
    .click();
  await expect(page.locator("#inspector")).toBeHidden();
  expect(await roster(page)).toHaveLength(12);
  await page.getByRole("button", { name: /Undo/ }).click();
  expect(
    (await roster(page)).find((cat: any) => cat.id === added.id).roomId,
  ).toBe("attic");
  await page.getByRole("tab", { name: "Furniture", exact: true }).click();
  await page.getByRole("button", { name: "Reset layout", exact: true }).click();
  await page.getByRole("button", { name: /Undo/ }).click();
  expect(await roster(page)).toHaveLength(13);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  expect((await roster(page)).find((cat: any) => cat.id === added.id)).toEqual({
    ...added,
    roomId: "attic",
  });
  await editCats(page);
  await page
    .getByRole("searchbox", { name: "Search cats", exact: true })
    .fill("not a cat");
  await expect(page.getByText("No cats found.", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Clear cat filters", exact: true })
    .click();
  await expect(page.locator("[data-cat-add]")).toHaveCount(18);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("an empty cat roster persists and the climbing demonstration restores it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await editCats(page);
  await page.getByRole("tab", { name: /At home/ }).click();
  for (let i = 0; i < 12; i++)
    await page.locator("[data-cat-remove]").first().click();
  expect(await roster(page)).toEqual([]);
  await expect(
    page.getByText("A quiet house, ready for cats.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finish editing" }).click();
  await page.getByText("About this little house", { exact: true }).click();
  await page
    .getByRole("button", {
      name: "Try the climbing demonstration",
      exact: true,
    })
    .click();
  expect(await roster(page)).toHaveLength(1);
  await page
    .getByRole("button", { name: "Restore my house", exact: true })
    .click();
  expect(await roster(page)).toEqual([]);
  await page
    .getByRole("button", {
      name: "Try the climbing demonstration",
      exact: true,
    })
    .click();
  await page.reload();
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  expect(await roster(page)).toEqual([]);
  await expect(page.locator("#cat-count")).toHaveText("0");
  expect(errors).toEqual([]);
});

test("temporary stress cats restore the chosen roster and a full catalog explains its limit", async ({
  page,
}) => {
  await ready(page);
  await editCats(page);
  await page
    .getByRole("button", { name: "Add Snow White cat", exact: true })
    .click();
  const chosen = await roster(page);
  await page.getByRole("button", { name: "Finish editing" }).click();
  await page.getByRole("button", { name: "Show paths", exact: true }).click();
  await page.getByRole("button", { name: "25 cats", exact: true }).click();
  expect(await roster(page)).toHaveLength(25);
  await page.getByRole("button", { name: "13 cats", exact: true }).click();
  expect(await roster(page)).toEqual(chosen);
  await page.getByRole("button", { name: "25 cats", exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  expect(await roster(page)).toEqual(chosen);
  // A full saved house can still be managed, but cannot silently exceed its limit.
  const full = Array.from({ length: 40 }, (_, i) => ({
    ...chosen[i % chosen.length],
    id: `cat-${i}`,
    name: `Resident ${i + 1}`,
    variant: (i % 18) + 1,
  }));
  await page.evaluate(
    (cats) =>
      localStorage.setItem(
        "little-house.cats.v1",
        JSON.stringify({ version: 1, cats }),
      ),
    full,
  );
  await page.reload();
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  await editCats(page);
  expect(await roster(page)).toHaveLength(40);
  await expect(page.locator("[data-cat-add]:disabled")).toHaveCount(18);
  await expect(page.locator("#cat-catalog-summary")).toContainText(
    "House full",
  );
  await page.getByRole("tab", { name: /At home/ }).click();
  await page.locator("[data-cat-remove]").first().click();
  await page.getByRole("tab", { name: /Cat catalog/ }).click();
  await expect(page.locator("[data-cat-add]:disabled")).toHaveCount(0);
});
