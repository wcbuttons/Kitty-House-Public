import { expect, test } from "@playwright/test";

test("ambient view pauses motion independently of its opt-in audio loop", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("little-house.theme.v1", "cabin-v2");
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.loop)
        document.body.dataset.testAmbientLoop =
          `${this.buffer?.duration}/${this.loopStart}`;
      return original.apply(this, args);
    };
  });
  await page.goto("/?test=1&ambient=1");
  await expect.poll(async () => ({
    ready: await page.evaluate(() => !!(window as any).kitty?.ready()),
    errors,
  })).toEqual({ ready: true, errors: [] });
  const body = page.locator("body");
  const player = page.locator(".house-stage > .ambient-audio");
  await expect(body).toHaveClass(/house-fullscreen/);
  expect(await page.evaluate(() => document.fullscreenElement)).toBe(null);
  await expect(player.getByText("Woodland creek")).toBeVisible();
  expect(await body.getAttribute("data-test-ambient-loop")).toBeNull();

  await page.mouse.move(36, 90);
  await player.getByRole("button", { name: "Play ambience" }).click();
  await expect(player.getByRole("button", { name: "Pause ambience" })).toBeEnabled();
  await expect(body).toHaveAttribute("data-test-ambient-loop", "45.5/1.5");
  const slider = player.getByRole("slider", { name: "Ambience volume" });
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("little-house.ambience-volume.v1"),
  )).toBe("0");

  await page.getByRole("button", { name: "Pause motion" }).click();
  await expect(page.getByRole("button", { name: "Resume motion" })).toBeVisible();
  await expect(player.getByRole("button", { name: "Pause ambience" })).toBeEnabled();
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  const normalPlayer = page.locator(".house-settings > .ambient-audio");
  await expect(normalPlayer.getByRole("button", { name: "Pause ambience" })).toBeEnabled();
  await normalPlayer.getByRole("button", { name: "Pause ambience" }).click();
  await expect(normalPlayer.getByRole("button", { name: "Play ambience" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Resume simulation" })).toBeVisible();

  await page.goto("/?test=1");
  expect(await body.getAttribute("data-test-ambient-loop")).toBeNull();
  await expect(normalPlayer.getByRole("slider", { name: "Ambience volume" })).toHaveValue("0");
  await expect(normalPlayer.getByRole("button", { name: "Play ambience" })).toBeEnabled();
  expect(errors).toEqual([]);
});
