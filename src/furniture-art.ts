import type Phaser from "phaser";
import { CELL, type FurnitureDef } from "./model";

/** One drawing definition for the house, catalog thumbnails and placement preview. */
export function paintFurniture(
  g: Phaser.GameObjects.Graphics,
  d: FurnitureDef,
  x: number,
  y: number,
  flipX = false,
) {
  const w = d.width * CELL,
    h = d.height * CELL;
  g.lineStyle(2, 0x3b4438, 0.9);
  const rect = (
    a: number,
    b: number,
    c: number,
    e: number,
    color: number,
    rad = 2,
  ) => {
    g.fillStyle(color).fillRoundedRect(a, b, c, e, rad);
    g.strokeRoundedRect(a, b, c, e, rad);
  };
  const top = (a: number, b: number, c: number) => {
    g.fillStyle(0xf4d8a0, 0.5).fillRect(a + 2, b + 2, c - 4, 3);
  };
  if (["cat-tree", "stairs"].includes(d.art)) {
    for (const [cx, cy] of d.cells ?? []) {
      const dx = flipX ? d.width - 1 - cx : cx;
      rect(x + dx * CELL, y + (d.height - cy - 1) * CELL, CELL, CELL, d.color);
    }
    g.lineStyle(1, 0xe2d2a5, 0.45);
    for (let a = y + 8; a < y + h - 4; a += 8)
      g.lineBetween(x + (flipX ? 4 : w - 22), a, x + (flipX ? 22 : w - 4), a);
  } else if (d.art === "table") {
    rect(x + 5, y + 9, 7, h - 9, 0x806447);
    rect(x + w - 12, y + 9, 7, h - 9, 0x806447);
    rect(x, y, w, 10, d.color);
    top(x, y, w);
  } else if (d.art === "couch") {
    rect(x + 5, y + 5, w - 10, h - 8, d.color, 8);
    rect(x, y + 15, 10, h - 15, 0xbc624c, 4);
    rect(x + w - 10, y + 15, 10, h - 15, 0xbc624c, 4);
    g.lineStyle(2, 0x8c4f42, 0.65)
      .lineBetween(x + 12, y + 32, x + w - 12, y + 32)
      .lineBetween(x + w / 2, y + 8, x + w / 2, y + 31);
    top(x + 7, y, w - 14);
    rect(x + (flipX ? w - 31 : 16), y + 10, 16, 16, 0xefbd77, 4);
  } else if (d.art === "bed") {
    rect(x + 3, y + 2, w - 6, h - 5, d.color, 5);
    rect(x + (flipX ? w - 26 : 6), y + 5, 21, 15, 0xf3dfb2, 5);
    g.lineStyle(2, 0xa7824c).lineBetween(
      x + w * 0.4,
      y + 3,
      x + w * 0.4,
      y + h - 4,
    );
    rect(x, y + h - 5, w, 5, 0x87694e);
  } else if (d.art === "bookcase") {
    rect(x, y, w, h, d.color);
    for (let row = 0; row < 3; row++) {
      const by = y + 8 + row * 31;
      g.fillStyle(0x554f42).fillRect(x + 5, by, w - 10, 25);
      for (let j = 0; j < 7; j++) {
        g.fillStyle(
          [0xbba46e, 0x9e6551, 0x637f73, 0xbac0a2][(j + row) % 4],
        ).fillRect(x + 8 + j * 9, by + 4 + (j % 2) * 4, 6, 21 - (j % 2) * 4);
      }
    }
    top(x, y, w);
  } else if (d.art === "scratcher") {
    rect(x + 7, y + 2, w - 14, h - 8, d.color, 7);
    rect(x, y + h - 7, w, 7, 0x968773);
    g.lineStyle(1, 0x948875);
    for (let a = 8; a < h - 7; a += 5)
      g.lineBetween(x + 9, y + a, x + w - 9, y + a - 3);
    top(x + 7, y, w - 14);
  } else if (d.art === "cushion") {
    rect(x + 1, y + 1, w - 2, h - 2, d.color, 10);
    g.lineStyle(2, 0xeee0bc, 0.6).strokeRoundedRect(
      x + 5,
      y + 5,
      w - 10,
      h - 10,
      7,
    );
    g.fillStyle(0x5b635b, 0.45).fillCircle(x + w / 2, y + h / 2, 2);
  } else if (d.art === "cabinet") {
    rect(x, y, w, h, d.color, 3);
    for (let row = 0; row < d.height; row++) {
      rect(x + 5, y + 5 + row * CELL, w - 10, CELL - 8, d.color, 2);
      g.fillStyle(0xe8c88b).fillCircle(x + w / 2, y + 14 + row * CELL, 2.5);
    }
    top(x, y, w);
  } else if (d.art === "books") {
    for (let row = 0; row < d.height * 3; row++) {
      const by = y + row * (h / (d.height * 3));
      rect(
        x + (row % 2) * 2,
        by,
        w - 3,
        h / (d.height * 3),
        [d.color, 0x718c83, 0xbc7f66][row % 3],
      );
      g.fillStyle(0xf0dfb7).fillRect(x + 5, by + 3, w - 10, 2);
    }
  } else if (d.art === "tunnel") {
    rect(x, y, w, h, d.color, 10);
    rect(x + (flipX ? w - 25 : 3), y + 4, 22, h - 7, 0x3e5c61, 8);
    g.lineStyle(2, 0xb7c8b1, 0.6);
    for (let col = 1; col < 3; col++)
      g.lineBetween(x + (col * w) / 3, y + 2, x + (col * w) / 3, y + h - 2);
    top(x, y, w);
  } else if (d.anchor === "wall" || d.anchor === "ceiling") {
    rect(x, y, w, 9, d.color);
    rect(x + 8, y + 9, 5, h - 9, 0x6e6e52);
    rect(x + w - 13, y + 9, 5, h - 9, 0x6e6e52);
    top(x, y, w);
    if (d.id === "window-perch") {
      rect(x + 6, y + 2, w - 12, 5, 0xb5c8a1, 2);
    }
    if (d.anchor === "ceiling") {
      g.lineStyle(2, 0xdbcba3)
        .lineBetween(x + 3, y, x + 3, y - 2 * CELL)
        .lineBetween(x + w - 3, y, x + w - 3, y - 2 * CELL);
    }
  } else {
    rect(x + 1, y + 1, w - 2, h - 2, d.color);
    top(x, y, w);
    if (d.art === "box") {
      rect(x + (flipX ? w - 30 : 7), y + 8, 23, 14, 0x6f604b, 6);
      g.lineStyle(2, 0xe3c48d).lineBetween(x + w / 2, y + 1, x + w / 2, y + 8);
    } else {
      g.lineStyle(3, 0x745e49, 0.55);
      g.lineBetween(x + 4, y + 5, x + w - 4, y + h - 5).lineBetween(
        x + w - 4,
        y + 5,
        x + 4,
        y + h - 5,
      );
      g.lineStyle(1, 0xdbc098, 0.6);
      for (let a = 12; a < h; a += 13)
        g.lineBetween(x + 3, y + a, x + w - 3, y + a);
    }
  }
}
