import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CENTRAL_TIME_ZONE,
  DAYLIGHT_STORAGE_KEY,
  DaylightClock,
  centralTime,
  daylightAt,
  formatDaylightTime,
  parseDaylightSettings,
  wrapHour,
  type DaylightState,
} from "../src/daylight";

function backend(initial?: string) {
  const data = new Map<string, string>(
    initial === undefined ? [] : [[DAYLIGHT_STORAGE_KEY, initial]],
  );
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fixed artistic daily lighting", () => {
  it("has smooth, bounded, normalized art weights throughout every minute of the day", () => {
    let previous = daylightAt(0);
    for (let minute = 0; minute <= 1440; minute++) {
      const state = daylightAt(minute / 60);
      expect(
        Object.values(state.weights).reduce((sum, weight) => sum + weight, 0),
      ).toBeCloseTo(1, 12);
      for (const key of [
        "daylight",
        "night",
        "dawn",
        "sunset",
        "warmth",
        "sunProgress",
        "moonProgress",
        "moon",
        "lanternIntensity",
      ] as const) {
        expect(state[key], key).toBeGreaterThanOrEqual(0);
        expect(state[key], key).toBeLessThanOrEqual(1);
        expect(Math.abs(state[key] - previous[key]), key).toBeLessThan(0.04);
      }
      expect(state.daylight + state.night).toBeCloseTo(1, 12);
      previous = state;
    }
    expect(daylightAt(0)).toEqual(daylightAt(24));
    expect(daylightAt(-6)).toEqual(daylightAt(18));
  });

  it("distinguishes clear day and night with warm dawn/sunset and night-only moon/light flutter", () => {
    expect(daylightAt(12)).toMatchObject({
      phase: "afternoon",
      daylight: 1,
      night: 0,
      moon: 0,
      lanternIntensity: 0,
      warmth: 0,
      weights: { day: 1, night: 0, dawn: 0, sunset: 0 },
    });
    expect(daylightAt(0)).toMatchObject({
      phase: "night",
      daylight: 0,
      night: 1,
      moon: 1,
      lanternIntensity: 1,
      warmth: 0,
    });
    expect(daylightAt(6.5).dawn).toBe(1);
    expect(daylightAt(6.5).warmth).toBeGreaterThan(0.6);
    expect(daylightAt(18.5).sunset).toBe(1);
    expect(daylightAt(18.5).warmth).toBeGreaterThan(0.9);
    expect(daylightAt(6).sunProgress).toBe(0);
    expect(daylightAt(18).sunProgress).toBe(1);
    expect(daylightAt(0).moonProgress).toBeCloseTo(0.5);
  });

  it.each([0, 5.5, 6.5, 8.5, 9, 12, 16, 17, 18.5, 20.5, 21.5, 24])(
    "does not jump its lighting or sky positions at the %s hour boundary",
    (hour) => {
      const before = daylightAt(hour - 1e-6);
      const after = daylightAt(hour + 1e-6);
      for (const key of [
        "daylight",
        "night",
        "warmth",
        "sunProgress",
        "moonProgress",
        "moon",
        "lanternIntensity",
      ] as const)
        expect(Math.abs(before[key] - after[key]), key).toBeLessThan(1e-5);
      for (const key of ["night", "day", "dawn", "sunset"] as const)
        expect(
          Math.abs(before.weights[key] - after.weights[key]),
          key,
        ).toBeLessThan(1e-5);
    },
  );

  it("formats noon, midnight and slider fractions consistently and rejects non-finite lighting input", () => {
    expect(formatDaylightTime(0)).toBe("12:00 AM");
    expect(formatDaylightTime(24)).toBe("12:00 AM");
    expect(formatDaylightTime(12)).toBe("12:00 PM");
    expect(formatDaylightTime(17.25)).toBe("5:15 PM");
    expect(formatDaylightTime(23 + 59 / 60)).toBe("11:59 PM");
    expect(wrapHour(-1)).toBe(23);
    for (const hour of [NaN, Infinity, -Infinity])
      expect(() => daylightAt(hour)).toThrow(RangeError);
  });
});

describe("real Central time", () => {
  it("uses America/Chicago instead of the computer's default zone or a fixed UTC offset", () => {
    expect(CENTRAL_TIME_ZONE).toBe("America/Chicago");
    expect(centralTime(Date.parse("2026-01-15T12:00:00Z"))).toEqual({
      hour: 6,
      zone: "CST",
    });
    expect(centralTime(Date.parse("2026-07-15T12:00:00Z"))).toEqual({
      hour: 7,
      zone: "CDT",
    });
    expect(centralTime(new Date("2026-07-15T05:00:00Z")).hour).toBe(0);
    expect(() => centralTime(new Date("invalid"))).toThrow(RangeError);
  });

  it("follows the spring skipped hour and fall repeated hour using the zone's DST rules", () => {
    expect(
      centralTime(Date.parse("2026-03-08T07:59:59.999Z")).hour,
    ).toBeCloseTo(2, 5);
    expect(centralTime(Date.parse("2026-03-08T08:00:00Z"))).toEqual({
      hour: 3,
      zone: "CDT",
    });
    expect(
      centralTime(Date.parse("2026-11-01T06:59:59.999Z")).hour,
    ).toBeCloseTo(2, 5);
    expect(centralTime(Date.parse("2026-11-01T07:00:00Z"))).toEqual({
      hour: 1,
      zone: "CST",
    });
  });

  it("samples current wall time after long inactivity and backward clock adjustments without accumulating deltas", () => {
    let now = Date.parse("2026-07-15T12:00:00Z");
    const clock = new DaylightClock({ storage: null, now: () => now });
    expect(clock.snapshot()).toMatchObject({
      hour: 7,
      mode: "live",
      timeLabel: "7:00 AM",
      zoneLabel: "Central Time (CDT)",
    });
    now += 8 * 3600000;
    expect(clock.snapshot().hour).toBe(15);
    now -= 11 * 3600000;
    expect(clock.snapshot().hour).toBe(4);
    expect(clock.snapshot().phase).toBe("night");
    clock.setManual(18.5);
    now += 24 * 3600000;
    expect(clock.snapshot()).toMatchObject({
      hour: 18.5,
      mode: "manual",
      timeLabel: "6:30 PM",
      zoneLabel: "Manual time",
    });
    clock.setLive();
    expect(clock.snapshot()).toMatchObject({ hour: 4, mode: "live" });
  });
});

describe("persistent preview settings", () => {
  it("starts live, preserves manual selection globally across new instances, and returns live", () => {
    const storage = backend();
    const first = new DaylightClock({
      storage,
      now: () => Date.parse("2026-07-15T12:00:00Z"),
    });
    expect(first.snapshot().mode).toBe("live");
    first.setManual(24);
    expect(first.snapshot().hour).toBe(0);
    expect(JSON.parse(storage.data.get(DAYLIGHT_STORAGE_KEY)!)).toEqual({
      version: 1,
      mode: "manual",
      manualHour: 0,
    });
    storage.setItem("little-house.theme.v1", "cabin");
    const otherHouse = new DaylightClock({
      storage,
      now: () => Date.parse("2026-07-15T12:00:00Z"),
    });
    expect(otherHouse.snapshot()).toMatchObject({ mode: "manual", hour: 0 });
    otherHouse.setLive();
    expect(new DaylightClock({ storage }).settings.mode).toBe("live");
    expect(storage.data.size).toBe(2);
    const externalSettings = otherHouse.settings;
    externalSettings.mode = "manual";
    expect(otherHouse.settings.mode).toBe("live");
  });

  it.each([
    null,
    "not json",
    "null",
    "[]",
    "12",
    "{}",
    '{"version":2,"mode":"manual","manualHour":12}',
    '{"version":1,"mode":"bogus","manualHour":12}',
    '{"version":1,"mode":"manual","manualHour":"12"}',
    '{"version":1,"mode":"manual","manualHour":-1}',
    '{"version":1,"mode":"manual","manualHour":25}',
    '{"version":1,"mode":"manual","manualHour":null}',
  ])("falls back to live for malformed storage %s", (stored) => {
    expect(parseDaylightSettings(stored)).toEqual({
      version: 1,
      mode: "live",
      manualHour: 12,
    });
  });

  it("rejects invalid slider input without changing memory, emitting state, or overwriting a saved choice", () => {
    const storage = backend();
    const clock = new DaylightClock({ storage });
    cleanups.push(() => clock.dispose());
    clock.setManual(16.25);
    const listener = vi.fn();
    clock.subscribe(listener);
    const before = storage.data.get(DAYLIGHT_STORAGE_KEY);
    for (const value of [
      NaN,
      Infinity,
      -Infinity,
      -0.1,
      24.01,
      "6",
      null,
    ] as number[])
      expect(() => clock.setManual(value)).toThrow(RangeError);
    expect(storage.data.get(DAYLIGHT_STORAGE_KEY)).toBe(before);
    expect(clock.snapshot().hour).toBe(16.25);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("works in memory when reads/writes or the localStorage getter are blocked", () => {
    const clock = new DaylightClock({
      storage: {
        getItem: () => {
          throw new Error("read denied");
        },
        setItem: () => {
          throw new Error("write denied");
        },
      },
    });
    expect(clock.settings.mode).toBe("live");
    expect(clock.persistenceAvailable).toBe(false);
    expect(() => clock.setManual(10)).not.toThrow();
    expect(clock.snapshot().hour).toBe(10);
    expect(clock.persistenceAvailable).toBe(false);
    clock.setLive();
    expect(clock.snapshot().mode).toBe("live");
    const blocked = {
      get localStorage() {
        throw new Error("storage disabled");
      },
    };
    vi.stubGlobal("window", blocked);
    const denied = new DaylightClock();
    expect(denied.settings.mode).toBe("live");
    denied.setManual(9);
    expect(denied.snapshot().hour).toBe(9);
    expect(denied.persistenceAvailable).toBe(false);
  });
});

describe("subscriptions and waking browser tabs", () => {
  function subscribed() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T13:29:59Z"));
    const visibility = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    const events = new EventTarget();
    const storage = backend();
    const clock = new DaylightClock({
      storage,
      document: visibility,
      window: events,
    });
    cleanups.push(() => clock.dispose());
    const states: DaylightState[] = [];
    const unsubscribe = clock.subscribe((state) => states.push(state));
    return { clock, visibility, events, states, storage, unsubscribe };
  }

  it("updates live subscribers automatically across a phase boundary without a simulation tick", () => {
    const { states } = subscribed();
    expect(states).toHaveLength(1);
    expect(states[0].phase).toBe("dawn");
    vi.advanceTimersByTime(2000);
    expect(states.at(-1)?.phase).toBe("morning");
    expect(states.at(-1)?.timeLabel).toBe("8:30 AM");
  });

  it.each(["visibilitychange", "focus", "pageshow"])(
    "resamples wall time immediately on %s after browser inactivity",
    (event) => {
      const { visibility, events, states } = subscribed();
      visibility.visibilityState = "hidden";
      vi.advanceTimersByTime(10000);
      expect(states).toHaveLength(1);
      vi.setSystemTime(new Date("2026-07-16T03:00:00Z"));
      visibility.visibilityState = "visible";
      (event === "visibilitychange" ? visibility : events).dispatchEvent(
        new Event(event),
      );
      expect(states).toHaveLength(2);
      expect(states.at(-1)).toMatchObject({ hour: 22, phase: "night" });
    },
  );

  it("keeps manual mode fixed while live mode resumes directly from current wall time", () => {
    const { clock, states } = subscribed();
    clock.setManual(6);
    const count = states.length;
    vi.advanceTimersByTime(8 * 3600000);
    expect(states).toHaveLength(count);
    expect(clock.snapshot().hour).toBe(6);
    clock.setLive();
    expect(states.at(-1)?.hour).toBeCloseTo(16.5, 2);
  });

  it("updates settings from another tab without writing them back, ignoring unrelated keys", () => {
    const { clock, events, storage, states } = subscribed();
    storage.setItem(
      DAYLIGHT_STORAGE_KEY,
      '{"version":1,"mode":"manual","manualHour":19}',
    );
    events.dispatchEvent(
      Object.assign(new Event("storage"), {
        key: "another-key",
        storageArea: storage,
      }),
    );
    expect(clock.settings.mode).toBe("live");
    events.dispatchEvent(
      Object.assign(new Event("storage"), {
        key: DAYLIGHT_STORAGE_KEY,
        storageArea: storage,
      }),
    );
    expect(states.at(-1)).toMatchObject({ mode: "manual", hour: 19 });
    storage.data.clear();
    events.dispatchEvent(
      Object.assign(new Event("storage"), { key: null, storageArea: storage }),
    );
    expect(clock.settings.mode).toBe("live");
  });

  it("cleans up timers and browser listeners when unsubscribed or disposed", () => {
    const { clock, events, visibility, states, unsubscribe } = subscribed();
    expect(vi.getTimerCount()).toBe(1);
    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10000);
    events.dispatchEvent(new Event("focus"));
    visibility.dispatchEvent(new Event("visibilitychange"));
    expect(states).toHaveLength(1);
    clock.subscribe((state) => states.push(state));
    expect(vi.getTimerCount()).toBe(1);
    clock.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(() => clock.subscribe(() => {})).toThrow("disposed");
    expect(() => clock.setManual(12)).toThrow("disposed");
  });
});
