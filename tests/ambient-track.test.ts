import { describe, expect, it } from "vitest";
import {
  AMBIENT_LOOP_START,
  AMBIENT_TRACKS,
  renderAmbientLoop,
} from "../src/ambient-track";
import type { ThemeId } from "../src/house-theme";

const audio = {
  createBuffer(channels: number, length: number, sampleRate: number) {
    const samples = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      numberOfChannels: channels,
      length,
      duration: length / sampleRate,
      sampleRate,
      getChannelData: (channel: number) => samples[channel],
    } as AudioBuffer;
  },
};

describe("scene ambience", () => {
  for (const theme of Object.keys(AMBIENT_TRACKS) as ThemeId[]) {
    it(`${theme} has a bounded stereo loop with a continuous lead-in`, () => {
      const buffer = renderAmbientLoop(audio, theme);
      expect(buffer.numberOfChannels).toBe(2);
      expect(buffer.duration - AMBIENT_LOOP_START).toBe(44);
      const loopStart = AMBIENT_LOOP_START * buffer.sampleRate;
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      expect(left[loopStart]).not.toEqual(right[loopStart]);
      for (const samples of [left, right]) {
        let peak = 0;
        let power = 0;
        for (let i = loopStart; i < samples.length; i++) {
          peak = Math.max(peak, Math.abs(samples[i]));
          power += samples[i] * samples[i];
        }
        expect(peak).toBeLessThanOrEqual(0.651);
        expect(Math.sqrt(power / (samples.length - loopStart))).toBeGreaterThan(0.07);
        // The last faded sample is the sample immediately before the loop resumes.
        expect(samples.at(-1)).toBeCloseTo(samples[loopStart - 1], 6);
      }
    });
  }
});
