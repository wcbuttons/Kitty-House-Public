import { describe, expect, it } from "vitest";
import { sampleActionDuration, type ActivityTraits } from "../src/behavior";
import type { Action } from "../src/model";

const averageCat: ActivityTraits = {
  energy: 0.5,
  curiosity: 0.5,
  laziness: 0.5,
  sociability: 0.5,
};

function seededRandom(seed = 47) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function sample(action: Action, traits: Partial<ActivityTraits> = {}) {
  const random = seededRandom();
  return Array.from({ length: 4000 }, () =>
    sampleActionDuration(action, { ...averageCat, ...traits }, random),
  );
}

function mean(action: Action, traits: Partial<ActivityTraits> = {}) {
  const durations = sample(action, traits);
  return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
}

describe("cat activity durations", () => {
  it("keeps every activity bounded, including cats with extreme traits", () => {
    const bounds: Record<Action, [number, number]> = {
      idle: [1.625, 7.7],
      sleep: [39, 306],
      sit: [10.4, 102.6],
      perch: [16.25, 124.2],
      groom: [15, 72],
      hide: [14.3, 111.6],
      play: [3.25, 43.5],
      scratch: [3.25, 15.4],
    };
    for (let mask = 0; mask < 16; mask++) {
      const traits: ActivityTraits = {
        energy: mask & 1 ? 1 : 0,
        curiosity: mask & 2 ? 1 : 0,
        laziness: mask & 4 ? 1 : 0,
        sociability: mask & 8 ? 1 : 0,
      };
      for (const action of Object.keys(bounds) as Action[]) {
        for (const quantile of [0, 0.1, 0.35, 0.5, 0.9, 1]) {
          const duration = sampleActionDuration(action, traits, () => quantile);
          expect(duration, action).toBeGreaterThanOrEqual(
            bounds[action][0] - 1e-9,
          );
          expect(duration, action).toBeLessThanOrEqual(bounds[action][1] + 1e-9);
        }
      }
    }
  });

  it("reproduces a seeded sequence while varying each individual session", () => {
    const first = sample("sleep");
    expect(first).toEqual(sample("sleep"));
    expect(new Set(first).size).toBe(first.length);
    expect(Math.max(...first) - Math.min(...first)).toBeGreaterThan(90);
  });

  it("usually takes a moderate nap with occasional longer rests", () => {
    const durations = sample("sleep");
    const typical = durations.filter(
      (duration) => duration >= 86 && duration <= 173,
    );
    const long = durations.filter((duration) => duration > 173);
    expect(typical.length / durations.length).toBeGreaterThan(0.8);
    expect(long.length / durations.length).toBeGreaterThan(0.04);
    expect(long.length / durations.length).toBeLessThan(0.15);
    expect(mean("sleep")).toBeGreaterThan(100);
    expect(mean("sleep")).toBeLessThan(150);
  });

  it("gives nap-loving and tired cats substantially longer naps", () => {
    expect(mean("sleep", { laziness: 1 })).toBeGreaterThan(
      mean("sleep", { laziness: 0 }) * 1.8,
    );
    expect(mean("sleep", { energy: 0 })).toBeGreaterThan(
      mean("sleep", { energy: 1 }) * 1.3,
    );
  });

  it("lets cats sit, watch and groom for tens of seconds", () => {
    for (const action of ["sit", "perch", "groom"] as const) {
      expect(mean(action), action).toBeGreaterThan(30);
      expect(mean(action), action).toBeLessThan(65);
    }
    for (const action of ["sit", "groom"] as const) {
      expect(mean(action, { laziness: 1 }), action).toBeGreaterThan(
        mean(action, { laziness: 0 }) * 1.4,
      );
      expect(mean(action, { energy: 0 }), action).toBeGreaterThan(
        mean(action, { energy: 1 }) * 1.2,
      );
    }
    expect(mean("sit", { curiosity: 1 })).toBeLessThan(
      mean("sit", { curiosity: 0 }),
    );
  });

  it("weights watching, hiding and active sessions by relevant traits", () => {
    expect(mean("perch", { curiosity: 1 })).toBeGreaterThan(
      mean("perch", { curiosity: 0 }) * 1.7,
    );
    expect(mean("hide", { sociability: 0 })).toBeGreaterThan(
      mean("hide", { sociability: 1 }) * 1.3,
    );
    for (const action of ["play", "scratch"] as const) {
      expect(mean(action, { energy: 1 }), action).toBeGreaterThan(
        mean(action, { energy: 0 }) * 1.5,
      );
      expect(mean(action, { curiosity: 1 }), action).toBeGreaterThan(
        mean(action, { curiosity: 0 }),
      );
    }
    expect(mean("play", { laziness: 1 })).toBeLessThan(
      mean("play", { laziness: 0 }),
    );
    expect(mean("idle")).toBeLessThan(6);
    expect(mean("scratch")).toBeLessThan(12);
  });
});
