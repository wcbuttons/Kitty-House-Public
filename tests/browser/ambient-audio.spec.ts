import { expect, test } from "@playwright/test";

test("ambient view pauses motion independently of its opt-in audio loop", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("little-house.theme.v1", "cabin-v2");
    const createGain = BaseAudioContext.prototype.createGain;
    let master: GainNode | undefined;
    BaseAudioContext.prototype.createGain = function () {
      const node = createGain.call(this);
      master ??= node;
      return node;
    };
    const setGain = AudioParam.prototype.setTargetAtTime;
    AudioParam.prototype.setTargetAtTime = function (...args) {
      if (this === master?.gain)
        document.body.dataset.testAmbientGainTarget = String(args[0]);
      return setGain.apply(this, args);
    };
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.loop) {
        document.body.dataset.testAmbientLoop =
          `${this.buffer?.duration}/${this.loopStart}`;
        document.body.dataset.testAmbientGain = String(master?.gain.value);
      }
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
  await expect(player.getByText("Forest water drops")).toBeVisible();
  expect(await body.getAttribute("data-test-ambient-loop")).toBeNull();

  const recording = page.waitForResponse("**/assets/ambience/cabin-v2.mp3");
  await page.mouse.move(36, 90);
  await player.getByRole("button", { name: "Play ambience" }).click();
  expect((await recording).ok()).toBe(true);
  await expect(player.getByRole("button", { name: "Pause ambience" })).toBeEnabled();
  await expect(body).toHaveAttribute("data-test-ambient-loop", /^\d{2,}(?:\.\d+)?\/0$/);
  expect(Number((await body.getAttribute("data-test-ambient-loop"))!.split("/")[0])).toBeGreaterThan(20);
  expect(Number(await body.getAttribute("data-test-ambient-gain"))).toBeCloseTo(0.21);
  const slider = player.getByRole("slider", { name: "Ambience volume" });
  await slider.press("End");
  await expect(body).toHaveAttribute("data-test-ambient-gain-target", "0.5");
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

test("ambience downloads only after Play and can retry a failed recording", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("little-house.theme.v1", "ramen"));
  let requests = 0;
  await page.route("**/assets/ambience/*.mp3", (route) => {
    requests++;
    return requests === 1 ? route.fulfill({ status: 503 }) : route.continue();
  });
  await page.goto("/?test=1");
  await page.waitForFunction(() => (window as any).kitty?.ready());
  expect(requests).toBe(0);
  const player = page.getByRole("group", { name: "Ambience audio" });
  const play = player.getByRole("button", { name: "Play ambience" });
  await play.click();
  await expect(player.getByText("Sound unavailable")).toBeVisible();
  await play.click();
  await expect(player.getByRole("button", { name: "Pause ambience" })).toBeEnabled();
  expect(requests).toBe(2);
});
