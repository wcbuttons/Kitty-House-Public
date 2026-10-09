import { describe, expect, it } from "vitest";
import { actionWeights, updateNeeds } from "../src/behavior";
import { defaultLayout, type Action } from "../src/model";
import { Simulation } from "../src/simulation";

function cat() {
  return {
    energy: 0.6,
    curiosity: 0.5,
    laziness: 0.5,
    sociability: 0.5,
    state: "sit",
    needs: { stimulation: 0.6, grooming: 0.6, scratching: 0.6 },
  };
}

describe("needs and intentions", () => {
  it("strongly favors rest when tired and play when energetic and understimulated", () => {
    const tired = actionWeights({ ...cat(), energy: 0.05 });
    const active = actionWeights({
      ...cat(),
      energy: 0.95,
      needs: { stimulation: 1, grooming: 0, scratching: 0 },
    });
    expect(tired.sleep).toBeGreaterThan(tired.play * 100);
    expect(active.play).toBeGreaterThan(active.sleep * 20);
    expect(
      actionWeights({
        ...cat(),
        needs: { stimulation: 0, grooming: 1, scratching: 0 },
      }).groom,
    ).toBeGreaterThan(5);
    expect(
      actionWeights({
        ...cat(),
        needs: { stimulation: 0, grooming: 0, scratching: 1 },
      }).scratch,
    ).toBeGreaterThan(5);
  });

  it("activities satisfy their own needs and strenuous activity costs more than watching", () => {
    const playing = { ...cat(), state: "play" };
    const watching = { ...cat(), state: "perch" };
    const grooming = { ...cat(), state: "groom" };
    const scratching = { ...cat(), state: "scratch" };
    const sleeping = { ...cat(), state: "sleep" };
    for (let second = 0; second < 30; second++) {
      for (const individual of [
        playing,
        watching,
        grooming,
        scratching,
        sleeping,
      ])
        updateNeeds(individual, 1);
    }
    expect(playing.needs.stimulation).toBe(0);
    expect(grooming.needs.grooming).toBe(0);
    expect(scratching.needs.scratching).toBe(0);
    expect(watching.needs.stimulation).toBeLessThan(0.6);
    expect(playing.energy).toBeLessThan(watching.energy - 0.1);
    expect(sleeping.energy).toBeGreaterThan(0.7);
    expect(sleeping.energy).toBeLessThan(0.8);
  });

  it("keeps needs bounded over prolonged activity and pause freezes the complete simulation", () => {
    const sim = new Simulation(defaultLayout(), 1);
    const individual = sim.cats[0];
    for (const state of ["sleep", "play", "groom", "scratch"]) {
      individual.state = state as Action;
      for (let second = 0; second < 3600; second++) updateNeeds(individual, 1);
      for (const value of [
        individual.energy,
        ...Object.values(individual.needs),
      ]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    sim.paused = true;
    const before = structuredClone(sim.snapshot());
    for (let frame = 0; frame < 60; frame++) sim.step(1 / 60);
    expect(sim.snapshot()).toEqual(before);
  });

  it("chooses intentions independently of how many floor slots exist", () => {
    const sim = new Simulation(defaultLayout(), 1, 412);
    const individual = sim.cats[0];
    Object.assign(individual, {
      energy: 0.1,
      laziness: 1,
      socialCooldown: Infinity,
    });
    individual.needs = { stimulation: 0, grooming: 0, scratching: 0 };
    const chosen: Record<string, number> = {};
    for (let sample = 0; sample < 400; sample++) {
      individual.goal = null;
      individual.state = "idle";
      sim.choose(individual);
      const action = individual.goal?.action ?? "none";
      chosen[action] = (chosen[action] ?? 0) + 1;
    }
    expect(chosen.sleep).toBeGreaterThan(270);
    expect(chosen.play ?? 0).toBeLessThan(5);
  });

  it("allows a cat to nap safely even after all furniture is removed", () => {
    const sim = new Simulation({ version: 1, furniture: [] }, 1, 42);
    const individual = sim.cats[0];
    Object.assign(individual, {
      energy: 0,
      laziness: 1,
      socialCooldown: Infinity,
    });
    individual.needs = { stimulation: 0, grooming: 0, scratching: 0 };
    for (
      let attempt = 0;
      attempt < 10 && individual.goal?.action !== "sleep";
      attempt++
    )
      sim.choose(individual);
    expect(individual.goal?.action).toBe("sleep");
    for (let frame = 0; frame < 600 && individual.state !== "sleep"; frame++)
      sim.step(0.05);
    expect(individual.state).toBe("sleep");
    expect(individual.y).toBe(0);
    expect(sim.recoveries).toBe(0);
  });
});
