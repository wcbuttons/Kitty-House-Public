import { expect, test } from "@playwright/test";

test("Cat Cafe keeps its shoji lattice intact through the day and night transition", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    localStorage.setItem("little-house.theme.v1", "ramen-v2");
    localStorage.setItem("little-house.daylight.v1", JSON.stringify({ version: 1, mode: "manual", manualHour: 12 }));
  });
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  await page.evaluate(() => {
    const app = (window as any).kitty;
    app.simulation.paused = true;
    app.setLayout({ version: 1, furniture: [] });
    app.scene.catSprites.forEach((sprite: any) => sprite.setVisible(false));
  });
  await page.getByRole("button", { name: "Fullscreen house", exact: true }).click();

  const mask = await page.evaluate(() => {
    const scene = (window as any).kitty.scene;
    const canvas = document.createElement("canvas");
    canvas.width = 1408;
    canvas.height = 792;
    const context = canvas.getContext("2d")!;
    context.drawImage(scene.textures.get("theme-window-mask").getSourceImage(), 0, 0);
    const pixels = context.getImageData(777, 248, 214, 93).data;
    const visited = new Set<number>();
    const cells = [];
    const alphaValues = new Set<number>();
    for (let y = 0; y < 93; y++) for (let x = 0; x < 214; x++) {
      const index = y * 214 + x;
      const alpha = pixels[index * 4 + 3];
      alphaValues.add(alpha);
      if (!alpha || visited.has(index)) continue;
      const queue = [index];
      visited.add(index);
      let minX = x, maxX = x, minY = y, maxY = y;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const point = queue[cursor], px = point % 214, py = Math.floor(point / 214);
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
          if (nx < 0 || ny < 0 || nx >= 214 || ny >= 93) continue;
          const next = ny * 214 + nx;
          if (pixels[next * 4 + 3] && !visited.has(next)) {
            queue.push(next);
            visited.add(next);
          }
        }
      }
      cells.push({ area: queue.length, width: maxX - minX + 1, height: maxY - minY + 1 });
    }
    return { cells, alphaValues: [...alphaValues].sort((a, b) => a - b) };
  });
  // The old brightness threshold merged several paper cells and put isolated
  // holes inside them. Every paper cell must remain a closed rectangle, with
  // subdued translucent lighting rather than an opaque replacement texture.
  expect(mask.alphaValues).toEqual([0, 51]);
  expect(mask.cells).toHaveLength(32);
  for (const cell of mask.cells) {
    expect(cell.area).toBe(cell.width * cell.height);
    expect(cell.width).toBeGreaterThanOrEqual(20);
    expect(cell.width).toBeLessThanOrEqual(25);
    expect(cell.height).toBeGreaterThanOrEqual(18);
    expect(cell.height).toBeLessThanOrEqual(23);
  }

  for (const hour of [4.25, 6.5, 12, 18.5, 23]) {
    await page.evaluate((hour) => (window as any).kitty.daylightClock.setManual(hour), hour);
    await page.evaluate(() => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const light = await page.evaluate(() => {
      const windows = (window as any).kitty.scene.daylightArt.windowViews;
      const pixels = windows.context.getImageData(0, 0, 1408, 792).data;
      const alpha = (x: number, y: number) => pixels[(y * 1408 + x) * 4 + 3];
      const wood: number[] = [];
      // Previously faint lower mullions disappeared precisely at these rows.
      for (const x of [778, 803, 804, 830, 856, 857, 883, 909, 910, 936, 962, 963, 989])
        for (let y = 251; y < 338; y++) wood.push(alpha(x, y));
      for (const y of [249, 272, 273, 295, 296, 317, 318, 339])
        for (let x = 780; x < 988; x++) wood.push(alpha(x, y));
      return {
        strongestWoodLight: Math.max(...wood),
        paperLight: [790, 817, 843, 870, 896, 923, 949, 976].map((x) => alpha(x, 306)),
      };
    });
    expect(light.strongestWoodLight, `wood must not receive the paper overlay at ${hour}`).toBe(0);
    if (hour === 6.5 || hour === 18.5) {
      expect(Math.min(...light.paperLight), `twilight should still softly illuminate the paper at ${hour}`).toBeGreaterThan(0);
      expect(Math.max(...light.paperLight), `twilight must preserve the paper texture at ${hour}`).toBeLessThanOrEqual(51);
    } else {
      expect(light.paperLight).toEqual(Array(8).fill(0));
    }

    const contrast = await page.evaluate(() => new Promise<number[]>((resolve) => {
      const { scene } = (window as any).kitty;
      scene.game.renderer.snapshot((image: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const camera = scene.cameras.main;
        const luminance = (x: number, y: number) => {
          const px = Math.floor((x - camera.worldView.x) * camera.zoom);
          const py = Math.floor((y - camera.worldView.y) * camera.zoom);
          const index = (py * canvas.width + px) * 4;
          return pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
        };
        resolve([803.5, 856.5, 909.5, 962.5].map((x) =>
          luminance(x, 306) / Math.min(luminance(x - 5, 306), luminance(x + 5, 306))));
      });
    }));
    for (const ratio of contrast)
      expect(ratio, `the actual rendered vertical slat must stay darker than both neighboring panes at ${hour}`).toBeLessThan(0.85);
  }
  expect(errors).toEqual([]);
});
