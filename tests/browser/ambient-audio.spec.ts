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
  await page.goto("/?test=1&ambient=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as any).kitty?.ready());
  expect(errors).toEqual([]);
  const body = page.locator("body");
  const player = page.locator(".house-stage > .ambient-audio");
  await expect(body).toHaveClass(/house-fullscreen/);
  expect(await page.evaluate(() => document.fullscreenElement)).toBe(null);
  await expect(player.getByRole("combobox", { name: "Ambience sound" })).toHaveValue("cabin-v2");
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
  await expect(player.getByRole("status")).toHaveText("Sound unavailable. Press Play to retry.");
  await play.click();
  await expect(player.getByRole("button", { name: "Pause ambience" })).toBeEnabled();
  expect(requests).toBe(2);
});

test("each house remembers its own sound and a playing selection switches tracks", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("little-house.theme.v1")) return;
    localStorage.setItem("little-house.theme.v1", "original");
    localStorage.setItem("little-house.ambience-track.v1:original", "constructor");
  });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/assets/ambience/")) requests.push(request.url());
  });
  await page.goto("/?test=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as any).kitty?.ready());
  const sound = page.getByRole("combobox", { name: "Ambience sound" });
  await expect(sound).toHaveValue("original");
  await expect(sound.locator("option")).toHaveCount(6);
  await sound.selectOption("cabin");
  expect(requests).toEqual([]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(sound).toHaveValue("cabin");
  expect(requests).toEqual([]);

  const forest = page.waitForResponse("**/assets/ambience/cabin.mp3");
  await page.getByRole("button", { name: "Play ambience" }).click();
  expect((await forest).ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Pause ambience" })).toBeEnabled();
  const cricket = page.waitForResponse("**/assets/ambience/tower.mp3");
  await sound.selectOption("tower");
  expect((await cricket).ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Pause ambience" })).toBeEnabled();

  async function visit(id: string) {
    await page.locator("#house-theme").selectOption(id);
    await page.waitForFunction((house) => {
      const app = (window as any).kitty;
      return app?.ready() && app.theme() === house;
    }, id);
  }

  await visit("ramen");
  await expect(sound).toHaveValue("ramen");
  await expect(page.getByRole("button", { name: "Play ambience" })).toBeEnabled();
  await sound.selectOption("ramen-v2");
  await visit("original");
  await expect(sound).toHaveValue("tower");
  await visit("ramen");
  await expect(sound).toHaveValue("ramen-v2");
  expect(requests).toHaveLength(2);
});
