import type { ThemeId } from "./house-theme";
import {
  AMBIENT_LOOP_START,
  AMBIENT_TRACKS,
  renderAmbientLoop,
} from "./ambient-track";
import "./ambient-audio.css";

const VOLUME_KEY = "little-house.ambience-volume.v1";
const DEFAULT_VOLUME = 42;
const FADE_TIME = 0.15;

function readVolume() {
  try {
    const saved = localStorage.getItem(VOLUME_KEY);
    const volume = saved === null ? DEFAULT_VOLUME : Number(saved);
    if (Number.isFinite(volume)) return Math.max(0, Math.min(100, volume));
  } catch {
    // Playback still works when the browser blocks storage.
  }
  return DEFAULT_VOLUME;
}

export function mountAmbientAudio(parent: HTMLElement, theme: ThemeId) {
  const element = document.createElement("div");
  element.className = "ambient-audio";
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", "Ambience audio");
  element.innerHTML = `
    <button type="button" aria-label="Play ambience" title="Play ambience">▶</button>
    <span class="ambient-track"></span>
    <input type="range" min="0" max="100" aria-label="Ambience volume" title="Ambience volume">
    <span class="ambient-audio-status" role="status"></span>
  `;
  const toggle = element.querySelector("button")!;
  const title = element.querySelector(".ambient-track")!;
  const volume = element.querySelector("input")!;
  const status = element.querySelector(".ambient-audio-status")!;
  const trackName = AMBIENT_TRACKS[theme].name;
  title.textContent = trackName;
  volume.value = String(readVolume());
  parent.append(element);

  const events = new AbortController();
  const { signal } = events;
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let buffer: AudioBuffer | undefined;
  let playing: {
    source: AudioBufferSourceNode;
    gain: GainNode;
    started: number;
  } | undefined;
  let offset = AMBIENT_LOOP_START;
  let pending = false;
  let request = 0;

  function syncControls() {
    const label = playing ? "Pause ambience" : "Play ambience";
    toggle.textContent = playing ? "Ⅱ" : "▶";
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("aria-disabled", String(pending));
    toggle.title = label;
    element.classList.toggle("playing", Boolean(playing));
  }

  async function play() {
    const order = ++request;
    pending = true;
    status.textContent = "";
    title.textContent = trackName;
    syncControls();
    try {
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = volume.valueAsNumber / 100;
        master.connect(context.destination);
      }
      await context.resume();
      if (request !== order) return;
      buffer ??= renderAmbientLoop(context, theme);
      const now = context.currentTime;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = AMBIENT_LOOP_START;
      source.connect(gain);
      gain.connect(master!);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + FADE_TIME);
      source.start(now, offset);
      playing = { source, gain, started: now };
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (!playing && !pending && context?.state !== "closed")
          void context?.suspend().catch(() => {});
      };
    } catch {
      if (request !== order) return;
      title.textContent = "Sound unavailable";
      status.textContent = "Ambience audio could not play in this browser.";
      if (context?.state !== "closed")
        void context?.suspend().catch(() => {});
    } finally {
      if (request === order) {
        pending = false;
        syncControls();
      }
    }
  }

  function pause(immediate = false) {
    request++;
    pending = false;
    if (playing && context && buffer) {
      const { source, gain, started } = playing;
      const now = context.currentTime;
      const loopLength = buffer.duration - AMBIENT_LOOP_START;
      const elapsed = now - started;
      offset =
        AMBIENT_LOOP_START +
        (offset - AMBIENT_LOOP_START + elapsed) % loopLength;
      if (!immediate) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.min(1, elapsed / FADE_TIME), now);
        gain.gain.linearRampToValueAtTime(0, now + FADE_TIME);
      }
      source.stop(immediate ? now : now + FADE_TIME);
      playing = undefined;
    }
    syncControls();
  }

  function dispose() {
    if (signal.aborted) return;
    pause(true);
    events.abort();
    element.remove();
    if (context) void context.close().catch(() => {});
  }

  toggle.addEventListener("click", () => {
    if (playing) pause();
    else if (!pending) void play();
  }, { signal });
  volume.addEventListener("input", () => {
    if (context && master)
      master.gain.setTargetAtTime(volume.valueAsNumber / 100, context.currentTime, 0.035);
  }, { signal });
  volume.addEventListener("change", () => {
    try {
      localStorage.setItem(VOLUME_KEY, volume.value);
    } catch {
      // Keep the current volume for this visit.
    }
  }, { signal });
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) pause(true);
    else dispose();
  }, { signal });
  return { element, dispose };
}
