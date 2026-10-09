import { afterEach, expect, test, vi } from "vitest";
import { defaultLayout, makeFurniture } from "../src/model";
import { deserializeLayout } from "../src/storage";
afterEach(() => vi.unstubAllGlobals());

test("furniture identities work without secure-context randomUUID and survive saved layouts", () => {
  const getRandomValues = globalThis.crypto.getRandomValues.bind(
    globalThis.crypto,
  );
  vi.stubGlobal("crypto", { getRandomValues });
  const pieces = Array.from({ length: 256 }, () =>
    makeFurniture("box", "lounge", 5),
  );
  expect(new Set(pieces.map((piece) => piece.instanceId)).size).toBe(256);
  const layout = defaultLayout();
  layout.furniture.push(pieces[0]);
  expect(deserializeLayout(JSON.stringify(layout))).toEqual(layout);
  expect(
    makeFurniture("box", "lounge", 5, 0, "existing-piece").instanceId,
  ).toBe("existing-piece");
});
