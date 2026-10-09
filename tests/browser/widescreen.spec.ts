import { expect, test, type Page } from "@playwright/test";

async function fittedCanvas(page: Page, fullscreen = false) {
  await expect
    .poll(() =>
      page.evaluate((fillsViewport) => {
        const stage = document.querySelector(".house-stage")!.getBoundingClientRect();
        const canvas = document.querySelector("canvas")!.getBoundingClientRect();
        return (
          Math.abs(canvas.width / canvas.height - 16 / 9) < 0.001 &&
          Math.abs(canvas.left - stage.left) < 1 &&
          Math.abs(canvas.top - stage.top) < 1 &&
          Math.abs(canvas.width - stage.width) < 1 &&
          Math.abs(canvas.height - stage.height) < 1 &&
          (!fillsViewport ||
            (Math.abs(canvas.width - innerWidth) < 1 &&
              Math.abs(canvas.height - innerHeight) < 1))
        );
      }, fullscreen),
    )
    .toBe(true);
}

for (const theme of ["cabin", "ramen"] as const) {
  test(`${theme} fills a 16:9 display with aligned artwork and keeps dragging accurate after fullscreen`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript((id) => {
      localStorage.setItem("little-house.theme.v1", id);
      localStorage.setItem("little-house.daylight.v1", JSON.stringify({
        version: 1, mode: "manual", manualHour: 0,
      }));
    }, theme);
    await page.goto("/?test=1");
    await page.waitForFunction(() => !!(window as any).kitty?.ready());
    await fittedCanvas(page);
    const saved = await page.evaluate(() => ({
      layout: (window as any).kitty.layout(),
      cats: (window as any).kitty.roster(),
    }));
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.getByRole("button", { name: "Fullscreen house", exact: true }).click();
    await fittedCanvas(page, true);
    const frame = await page.evaluate(() => {
      const scene = (window as any).kitty.scene;
      const camera = scene.cameras.main;
      const background = scene.children.getByName("theme-house");
      const fixtures = scene.children.getByName("theme-fixtures");
      const bounds = background.getBounds();
      return {
        canvas: [scene.game.canvas.width, scene.game.canvas.height],
        worldView: [camera.worldView.x, camera.worldView.y, camera.worldView.width, camera.worldView.height],
        background: [bounds.x, bounds.y, bounds.width, bounds.height],
        fixtures: [fixtures.x, fixtures.y, fixtures.displayWidth, fixtures.displayHeight],
        zoom: camera.zoom,
      };
    });
    expect(frame).toEqual({
      canvas: [1408, 792],
      worldView: [-144, -1, 1408, 792],
      background: [-144, -1, 1408, 792],
      fixtures: [0, 0, 1120, 790],
      zoom: 1,
    });
    // Read actual rendered pixels near both new edges. They must match the
    // opaque illustration, which also catches a shifted background or blank bars.
    const edges = await page.evaluate(() => {
      const scene = (window as any).kitty.scene;
      const source = document.createElement("canvas");
      source.width = 1408;
      source.height = 792;
      const sourceContext = source.getContext("2d")!;
      sourceContext.drawImage(scene.textures.get("theme-house").getSourceImage(), 0, 0);
      const points = [
        [8, 100], [8, 390], [8, 700],
        [1399, 100], [1399, 390], [1399, 700],
      ];
      return new Promise<{ source: number[][]; rendered: number[][] }>((resolve) => {
        scene.game.renderer.snapshot((image: HTMLImageElement) => {
          const canvas = document.createElement("canvas");
          canvas.width = 1408;
          canvas.height = 792;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          resolve({
            source: points.map(([x, y]) => Array.from(sourceContext.getImageData(x, y, 1, 1).data)),
            rendered: points.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data)),
          });
        });
      });
    });
    expect(new Set(edges.source.map((pixel) => pixel.join(","))).size).toBeGreaterThan(3);
    for (let i = 0; i < edges.source.length; i++) {
      expect(edges.source[i][3]).toBe(255);
      for (let channel = 0; channel < 4; channel++)
        expect(Math.abs(edges.source[i][channel] - edges.rendered[i][channel])).toBeLessThanOrEqual(2);
    }
    await page.screenshot({ path: `docs/screenshots/${theme}-widescreen.png` });
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.locator("body")).not.toHaveClass(/house-fullscreen/);
    expect(await page.evaluate(() => (window as any).kitty.scene.zoomLevel)).toBeCloseTo(1.15);
    expect(await page.evaluate(() => ({
      layout: (window as any).kitty.layout(),
      cats: (window as any).kitty.roster(),
    }))).toEqual(saved);
    await page.getByRole("button", { name: "Whole house", exact: true }).click();
    await fittedCanvas(page);

    // A real pointer drag verifies CSS scaling and the camera's negative origin
    // are converted back into the unchanged furniture grid, including zoom.
    await page.getByRole("button", { name: "Edit house" }).click();
    await page.evaluate(() => {
      const app = (window as any).kitty;
      app.setLayout({ ...app.layout(), furniture: [] });
    });
    await page.locator('[data-piece="box"]').click();
    await page.getByLabel("Across", { exact: true }).fill("6");
    await page.getByRole("button", { name: "Place piece", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await fittedCanvas(page);
    const drag = await page.evaluate(() => {
      const scene = (window as any).kitty.scene;
      const image = scene.children.getByName("theme-layer-10").list.find((child: any) => child.visible);
      const camera = scene.cameras.main;
      const canvas = scene.game.canvas.getBoundingClientRect();
      const scale = canvas.width / scene.game.canvas.width;
      return {
        x: canvas.left + (image.x + image.displayWidth / 2 - camera.worldView.x) * camera.zoom * scale,
        y: canvas.top + (image.y + image.displayHeight / 2 - camera.worldView.y) * camera.zoom * scale,
        distance: 3 * 26 * camera.zoom * scale,
      };
    });
    await page.mouse.move(drag.x, drag.y);
    await page.mouse.down();
    await page.mouse.move(drag.x + drag.distance, drag.y, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => (window as any).kitty.layout().furniture[0].gridX)).toBe(9);
    await page.getByRole("button", { name: "Exit edit mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await fittedCanvas(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  });
}
