import type { ThemeId } from "./house-theme";
import { AMBIENT_TRACKS, ambientTrackPath, isAmbientTrackId } from "./ambient-track";
import "./ambient-audio.css";

const VOLUME_KEY = "little-house.ambience-volume.v1";
const TRACK_KEY_PREFIX = "little-house.ambience-track.v1:";
const DEFAULT_VOLUME = 42;
const MAX_OUTPUT_GAIN = 0.5;
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
    <select class="ambient-track" aria-label="Ambience sound"></select>
    <input type="range" min="0" max="100" aria-label="Ambience volume" title="Ambience volume">
    <span class="ambient-audio-status" role="status"></span>
  `;
  const toggle = element.querySelector("button")!;
  const picker = element.querySelector("select")!;
  const volume = element.querySelector("input")!;
  const status = element.querySelector(".ambient-audio-status")!;
  const trackKey = TRACK_KEY_PREFIX + theme;
  let track = theme;
  try {
    const saved = localStorage.getItem(trackKey);
    if (isAmbientTrackId(saved)) track = saved;
  } catch {
    // Use the house default when the browser blocks storage.
  }
  for (const [id, name] of Object.entries(AMBIENT_TRACKS))
    picker.add(new Option(name, id));
  picker.value = track;
  volume.value = String(readVolume());
  const outputGain = () => (volume.valueAsNumber / 100) * MAX_OUTPUT_GAIN;
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
  let offset = 0;
  let pending = false;
  let request = 0;
  let download: AbortController | undefined;

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
    status.textContent = buffer ? "" : "Loading recording…";
    syncControls();
    try {
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = outputGain();
        master.connect(context.destination);
      }
      await context.resume();
      if (request !== order) return;
      if (!buffer) {
        download = new AbortController();
        const trackUrl = import.meta.env.BASE_URL + ambientTrackPath(track);
        const response = await fetch(trackUrl, { signal: download.signal, cache: "no-cache" });
        if (!response.ok) throw new Error(`Recording unavailable: ${response.status}`);
        const recording = await context.decodeAudioData(await response.arrayBuffer());
        if (request !== order) return;
        buffer = recording;
      }
      status.textContent = "";
      const now = context.currentTime;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
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
      status.textContent = "Sound unavailable. Press Play to retry.";
      if (context?.state !== "closed")
        void context?.suspend().catch(() => {});
    } finally {
      if (request === order) {
        download = undefined;
        pending = false;
        syncControls();
      }
    }
  }

  function pause(immediate = false) {
    request++;
    download?.abort();
    download = undefined;
    pending = false;
    status.textContent = "";
    if (playing && context && buffer) {
      const { source, gain, started } = playing;
      const now = context.currentTime;
      const elapsed = now - started;
      offset = (offset + elapsed) % buffer.duration;
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
  picker.addEventListener("change", () => {
    const selection = picker.value;
    if (!isAmbientTrackId(selection) || selection === track) return;
    const keepPlaying = pending || !!playing;
    pause();
    track = selection;
    buffer = undefined;
    offset = 0;
    try {
      localStorage.setItem(trackKey, selection);
    } catch {
      // Keep the selection for this visit.
    }
    if (keepPlaying) void play();
  }, { signal });
  volume.addEventListener("input", () => {
    if (context && master)
      master.gain.setTargetAtTime(outputGain(), context.currentTime, 0.035);
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
