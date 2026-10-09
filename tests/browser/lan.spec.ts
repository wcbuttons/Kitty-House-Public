import { expect, test } from "@playwright/test";

test("furniture catalog remains editable when randomUUID is unavailable on LAN HTTP", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    Object.defineProperty(Crypto.prototype, "randomUUID", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");
  await page.getByRole("button", { name: "Edit house" }).click();
  await page
    .getByRole("button", { name: "Add Cardboard box", exact: true })
    .click();
  await page.getByLabel("Across", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Place piece", exact: true }).click();
  const layout = await page.evaluate(() => (window as any).kitty.layout());
  expect(layout.furniture).toHaveLength(23);
  const added = layout.furniture.find(
    (piece: any) => !piece.instanceId.startsWith("demo-"),
  );
  expect(added).toBeTruthy();
  await page.reload();
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  expect(
    (await page.evaluate(() => (window as any).kitty.layout())).furniture,
  ).toContainEqual(added);
  expect(errors).toEqual([]);
});
