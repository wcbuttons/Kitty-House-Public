import { expect, test } from "@playwright/test";

test("outdoor ambience follows the simulation clock and reduced motion", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("little-house.theme.v1", "ramen"));
  await page.goto("/?test=1&ambient=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as any).kitty?.ready());
  const commands = () => page.evaluate(() => {
    const scene = (window as any).kitty.scene;
    return scene.children.getByName("house-ambience-motion")?.commandBuffer ?? [];
  });
  await expect.poll(async () => (await commands()).length).toBeGreaterThan(0);
  const active = await commands();
  await expect.poll(commands).not.toEqual(active);

  const pause = page.getByRole("button", { name: "Pause motion" });
  await pause.focus();
  await pause.click();
  const paused = await commands();
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  ));
  expect(await commands()).toEqual(paused);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(commands).toEqual([]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await commands()).length).toBeGreaterThan(0);
});
