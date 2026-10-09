import type { CatProfile } from "./cat-model";
import type { Action } from "./model";

export type ActivityTraits = Pick<
  CatProfile,
  "curiosity" | "laziness" | "sociability"
> & { energy: number };

/** Transient motivations, deliberately kept out of saved cat profiles. */
export interface CatNeeds {
  stimulation: number;
  grooming: number;
  scratching: number;
}

const unit = (n: number) => Math.max(0, Math.min(1, n));

export function updateNeeds(
  cat: ActivityTraits & { needs: CatNeeds; state: string },
  dt: number,
) {
  const { state, needs } = cat;
  const sleeping = state === "sleep";
  const moving = ["walk", "jump", "drop", "cross", "climb"].includes(state);
  const energyRate = sleeping
    ? 0.0038
    : state === "play"
      ? -0.0048
      : moving
        ? -0.0023
        : state === "scratch"
          ? -0.0015
          : -0.00045;
  cat.energy = unit(cat.energy + energyRate * dt);
  needs.stimulation = unit(
    needs.stimulation +
      dt *
        (state === "play"
          ? -0.035
          : state === "perch"
            ? -0.005
            : moving
              ? -0.003
              : sleeping
                ? 0
                : 0.0014 + cat.curiosity * 0.0018),
  );
  needs.grooming = unit(
    needs.grooming +
      dt *
        (state === "groom"
          ? -0.022
          : sleeping
            ? 0.00025
            : moving || state === "play"
              ? 0.002
              : 0.0009),
  );
  needs.scratching = unit(
    needs.scratching +
      dt * (state === "scratch" ? -0.085 : sleeping ? 0.00035 : 0.0012),
  );
}

/** Select an intention before a destination: extra floor slots must not drown out furniture. */
export function actionWeights(
  cat: ActivityTraits & { needs: CatNeeds },
): Record<Action, number> {
  const tired = 1 - cat.energy;
  const { stimulation, grooming, scratching } = cat.needs;
  return {
    idle: 0.12,
    sleep: (0.05 + Math.pow(tired, 3) * 15) * (0.7 + cat.laziness * 0.6),
    sit: 0.5 + cat.laziness * 0.9 + tired * 0.6,
    perch: 0.35 + cat.curiosity * 0.9 + stimulation * 0.5,
    groom: 0.12 + grooming * grooming * 6,
    scratch: 0.08 + scratching * scratching * 5,
    play:
      (0.12 + stimulation * stimulation * 8) *
      cat.energy *
      cat.energy *
      (1 - cat.laziness * 0.6),
    hide: 0.08 + (1 - cat.sociability) * 0.5 + tired * 0.15,
  };
}

export function weightedChoice<T>(
  choices: readonly { value: T; weight: number }[],
  random: () => number,
): T | undefined {
  const total = choices.reduce(
    (sum, item) => sum + Math.max(0, item.weight),
    0,
  );
  if (!choices.length || total <= 0) return undefined;
  let roll = random() * total;
  for (const item of choices) {
    roll -= Math.max(0, item.weight);
    if (roll < 0) return item.value;
  }
  return choices.at(-1)!.value;
}

/** Sample seconds using normalized traits and a seeded random value in [0, 1). */
export function sampleActionDuration(
  action: Action,
  traits: ActivityTraits,
  random: () => number,
): number {
  const { energy, curiosity, laziness, sociability } = traits;
  const tired = 1 - energy;
  const usual: Record<Action, number> = {
    idle: 2.5 + 2 * laziness + tired,
    sleep: 60 + 75 * laziness + 35 * tired,
    sit: 22 + 25 * laziness + 10 * tired - 6 * curiosity,
    perch: 25 + 28 * curiosity + 10 * laziness + 6 * tired,
    groom: 24 + 14 * laziness + 10 * tired - 4 * curiosity,
    hide: 22 + 18 * laziness + 14 * (1 - sociability) + 8 * tired,
    play: 9 + 12 * energy + 8 * curiosity - 4 * laziness,
    scratch: 5 + 4 * energy + 2 * curiosity,
  };

  // A triangular distribution peaks at the usual duration, with a longer,
  // less common tail. Resting can run longer than active play or scratching.
  const low = action === "groom" ? 0.75 : 0.65;
  const high =
    action === "idle" || action === "scratch"
      ? 1.4
      : action === "groom" || action === "play"
        ? 1.5
        : 1.8;
  const sample = random();
  const peak = (1 - low) / (high - low);
  const factor =
    sample < peak
      ? low + Math.sqrt(sample * (high - low) * (1 - low))
      : high - Math.sqrt((1 - sample) * (high - low) * (high - 1));
  return usual[action] * factor;
}
