import { expect, test } from "@playwright/test";

test("the real fireplace sheet animates all day, clears the grate, and keeps daylight-controlled reflections", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("little-house.theme.v1", "cabin-v2");
    localStorage.setItem("little-house.daylight.v1", JSON.stringify({ version: 1, mode: "manual", manualHour: 12 }));
  });
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  const result = await page.evaluate(() => {
    const { scene, simulation, daylightClock } = (window as any).kitty;
    simulation.paused = true;
    const sprite = scene.children.getByName("theme-fireplace-flames");
    const sheet = sprite.texture.getSourceImage();
    const canvas = document.createElement("canvas");
    canvas.width = sheet.width; canvas.height = sheet.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(sheet, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const frames = [];
    for (let frame = 0; frame < 16; frame++) {
      let painted = 0, leaks = 0, grateFilled = 0;
      let hash = 2166136261;
      for (let y = 0; y < 66; y++) for (let x = 0; x < 45; x++) {
        const index = (y * canvas.width + frame * 45 + x) * 4;
        for (let channel = 0; channel < 4; channel++) hash = Math.imul(hash ^ data[index + channel], 16777619);
        if (!data[index + 3]) continue;
        painted++;
        const wx = x + 252, wy = y + 608;
        if (wy < 630 && (wx - 274) ** 2 + (wy - 630) ** 2 > 22 ** 2) leaks++;
        if ((wy === 668 && wx >= 254 && wx <= 294) ||
          (wy >= 660 && wy <= 670 && wx >= 256 && wx <= 293 && (wx - 256) % 9 === 0)) grateFilled++;
      }
      frames.push({ painted, leaks, grateFilled, hash });
    }
    const hours = [6.5, 12, 18.5, 23].map((hour) => {
      daylightClock.setManual(hour);
      const frameNumbers = [0.05, 0.55, 1.05, 1.65].map((seconds) => {
        simulation.elapsed = seconds;
        scene.update(0, 0);
        return Number(sprite.frame.name);
      });
      return { hour, frameNumbers, alpha: sprite.alpha, visible: sprite.visible,
        dayAlpha: scene.children.getByName("theme-house-day").alpha };
    });
    const glow = (hour: number) => {
      daylightClock.setManual(hour);
      let peak = 0;
      for (let seconds = 0; seconds < 20; seconds += 0.1) {
        simulation.elapsed = seconds; scene.update(0, 0);
        peak = Math.max(peak, scene.children.getByName("lantern-2-core").alpha);
      }
      return peak;
    };
    return { dimensions: [sheet.width, sheet.height], frames, hours,
      position: [sprite.x, sprite.y], depth: sprite.depth,
      dayGlow: glow(12), nightGlow: glow(23) };
  });
  expect(result.dimensions).toEqual([720, 66]);
  expect(result.position).toEqual([252, 608]);
  expect(result.depth).toBe(0.75);
  expect(new Set(result.frames.map((frame) => frame.hash)).size).toBe(16);
  for (const frame of result.frames) {
    expect(frame.painted).toBeGreaterThan(200);
    expect(frame.leaks).toBe(0);
    expect(frame.grateFilled).toBe(0);
  }
  for (const hour of result.hours) {
    expect(hour.frameNumbers).toEqual([0, 5, 10, 0]);
    expect(hour.alpha).toBe(1);
    expect(hour.visible).toBe(true);
  }
  expect(result.hours.find((item) => item.hour === 12)!.dayAlpha).toBe(1);
  expect(result.hours.find((item) => item.hour === 23)!.dayAlpha).toBe(0);
  expect(result.dayGlow).toBe(0);
  expect(result.nightGlow).toBeGreaterThan(0);
  const firstLiveFrame = await page.evaluate(() => {
    const { scene, simulation } = (window as any).kitty;
    simulation.paused = false;
    return Number(scene.children.getByName("theme-fireplace-flames").frame.name);
  });
  await expect.poll(() => page.evaluate(() =>
    Number((window as any).kitty.scene.children.getByName("theme-fireplace-flames").frame.name)),
  ).not.toBe(firstLiveFrame);
  const pausedFrame = await page.evaluate(() => {
    const { scene, simulation } = (window as any).kitty;
    simulation.paused = true;
    return Number(scene.children.getByName("theme-fireplace-flames").frame.name);
  });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => Number((window as any).kitty.scene.children.getByName("theme-fireplace-flames").frame.name))).toBe(pausedFrame);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => {
    const { scene, simulation } = (window as any).kitty;
    simulation.elapsed = 0.85; scene.update(0, 0);
    return Number(scene.children.getByName("theme-fireplace-flames").frame.name);
  })).toBe(0);
  expect(errors).toEqual([]);
});
