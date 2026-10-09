import { expect, test } from "@playwright/test";

test("a cat visibly climbs between floors, explores the attic, and saves its original home", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  const profile = await page.evaluate(() => {
    const sim = (window as any).kitty.simulation;
    sim.paused = true;
    sim.replaceRoster(sim.roster().slice(0, 1));
    const cat = sim.cats[0];
    const edge = sim.graph.edges.find(
      (e: any) =>
        e.passage?.id === "lower-ladder" && e.passage.fromRoomId === "lounge",
    );
    Object.assign(cat, {
      surfaceId: edge.from,
      x: edge.sx,
      y: 0,
      state: "idle",
      move: null,
      path: [],
      goal: null,
    });
    const goal = sim.graph.goals.find(
      (g: any) =>
        sim.surface(g.surfaceId)?.roomId === "attic" && g.action === "sit",
    );
    if (!sim.requestGoal(cat, goal)) throw new Error("No route to attic");
    return sim.roster()[0];
  });
  await page
    .getByRole("button", { name: "Fullscreen house", exact: true })
    .click();
  await page.evaluate(() => {
    (window as any).kitty.simulation.paused = false;
  });
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (window as any).kitty.snapshot())).cats[0]
          .state,
    )
    .toBe("climb");
  await expect(page.locator(".house-stage")).not.toHaveClass(
    /controls-visible/,
  );
  await expect(page.locator(".fullscreen-controls")).toHaveCSS("opacity", "0");
  await page.screenshot({ path: "docs/screenshots/connected-rooms.png" });
  const visitor = await page.evaluate(() => {
    const sim = (window as any).kitty.simulation;
    const cat = sim.cats[0];
    for (
      let frame = 0;
      frame < 7200 && !(cat.roomId === "attic" && cat.state === "sit");
      frame++
    )
      sim.step(1 / 60);
    sim.paused = true;
    return {
      id: cat.id,
      roomId: cat.roomId,
      homeRoomId: cat.homeRoomId,
      visitedRooms: cat.visitedRooms,
    };
  });
  expect(visitor.roomId).toBe("attic");
  expect(visitor.homeRoomId).toBe("lounge");
  expect(visitor.visitedRooms).toEqual(
    expect.arrayContaining(["lounge", "library", "playroom", "attic"]),
  );
  await page.mouse.move(20, 20);
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit house" }).click();
  await page.getByRole("tab", { name: "Cats", exact: true }).click();
  await page
    .getByRole("button", { name: "Add Classic Tuxedo cat", exact: true })
    .click();
  expect(
    await page.evaluate(() => (window as any).kitty.snapshot().cats[0].roomId),
  ).toBe("attic");
  await page.getByRole("tab", { name: /At home/ }).click();
  await expect(page.getByLabel(`Home room for ${profile.name}`)).toHaveValue(
    "lounge",
  );
  await page
    .getByRole("button", { name: `Meet ${profile.name}`, exact: true })
    .click();
  await expect(page.locator("#cat-activity")).toContainText("The little attic");
  await expect(page.locator("#cat-activity")).toContainText(
    "Home: the living room",
  );
  await page.reload();
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  expect(
    (await page.evaluate(() => (window as any).kitty.roster()))[0],
  ).toEqual(profile);
  expect(
    await page.evaluate(
      () => (window as any).kitty.snapshot().cats[0].homeRoomId,
    ),
  ).toBe("lounge");
  expect(errors).toEqual([]);
});

test("assigning a visitor's current room as its new home updates saved cat settings", async ({
  page,
}) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  const profile = await page.evaluate(() => {
    const sim = (window as any).kitty.simulation;
    sim.paused = true;
    sim.relocate(sim.cats[0], "attic");
    return sim.roster()[0];
  });
  await page.getByRole("button", { name: "Edit house" }).click();
  await page.getByRole("tab", { name: "Cats", exact: true }).click();
  await page.getByRole("tab", { name: /At home/ }).click();
  await page.getByLabel(`Home room for ${profile.name}`).selectOption("attic");
  expect(
    (await page.evaluate(() => (window as any).kitty.roster()))[0].roomId,
  ).toBe("attic");
  await page.reload();
  await page.waitForFunction(() => !!(window as any).kitty?.ready());
  expect(
    (await page.evaluate(() => (window as any).kitty.roster()))[0].roomId,
  ).toBe("attic");
});
