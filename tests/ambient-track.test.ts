import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AMBIENT_TRACKS, ambientTrackPath } from "../src/ambient-track";
import { THEMES } from "../src/house-theme";

describe("scene recordings", () => {
  it("bundles a distinct credited recording for every house", () => {
    const credits = readFileSync(
      new URL("../public/assets/ambience/credits.txt", import.meta.url),
      "utf8",
    );
    const hashes = THEMES.map(({ id }) => {
      const path = ambientTrackPath(id);
      const bytes = readFileSync(new URL(`../public/${path}`, import.meta.url));
      expect(bytes.length).toBeGreaterThan(32_000);
      expect(credits).toContain(path.split("/").at(-1)!);
      expect(AMBIENT_TRACKS[id]).toBeTruthy();
      return createHash("sha256").update(bytes).digest("hex");
    });
    expect(new Set(hashes).size).toBe(THEMES.length);
  });
});
