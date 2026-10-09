export const CENTRAL_TIME_ZONE = "America/Chicago";
export const DAYLIGHT_STORAGE_KEY = "little-house.daylight.v1";

export type DaylightMode = "live" | "manual";
export type DaylightPhase =
  "night" | "dawn" | "morning" | "afternoon" | "sunset";
export interface DaylightSettings {
  version: 1;
  mode: DaylightMode;
  manualHour: number;
}

/** Artistic lighting values, not a geographic sunrise or lunar calculation. */
export interface DaylightLighting {
  hour: number;
  phase: DaylightPhase;
  label: string;
  daylight: number;
  night: number;
  dawn: number;
  sunset: number;
  warmth: number;
  /** Left-to-right arc progress, returning out of view during the opposite half-day. */
  sunProgress: number;
  moonProgress: number;
  moon: number;
  lanternIntensity: number;
  weights: { night: number; dawn: number; day: number; sunset: number };
}

export interface DaylightState extends DaylightLighting {
  mode: DaylightMode;
  timeLabel: string;
  zoneLabel: string;
}

type ClockStorage = Pick<Storage, "getItem" | "setItem">;
type EventSource = Pick<
  EventTarget,
  "addEventListener" | "removeEventListener"
>;
type VisibilitySource = EventSource & { readonly visibilityState: string };
export interface DaylightClockOptions {
  storage?: ClockStorage | null;
  now?: () => number;
  document?: VisibilitySource | null;
  window?: EventSource | null;
}

const DEFAULT_SETTINGS: Readonly<DaylightSettings> = {
  version: 1,
  mode: "live",
  manualHour: 12,
};
const labels: Record<DaylightPhase, string> = {
  night: "Night",
  dawn: "Dawn",
  morning: "Morning",
  afternoon: "Afternoon",
  sunset: "Sunset",
};
const unit = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (start: number, end: number, value: number) => {
  const t = unit((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

export function wrapHour(hour: number): number {
  if (!Number.isFinite(hour)) throw new RangeError("Use a finite hour.");
  return ((hour % 24) + 24) % 24;
}

/** Fixed daily art direction: dawn from 05:30, full day 09–16, night after 21:30. */
export function daylightAt(inputHour: number): DaylightLighting {
  const hour = wrapHour(inputHour);
  const weights = { night: 0, dawn: 0, day: 0, sunset: 0 };
  const frames: [number, keyof typeof weights][] = [
    [0, "night"],
    [5.5, "night"],
    [6.5, "dawn"],
    [9, "day"],
    [16, "day"],
    [18.5, "sunset"],
    [21.5, "night"],
    [24, "night"],
  ];
  const index = frames.findIndex(([end], index) => index > 0 && hour < end);
  const [start, from] = frames[index - 1];
  const [end, to] = frames[index];
  const blend = smooth(start, end, hour);
  weights[from] += 1 - blend;
  weights[to] += blend;
  const daylight = weights.day + weights.dawn * 0.45 + weights.sunset * 0.38;
  const night = 1 - daylight;
  const phase: DaylightPhase =
    hour < 5.5 || hour >= 20.5
      ? "night"
      : hour < 8.5
        ? "dawn"
        : hour < 12
          ? "morning"
          : hour < 17
            ? "afternoon"
            : "sunset";
  // A periodic path avoids a position discontinuity when the live clock crosses midnight.
  // The sun crosses left→right from 06:00–18:00; the moon does so from 18:00–06:00.
  const sunProgress = (1 + Math.sin(((hour - 12) / 24) * Math.PI * 2)) / 2;
  return {
    hour,
    phase,
    label: labels[phase],
    daylight,
    night,
    dawn: weights.dawn,
    sunset: weights.sunset,
    warmth: weights.dawn * 0.65 + weights.sunset * 0.95,
    sunProgress,
    moonProgress: 1 - sunProgress,
    moon: weights.night,
    lanternIntensity: smooth(0.1, 0.85, night),
    weights,
  };
}

const centralFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRAL_TIME_ZONE,
  numberingSystem: "latn",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});

export function centralTime(instant: number | Date): {
  hour: number;
  zone: string;
} {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime()))
    throw new RangeError("Use a valid wall-clock time.");
  const parts = centralFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  const hour =
    (Number(part("hour")) % 24) +
    Number(part("minute")) / 60 +
    Number(part("second")) / 3600 +
    date.getUTCMilliseconds() / 3600000;
  return { hour, zone: part("timeZoneName") };
}

export function formatDaylightTime(hour: number): string {
  const minutes = Math.floor(wrapHour(hour) * 60 + 1e-8) % (24 * 60);
  const wholeHour = Math.floor(minutes / 60);
  return `${wholeHour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${wholeHour < 12 ? "AM" : "PM"}`;
}

export function parseDaylightSettings(raw: string | null): DaylightSettings {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value))
      return { ...DEFAULT_SETTINGS };
    const settings = value as Partial<DaylightSettings>;
    if (
      settings.version !== 1 ||
      !["live", "manual"].includes(settings.mode ?? "") ||
      typeof settings.manualHour !== "number" ||
      !Number.isFinite(settings.manualHour) ||
      settings.manualHour < 0 ||
      settings.manualHour > 24
    )
      return { ...DEFAULT_SETTINGS };
    return {
      version: 1,
      mode: settings.mode!,
      manualHour: wrapHour(settings.manualHour),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** A wall clock with optional manual preview; it never consumes simulation elapsed time. */
export class DaylightClock {
  private readonly now: () => number;
  private readonly storage: ClockStorage | null;
  private readonly document: VisibilitySource | null;
  private readonly window: EventSource | null;
  private configuration: DaylightSettings;
  private persistent = true;
  private listeners = new Set<(state: DaylightState) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(options: DaylightClockOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.document =
      options.document === undefined
        ? typeof document === "undefined"
          ? null
          : document
        : options.document;
    this.window =
      options.window === undefined
        ? typeof window === "undefined"
          ? null
          : window
        : options.window;
    let storage: ClockStorage | null = options.storage ?? null;
    if (options.storage === undefined) {
      try {
        storage = typeof window === "undefined" ? null : window.localStorage;
      } catch {
        this.persistent = false;
      }
    }
    this.storage = storage;
    this.configuration = this.load();
  }

  get persistenceAvailable(): boolean {
    return this.storage !== null && this.persistent;
  }

  get settings(): DaylightSettings {
    return { ...this.configuration };
  }

  snapshot(): DaylightState {
    const live =
      this.configuration.mode === "live" ? centralTime(this.now()) : null;
    const hour = live?.hour ?? this.configuration.manualHour;
    return {
      ...daylightAt(hour),
      mode: this.configuration.mode,
      timeLabel: formatDaylightTime(hour),
      zoneLabel: live ? `Central Time (${live.zone})` : "Manual time",
    };
  }

  setManual(hour: number): void {
    this.assertActive();
    if (
      typeof hour !== "number" ||
      !Number.isFinite(hour) ||
      hour < 0 ||
      hour > 24
    )
      throw new RangeError("Choose a time from 0 to 24 hours.");
    this.configuration = {
      version: 1,
      mode: "manual",
      manualHour: wrapHour(hour),
    };
    this.save();
    this.emit();
  }

  setLive(): void {
    this.assertActive();
    this.configuration = { ...this.configuration, mode: "live" };
    this.save();
    this.emit();
  }

  subscribe(listener: (state: DaylightState) => void): () => void {
    this.assertActive();
    this.listeners.add(listener);
    if (this.timer === null) this.start();
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.stop();
    };
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
    this.disposed = true;
  }

  private assertActive() {
    if (this.disposed)
      throw new Error("This daylight clock has been disposed.");
  }

  private load(): DaylightSettings {
    try {
      return parseDaylightSettings(
        this.storage?.getItem(DAYLIGHT_STORAGE_KEY) ?? null,
      );
    } catch {
      this.persistent = false;
      return { ...DEFAULT_SETTINGS };
    }
  }

  private save() {
    try {
      this.storage?.setItem(
        DAYLIGHT_STORAGE_KEY,
        JSON.stringify(this.configuration),
      );
      this.persistent = true;
    } catch {
      // Preview and live mode still work when the browser disallows persistence.
      this.persistent = false;
    }
  }

  private emit = () => {
    for (const listener of this.listeners) listener(this.snapshot());
  };

  private refreshVisible = () => {
    if (this.document?.visibilityState !== "hidden") this.emit();
  };

  private storageChanged = (event: Event) => {
    const change = event as StorageEvent;
    if (
      (change.key !== DAYLIGHT_STORAGE_KEY && change.key !== null) ||
      (change.storageArea && change.storageArea !== this.storage)
    )
      return;
    this.configuration = this.load();
    this.refreshVisible();
  };

  private start() {
    this.timer = setInterval(() => {
      if (this.configuration.mode === "live") this.refreshVisible();
    }, 1000);
    this.document?.addEventListener("visibilitychange", this.refreshVisible);
    this.window?.addEventListener("focus", this.refreshVisible);
    this.window?.addEventListener("pageshow", this.refreshVisible);
    this.window?.addEventListener("storage", this.storageChanged);
  }

  private stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.document?.removeEventListener("visibilitychange", this.refreshVisible);
    this.window?.removeEventListener("focus", this.refreshVisible);
    this.window?.removeEventListener("pageshow", this.refreshVisible);
    this.window?.removeEventListener("storage", this.storageChanged);
  }
}
