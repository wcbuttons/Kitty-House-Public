import { expect, test } from "@playwright/test";

test("refined furniture retains clear leg gaps and solid cat landing surfaces", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("little-house.theme.v1", "ramen"));
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  const samples = await page.evaluate(() => {
    const scene = (window as any).kitty.scene;
    const inspect = (id: string, points: [number, number][]) => {
      const image = scene.textures.get(`theme-furniture-${id}`).getSourceImage();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return { width: image.width, height: image.height, alpha: points.map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]) };
    };
    return {
      table: inspect("noodle-table", [[117, 5], [117, 130], [117, 220], [25, 220], [207, 220], [2, 130]]),
      crate: inspect("crate", [[78, 3], [78, 40]]),
      tall: inspect("large-crate", [[78, 3], [78, 100]]),
      chest: inspect("toy-chest", [[117, 3], [117, 40]]),
    };
  });
  expect([samples.table.width, samples.table.height]).toEqual([234, 234]);
  expect(samples.table.alpha[0]).toBeGreaterThan(240);
  expect([samples.table.alpha[1], samples.table.alpha[2], samples.table.alpha[5]]).toEqual([0, 0, 0]);
  expect(samples.table.alpha.slice(3, 5).every(a => a > 240)).toBe(true);
  for (const item of [samples.crate, samples.tall, samples.chest])
    expect(item.alpha.every(a => a > 240)).toBe(true);
});

test("the planter foliage and gap between lower bowls contain no pale backdrop", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("little-house.theme.v1", "ramen"),
  );
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  const assets = await page.evaluate(() => {
    const scene = (window as any).kitty.scene;
    const inspect = (id: string) => {
      const image = scene.textures
        .get(`theme-furniture-${id}`)
        .getSourceImage();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let paleFoliage = 0;
      let opaque = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const [r, g, b, a] = data.slice(
            (y * canvas.width + x) * 4,
            (y * canvas.width + x) * 4 + 4,
          );
          if (a > 220) opaque++;
          if (
            y < 90 &&
            a > 220 &&
            Math.min(r, g, b) > 140 &&
            Math.max(r, g, b) - Math.min(r, g, b) < 60
          )
            paleFoliage++;
        }
      }
      return {
        paleFoliage,
        opaqueFraction: opaque / (canvas.width * canvas.height),
        lowerBowlGap: [
          [176, 195],
          [175, 198],
          [176, 201],
        ].map(([x, y]) =>
          y < canvas.height ? data[(y * canvas.width + x) * 4 + 3] : null,
        ),
      };
    };
    return { planter: inspect("planter"), rack: inspect("bowl-rack") };
  });
  expect(assets.planter.paleFoliage).toBe(0);
  expect(
    assets.rack.lowerBowlGap.every((alpha) => alpha !== null && alpha < 32),
  ).toBe(true);
  // The pottery and furniture remain painted; transparency is confined to gaps.
  expect(assets.planter.opaqueFraction).toBeGreaterThan(0.45);
  expect(assets.rack.opaqueFraction).toBeGreaterThan(0.6);
});

test("tower carved openings are transparent while pale crystal facets remain painted", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("little-house.theme.v1", "tower"),
  );
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  const assets = await page.evaluate(() => {
    const scene = (window as any).kitty.scene;
    const inspect = (id: string, points: [number, number][]) => {
      const image = scene.textures
        .get(`theme-furniture-${id}`)
        .getSourceImage();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return points.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]);
    };
    return {
      ropeOpening: inspect("tower-spiral-scratcher", [
        [38, 95],
        [40, 100],
        [43, 108],
      ]),
      carvedOpenings: inspect("tower-observatory-perch", [
        [29, 26],
        [54, 27],
        [50, 35],
        [179, 27],
        [184, 35],
        [204, 30],
      ]),
      ropeBody: inspect("tower-spiral-scratcher", [
        [77, 79],
        [50, 100],
      ]),
      perchBeam: inspect("tower-observatory-perch", [[116, 8]]),
      crystalFacet: inspect("tower-crystal-plinth", [[96, 49]]),
    };
  });
  expect(
    [...assets.ropeOpening, ...assets.carvedOpenings].every(
      (pixel) => pixel[3] < 32,
    ),
  ).toBe(true);
  expect(
    [...assets.ropeBody, ...assets.perchBeam, ...assets.crystalFacet].every(
      (pixel) => pixel[3] > 240,
    ),
  ).toBe(true);
  expect(Math.min(...assets.crystalFacet[0].slice(0, 3))).toBeGreaterThan(220);
});
