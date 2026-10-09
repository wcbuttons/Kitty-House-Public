import { CELL } from "./model";
import type { Cat } from "./simulation";

// All animation phases follow simulation time, including when the house is paused.
export const CAT_ANIMATIONS: Record<string, [string, number, number]> = {
  idle: ["Idle", 10, 6],
  walk: ["Walk", 8, 9],
  cross: ["Walk", 8, 9],
  climb: ["Walk", 8, 9],
  wait: ["Idle", 10, 5],
  sleep: ["Sleeping1", 1, 1],
  sit: ["Sitting", 1, 1],
  groom: ["Licking 1", 5, 6],
  wash: ["Licking 2", 5, 6],
  scratch: ["Stretching", 13, 6],
  perch: ["Sitting", 1, 1],
  hide: ["Sleeping2", 1, 1],
  play: ["Stretching", 13, 6],
  greet: ["Meow", 4, 5],
  jump: ["Run", 8, 9],
  drop: ["Run", 8, 9],
  recover: ["Run", 8, 9],
  anticipate: ["Laying", 8, 6],
};

export function catPose(cat: Cat, elapsed: number) {
  const seedPhase = (cat.personalitySeed % 97) / 17;
  const age = cat.actionElapsed;
  let animation: string = cat.state;
  let clock = elapsed + seedPhase;
  let frame: number | undefined;
  let x = 0;
  let y = cat.passing * 5;
  let angle = 0;
  let facing = cat.facing;
  let scaleX = 1.6;
  let scaleY = 1.6;
  let depth = 20 + cat.passing;
  const interaction = cat.goal?.interaction;

  if (cat.social?.phase === "settled" && cat.social.kind === "greet") {
    // One small greeting, followed by a quiet face-to-face pause.
    animation = age < 0.8 ? "greet" : "idle";
    clock = age;
  } else if (cat.state === "groom") {
    const cycle = 8 + seedPhase * 0.4;
    const bout = Math.floor(age / cycle);
    const phase = age % cycle;
    animation = phase < cycle - 2.2 ? (bout % 2 ? "wash" : "groom") : "sit";
    clock = phase;
  } else if (cat.state === "scratch" && interaction?.kind === "scratch") {
    const phase = age % 2.8;
    const reaching = phase < 1.9;
    facing = interaction.facing;
    animation = reaching ? "scratch" : "idle";
    if (reaching) {
      frame = 3 + (Math.floor(phase * 7) % 2);
      x = facing * (6 + Math.sin(phase * 21) * 1.2);
      y -= 1 + Math.abs(Math.sin(phase * 21));
      angle = -facing * 7;
    }
  } else if (cat.state === "play") {
    const phase = age % (6.5 + seedPhase * 0.25);
    // Watch, crouch, make a tiny pounce, then settle before the next bout.
    animation = "idle";
    if (phase > 1.4 && phase < 2) {
      scaleY -= 0.13;
      scaleX += 0.04;
    } else if (phase >= 2 && phase < 2.65) {
      const leap = Math.sin(((phase - 2) / 0.65) * Math.PI);
      animation = "jump";
      x = cat.facing * leap * 3;
      y -= leap * 3;
    } else if (phase >= 2.65 && phase < 3.5) {
      animation = "play";
      frame = 3 + (Math.floor((phase - 2.65) * 5) % 3);
    }
  } else if (cat.state === "hide" && interaction?.kind === "hide") {
    const tucked = Math.max(0, Math.min(1, age / 0.8, cat.timer / 0.9));
    const eased = tucked * tucked * (3 - 2 * tucked);
    x = (interaction.targetX - cat.x) * CELL * eased;
    y += (cat.y - interaction.targetY) * CELL * eased;
    animation = tucked < 1 ? "walk" : "hide";
    facing = cat.timer < 0.9 ? -interaction.facing : interaction.facing;
    depth = 9;
  } else if (cat.state === "sleep") {
    const breath = Math.sin(elapsed * 1.4 + seedPhase) * 0.018;
    scaleX += breath;
    scaleY -= breath;
  } else if (cat.state === "perch" && !cat.social) {
    if ((age + seedPhase) % 17 > 14.5) facing = -facing;
  }
  if (cat.state === "anticipate") {
    scaleX += 0.064;
    scaleY -= 0.16;
  } else if (cat.state === "walk" && cat.timer > 0) {
    const compression = Math.min(0.13, cat.timer);
    scaleX += compression * 0.4;
    scaleY -= compression;
  }
  const [, count, rate] = CAT_ANIMATIONS[animation];
  const speed = ["walk", "cross", "climb"].includes(animation)
    ? cat.speed / 1.9
    : 1;
  frame ??= Math.floor(clock * rate * speed) % count;
  return { animation, frame, x, y, angle, facing, scaleX, scaleY, depth };
}
