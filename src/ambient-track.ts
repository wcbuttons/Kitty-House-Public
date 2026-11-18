import type { ThemeId } from "./house-theme";

interface Track {
  name: string;
  bassHz: number;
  airHz: number;
  bass: number;
  air: number;
  gusts: number;
  accent: "drop" | "bird" | "cricket" | "bubble";
  spacing: number;
  accentGain: number;
}

export const AMBIENT_TRACKS: Record<ThemeId, Track> = {
  original: {
    name: "Rain on the window",
    bassHz: 270, airHz: 2800, bass: 0.82, air: 0.38, gusts: 0.2,
    accent: "drop", spacing: 0.6, accentGain: 0.09,
  },
  cabin: {
    name: "Pines and birds",
    bassHz: 200, airHz: 1300, bass: 1, air: 0.32, gusts: 0.64,
    accent: "bird", spacing: 5, accentGain: 0.095,
  },
  ramen: {
    name: "Rain on the awning",
    bassHz: 440, airHz: 3900, bass: 0.68, air: 0.53, gusts: 0.18,
    accent: "drop", spacing: 0.24, accentGain: 0.13,
  },
  tower: {
    name: "Night wind and crickets",
    bassHz: 120, airHz: 710, bass: 1, air: 0.24, gusts: 0.69,
    accent: "cricket", spacing: 2.7, accentGain: 0.055,
  },
  "cabin-v2": {
    name: "Woodland creek",
    bassHz: 360, airHz: 1850, bass: 1, air: 0.34, gusts: 0.25,
    accent: "bubble", spacing: 0.19, accentGain: 0.1,
  },
  "ramen-v2": {
    name: "Courtyard drizzle",
    bassHz: 190, airHz: 2250, bass: 0.63, air: 0.42, gusts: 0.34,
    accent: "drop", spacing: 0.42, accentGain: 0.055,
  },
};

const SAMPLE_RATE = 22050;
const LOOP_SECONDS = 44;
export const AMBIENT_LOOP_START = 1.5;
const TAU = Math.PI * 2;

function addAccent(
  left: Float32Array,
  right: Float32Array,
  at: number,
  level: number,
  pan: number,
  { seconds, frequency, sweep, attack, falloff }: {
    seconds: number;
    frequency: number;
    sweep: number;
    attack: number;
    falloff: number;
  },
) {
  const start = Math.floor(at * SAMPLE_RATE);
  const frames = Math.min(Math.floor(seconds * SAMPLE_RATE), left.length - start);
  const leftGain = level * Math.sqrt(1 - pan);
  const rightGain = level * Math.sqrt(pan);
  const attackFrames = attack * SAMPLE_RATE;
  let phase = 0;
  for (let i = 0; i < frames; i++) {
    const progress = i / frames;
    const envelope = Math.min(1, i / attackFrames) * (1 - progress) ** falloff;
    phase += (frequency + sweep * progress) * TAU / SAMPLE_RATE;
    const sample = (Math.sin(phase) + 0.13 * Math.sin(phase * 2)) * envelope;
    left[start + i] += sample * leftGain;
    right[start + i] += sample * rightGain;
  }
}

/** Synthesize stereo weather and occasional detail into one reusable, crossfaded loop. */
export function renderAmbientLoop(
  context: Pick<BaseAudioContext, "createBuffer">,
  theme: ThemeId,
): AudioBuffer {
  const track = AMBIENT_TRACKS[theme];
  const duration = LOOP_SECONDS + AMBIENT_LOOP_START;
  const frames = Math.floor(duration * SAMPLE_RATE);
  const buffer = context.createBuffer(2, frames, SAMPLE_RATE);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  let state = [...theme].reduce(
    (seed, char) => (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0,
    3191,
  );
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  // Shared noise keeps the bed centered, with quiet independent texture in each ear.
  const bassCutoff = 1 - Math.exp(-TAU * track.bassHz / SAMPLE_RATE);
  const airCutoff = 1 - Math.exp(-TAU * track.airHz / SAMPLE_RATE);
  const dcCutoff = 1 - Math.exp(-TAU * 35 / SAMPLE_RATE);
  let bassL = 0, bassR = 0, airL = 0, airR = 0, dcL = 0, dcR = 0;
  let wind = 1, windTarget = 1, nextGust = 0;
  for (let i = 0; i < frames; i++) {
    if (i === nextGust) {
      windTarget = 1 + track.gusts * (random() - 0.5);
      nextGust += Math.floor(SAMPLE_RATE * (0.9 + random() * 2.3));
    }
    wind += (windTarget - wind) * 0.00012;
    const center = random() - 0.5;
    const noiseL = center + (random() - 0.5) * 0.63;
    const noiseR = center + (random() - 0.5) * 0.63;
    bassL += (noiseL - bassL) * bassCutoff;
    bassR += (noiseR - bassR) * bassCutoff;
    airL += (noiseL - airL) * airCutoff;
    airR += (noiseR - airR) * airCutoff;
    dcL += (bassL - dcL) * dcCutoff;
    dcR += (bassR - dcR) * dcCutoff;
    left[i] = ((bassL - dcL) * track.bass + (airL - bassL) * track.air) * wind;
    right[i] = ((bassR - dcR) * track.bass + (airR - bassR) * track.air) * wind;
  }

  for (
    let at = random() * track.spacing;
    at < duration - 0.6;
    at += track.spacing * (0.5 + random())
  ) {
    const pan = 0.12 + random() * 0.76;
    const gain = track.accentGain * (0.38 + random() * 0.62);
    switch (track.accent) {
      case "drop":
        addAccent(left, right, at, gain, pan, {
          seconds: 0.057 + random() * 0.07,
          frequency: 350 + random() * 1000,
          sweep: 320,
          attack: 0.003,
          falloff: 6,
        });
        break;
      case "bubble":
        addAccent(left, right, at, gain, pan, {
          seconds: 0.06 + random() * 0.12,
          frequency: 180 + random() * 470,
          sweep: 125,
          attack: 0.009,
          falloff: 4,
        });
        break;
      case "bird": {
        const pitch = 1590 + random() * 600;
        const notes = 2 + Math.floor(random() * 3);
        for (let note = 0; note < notes; note++) {
          addAccent(left, right, at + note * 0.125, gain, pan, {
            seconds: 0.1,
            frequency: pitch + random() * 620,
            sweep: (random() - 0.35) * 1750,
            attack: 0.018,
            falloff: 2.5,
          });
        }
        break;
      }
      case "cricket": {
        const pitch = 2880 + random() * 490;
        for (let pulse = 0; pulse < 4; pulse++) {
          addAccent(left, right, at + pulse * 0.069, gain, pan, {
            seconds: 0.042,
            frequency: pitch,
            sweep: -70,
            attack: 0.009,
            falloff: 2,
          });
        }
        break;
      }
    }
  }

  // The tail blends into the lead-in. The next sample after the tail is immediately after that lead-in.
  const blend = Math.floor(AMBIENT_LOOP_START * SAMPLE_RATE);
  for (let i = 0; i < blend; i++) {
    const index = frames - blend + i;
    const angle = i / (blend - 1) * (Math.PI / 2);
    const fadeFrom = Math.cos(angle), fadeTo = Math.sin(angle);
    left[index] = left[index] * fadeFrom + left[i] * fadeTo;
    right[index] = right[index] * fadeFrom + right[i] * fadeTo;
  }

  // Keep perceived level comparable across tracks while preserving crest headroom.
  let power = 0, peak = 0;
  for (let i = blend; i < frames; i++) {
    power += left[i] * left[i] + right[i] * right[i];
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const rms = Math.sqrt(power / (2 * (frames - blend)));
  const gain = Math.min(0.105 / rms, 0.65 / peak);
  for (let i = 0; i < frames; i++) {
    left[i] *= gain;
    right[i] *= gain;
  }
  return buffer;
}
