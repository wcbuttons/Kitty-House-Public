import { expect, test, type Page } from "@playwright/test";

async function renderedPixels(page: Page, point: number[]) {
  return page.evaluate((lampPoint) => {
    const renderer = (window as any).kitty.scene.game.renderer;
    return new Promise<number[][]>((resolve) => {
      renderer.snapshot((image: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        resolve(
          [lampPoint, [700, 80]].map(([x, y]) =>
            Array.from(context.getImageData(x, y, 1, 1).data),
          ),
        );
      });
    });
  }, point);
}

for (const theme of ["ramen", "cabin"] as const) {
  test(`${theme} lanterns flicker locally, pause, and respect reduced motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript((id) => {
      localStorage.setItem("little-house.theme.v1", id);
      localStorage.setItem("little-house.daylight.v1", JSON.stringify({
        version: 1, mode: "manual", manualHour: 0,
      }));
    }, theme);
    await page.goto("/?test=1");
    await page.waitForFunction(() => !!(window as any).kitty?.ready());
    // Use an exposed wall lantern; furniture correctly occludes lights behind it.
    const index = 3;
    const point = theme === "ramen" ? [1386, 476] : [319, 579];
    const samples = await page.evaluate((index) => {
      const { simulation: sim, scene } = (window as any).kitty;
      sim.paused = true;
      const names = ["glow", "core", "shade"].map(
        (part) => `lantern-${index}-${part}`,
      );
      let bright = { time: 0, alpha: 0 },
        dim = { time: 0, alpha: 0 };
      let quiet = 0,
        steadySamples = 0;
      for (let tick = 0; tick < 600; tick++) {
        sim.elapsed = tick / 10;
        scene.update(0, 0);
        const [, core, shade] = names.map(
          (name) => scene.children.getByName(name).alpha,
        );
        if (core > bright.alpha) bright = { time: sim.elapsed, alpha: core };
        if (shade > dim.alpha) dim = { time: sim.elapsed, alpha: shade };
        if (core === 0 && shade === 0) {
          quiet = sim.elapsed;
          steadySamples++;
        }
      }
      const lights = () =>
        scene.children.list.filter((item: any) =>
          item.name?.startsWith("lantern-"),
        );
      const count = lights().length;
      for (let redraw = 0; redraw < 10; redraw++) scene.drawHouse();
      return {
        bright,
        dim,
        quiet,
        steadySamples,
        count,
        afterRedraw: lights().length,
      };
    }, index);
    expect(samples.steadySamples).toBeGreaterThan(400);
    expect(samples.bright.alpha).toBeGreaterThan(0.025);
    expect(samples.bright.alpha).toBeLessThan(0.14);
    expect(samples.dim.alpha).toBeLessThan(0.1);
    expect(samples.count).toBe(theme === "ramen" ? 12 : 15);
    expect(samples.afterRedraw).toBe(samples.count);
    const at = async (time: number) => {
      await page.evaluate((seconds) => {
        const { simulation, scene } = (window as any).kitty;
        simulation.elapsed = seconds;
        scene.update(0, 0);
      }, time);
      return renderedPixels(page, point);
    };
    const quiet = await at(samples.quiet);
    const bright = await at(samples.bright.time);
    const dim = await at(samples.dim.time);
    const brightness = (pixel: number[]) =>
      pixel.slice(0, 3).reduce((sum, channel) => sum + channel, 0);
    expect(brightness(bright[0])).toBeGreaterThan(brightness(dim[0]) + 4);
    expect(bright[1]).toEqual(quiet[1]);
    expect(dim[1]).toEqual(quiet[1]);
    await page.waitForTimeout(400);
    expect(await renderedPixels(page, point)).toEqual(dim);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await at(samples.bright.time)).toEqual(quiet);
  });
}
