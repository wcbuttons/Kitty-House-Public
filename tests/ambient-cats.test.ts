import { describe, expect, it } from "vitest";
import { CAT_ANIMATIONS, catPose } from "../src/cat-presentation";
import { defaultLayout } from "../src/model";
import { Random, Simulation } from "../src/simulation";

describe("ambient cat routines", () => {
  it("investigates a new spot before playing without leaving its reserved position", () => {
    const sim = new Simulation({ version: 1, furniture: [] }, 1);
    const [cat] = sim.cats;
    const goal = sim.graph.goals.find(
      (candidate) => candidate.surfaceId === cat.surfaceId && candidate.action === "play",
    )!;
    cat.x = goal.x;
    cat.curiosity = 1;
    expect(sim.requestGoal(cat, goal, true)).toBe(true);
    sim.step(0.05);
    expect(cat.state).toBe("sniff");
    expect(cat.actions.sniff).toBe(1);
    expect(cat.goal).toBe(goal);
    for (let i = 0; i < 70 && cat.state === "sniff"; i++) sim.step(0.05);
    expect(cat.state).toBe("play");
    expect(cat.actions.play).toBe(1);
    expect(cat.x).toBe(goal.x);
    expect(cat.visited).toContain(goal.surfaceId);
  });

  it("stretches on its sleeping spot before resuming its wake-up routine", () => {
    const sim = new Simulation(defaultLayout(), 1);
    const [cat] = sim.cats;
    const goal = sim.graph.goals.find((candidate) => candidate.action === "sleep")!;
    const surface = sim.surface(goal.surfaceId)!;
    Object.assign(cat, {
      roomId: surface.roomId,
      surfaceId: surface.id,
      x: goal.x,
      y: surface.y,
    });
    expect(sim.requestGoal(cat, goal, true)).toBe(true);
    sim.step(0.05);
    expect(cat.state).toBe("sleep");
    cat.timer = 0.04;
    sim.step(0.05);
    expect(cat.state).toBe("stretch");
    expect(cat.goal).toBe(goal);
    expect(cat.actions.stretch).toBe(1);
    for (let i = 0; i < 70 && cat.state === "stretch"; i++) sim.step(0.05);
    expect(cat.state).not.toBe("stretch");
    expect(cat.lastAction).toBe("sleep");
  });

  it("keeps animation frames valid across play styles and signed personality seeds", () => {
    const sim = new Simulation(defaultLayout(), 1);
    const [cat] = sim.cats;
    cat.personalitySeed = -1;
    expect(catPose(cat, 0).frame).toBeGreaterThanOrEqual(0);
    cat.state = "play";
    const poses = new Set<string>();
    for (let frame = 0; frame < 600; frame++) {
      cat.actionElapsed = frame / 20;
      const pose = catPose(cat, cat.actionElapsed);
      expect(pose.frame).toBeGreaterThanOrEqual(0);
      expect(pose.frame).toBeLessThan(CAT_ANIMATIONS[pose.animation][1]);
      poses.add(pose.animation);
    }
    expect(poses).toEqual(new Set(["idle", "jump", "play"]));
    expect(new Random(-1).next()).toBe(new Random(0xffffffff).next());
  });
});
