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
  sniff: ["Idle", 10, 5],
  stretch: ["Stretching", 13, 6],
};

export function catPose(cat: Cat, elapsed: number) {
  // Imported rosters may contain negative personality seeds.
  const seed = ((cat.personalitySeed % 97) + 97) % 97;
  const seedPhase = seed / 17;
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
  } else if (cat.state === "sniff") {
    const dip = Math.abs(Math.sin(age * 4.5));
    clock = age;
    x = facing * (1 + dip);
    y += dip * 1.8;
    angle = facing * dip * 6;
  } else if (cat.state === "stretch") {
    const count = CAT_ANIMATIONS.stretch[1];
    const progress = age / Math.max(0.01, age + cat.timer);
    frame = Math.min(count - 1, Math.floor(progress * count));
    const reach = Math.sin(progress * Math.PI);
    scaleX += reach * 0.10;
    scaleY -= reach * 0.16;
  } else if (cat.state === "play") {
    const period = 6.5 + seedPhase * 0.25;
    const phase = age % period;
    const style = (seed + (cat.actions.play ?? 0) + Math.floor(age / period)) % 3;
    // Cats alternate between a pounce, a quick pawing bout, and a stalk.
    // These small poses stay inside the slot reserved by the simulation.
    animation = "idle";
    const starts = style === 2 ? 2.8 : 2;
    const leapEnds = starts + (style === 1 ? 0 : 0.65);
    if (phase > 1.3 && phase < starts) {
      const crouch = Math.sin(((phase - 1.3) / (starts - 1.3)) * Math.PI / 2);
      scaleY -= 0.15 * crouch;
      scaleX += 0.06 * crouch;
      x = crouch * facing * (style === 2 ? 3 : 1);
    } else if (phase >= starts && phase < leapEnds) {
      const leap = Math.sin(((phase - starts) / (leapEnds - starts)) * Math.PI);
      animation = "jump";
      x = facing * leap * (style === 2 ? 4.5 : 3);
      y -= leap * (style === 2 ? 2.5 : 4.5);
    } else if (phase >= leapEnds && phase < leapEnds + 0.9) {
      const paw = phase - leapEnds;
      animation = "play";
      frame = 3 + (Math.floor(paw * (style === 1 ? 9 : 5)) % 3);
      x = facing * Math.sin(paw * Math.PI / 0.9) * (style === 1 ? 3 : 1);
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
  if ((cat.state === "jump" || cat.state === "drop") && cat.move) {
    const progress = Math.max(0, Math.min(1, cat.progress));
    const extension = Math.sin(progress * Math.PI);
    angle = facing * (progress - 0.5) * 13;
    scaleX += extension * 0.09;
    scaleY -= extension * 0.045;
    frame = 1 + Math.round(progress * 5);
  } else if (cat.state === "anticipate") {
    const crouch = 1 - Math.max(0, Math.min(1, cat.timer / 0.18));
    scaleX += 0.064 * crouch;
    scaleY -= 0.16 * crouch;
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
