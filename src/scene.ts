import Phaser from "phaser";
import {
  CELL,
  ROOMS,
  defById,
  inRoom,
  placementError,
  roomById,
  worldPoint,
  type Furniture,
  type Room,
} from "./model";
import { paintFurniture } from "./furniture-art";
import { paintPassages } from "./passage-art";
import { passageWorldPoint } from "./passages";
import { CAT_LOOKS } from "./cat-model";
import { arcPoint, type Edge } from "./navigation";
import { Simulation, type Cat } from "./simulation";
import { ACTIVE_THEME } from "./house-theme";
import { ThemeArt, preloadThemeArt } from "./theme-art";
import { VIEW_CENTER } from "./view-frame";
import { CAT_ANIMATIONS, catPose } from "./cat-presentation";
import { DaylightClock, daylightAt, type DaylightState } from "./daylight";
import { DaylightArt } from "./daylight-art";
import { VIEW_FRAME } from "./view-frame";
type Callbacks = {
  selectCat: (c: Cat | null) => void;
  selectFurniture: (f: Furniture) => void;
  preview: (f: Furniture) => void;
  commit: (f: Furniture) => void;
  ready: () => void;
};
export class HouseScene extends Phaser.Scene {
  edit = false;
  debug = false;
  presentation = false;
  selectedCat: string | null = null;
  selectedFurniture: string | null = null;
  candidate: Furniture | null = null;
  zoomLevel = 1;
  private art!: Phaser.GameObjects.Graphics;
  private passageArt!: Phaser.GameObjects.Graphics;
  private furnitureArt!: Phaser.GameObjects.Graphics;
  private originGhost!: Phaser.GameObjects.Graphics;
  private previewArt!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private themeArt?: ThemeArt;
  private daylightArt?: DaylightArt;
  private ambient?: Phaser.GameObjects.Rectangle;
  private lighting: DaylightState = {
    ...daylightAt(23),
    mode: "manual",
    timeLabel: "11:00 PM",
    zoneLabel: "Central Time",
  };
  private windowLight = "";
  private catSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private roomLabels: Phaser.GameObjects.Text[] = [];
  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragOffset = { x: 0, y: 0 };
  private dirty = true;
  constructor(
    public sim: Simulation,
    private callbacks: Callbacks,
    private daylight?: DaylightClock,
  ) {
    super("House");
  }
  preload() {
    preloadThemeArt(this);
    for (const { id: v } of CAT_LOOKS)
      for (const [state, [file]] of Object.entries(CAT_ANIMATIONS))
        this.load.spritesheet(
          `cat-${v}-${state}`,
          `${import.meta.env.BASE_URL}assets/cats/Cat-${v}/Cat-${v}-${file}.png`,
          { frameWidth: 50, frameHeight: 50 },
        );
  }
  create() {
    this.cameras.main.setBackgroundColor("#112d35");
    this.fit();
    this.art = this.add.graphics().setDepth(0);
    this.passageArt = this.add
      .graphics()
      .setDepth(ACTIVE_THEME.id === "original" ? 5 : 6);
    this.furnitureArt = this.add.graphics().setDepth(10);
    this.originGhost = this.add.graphics().setDepth(11).setAlpha(0.23);
    this.previewArt = this.add.graphics().setDepth(39);
    this.overlay = this.add.graphics().setDepth(40);
    if (ACTIVE_THEME.id !== "original") this.themeArt = new ThemeArt(this);
    for (const { id: v } of CAT_LOOKS)
      for (const [state, [, frames, frameRate]] of Object.entries(
        CAT_ANIMATIONS,
      ))
        this.anims.create({
          key: `cat-${v}-${state}`,
          frames: this.anims.generateFrameNumbers(`cat-${v}-${state}`, {
            start: 0,
            end: frames - 1,
          }),
          frameRate,
          repeat: -1,
        });
    this.drawHouse();
    this.daylightArt = new DaylightArt(this, ACTIVE_THEME.id, VIEW_FRAME);
    if (ACTIVE_THEME.id === "original") {
      this.ambient = this.add
        .rectangle(
          -VIEW_FRAME.width * 2,
          -VIEW_FRAME.height,
          VIEW_FRAME.width * 5,
          VIEW_FRAME.height * 3,
          0x15233e,
        )
        .setOrigin(0)
        // Shade placed pieces, cats and the drag preview together; editor
        // outlines and labels stay above the lighting wash.
        .setDepth(39.5)
        .setAlpha(0)
        .setName("house-ambient-light");
    }
    this.events.once("shutdown", () => this.daylightArt?.destroy());
    this.drawFurniture();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.down(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.move(p));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.up(p));
    this.input.on("pointerupoutside", () => {
      if (!this.dragging) return;
      this.dragging = false;
      const original = this.sim.layout.furniture.find(
        (f) => f.instanceId === this.candidate?.instanceId,
      );
      if (original) {
        this.candidate = { ...original };
        this.callbacks.preview({ ...original });
      }
      this.refresh();
    });
    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _x: number, dy: number) => {
        if (!this.edit && !this.presentation) this.zoom(dy > 0 ? -0.1 : 0.1);
      },
    );
    this.callbacks.ready();
  }
  zoom(amount: number) {
    this.zoomLevel = Phaser.Math.Clamp(
      this.zoomLevel + amount,
      ACTIVE_THEME.id === "original" ? 0.85 : 1,
      1.7,
    );
    this.cameras.main
      .setZoom(this.zoomLevel)
      .centerOn(VIEW_CENTER.x, VIEW_CENTER.y);
  }
  fit() {
    this.zoomLevel = 1;
    this.cameras.main.setZoom(1).centerOn(VIEW_CENTER.x, VIEW_CENTER.y);
  }
  setPresentation(value: boolean) {
    this.presentation = value;
    // Presentation hides the overlays, but cats remain available to inspect.
    this.roomLabels.forEach((label) =>
      label.setVisible(!value && (ACTIVE_THEME.id === "original" || this.edit)),
    );
    this.refresh();
  }
  refresh() {
    this.dirty = true;
  }
  clearSelection() {
    this.dragging = false;
    this.candidate = null;
    this.selectedFurniture = null;
    this.refresh();
  }
  private text(
    x: number,
    y: number,
    text: string,
    size = 13,
    color = "#243e40",
  ) {
    return this.add
      .text(x, y, text, {
        fontFamily: "Arial, sans-serif",
        fontSize: size,
        color,
        letterSpacing: 1,
      })
      .setDepth(3);
  }
  private window(r: Room, x: number, y: number) {
    const p = worldPoint(r, x, y),
      g = this.art;
    g.fillStyle(0x2d5561).fillRoundedRect(p.x, p.y, 47, 62, 21);
    const brightness = this.lighting.daylight;
    const color =
      (Math.round(57 + brightness * 112) << 16) |
      (Math.round(92 + brightness * 115) << 8) |
      Math.round(122 + brightness * 95);
    g.fillStyle(color).fillRoundedRect(p.x + 5, p.y + 5, 37, 52, 17);
    g.fillStyle(0xd7d9b5, 0.5).fillRect(p.x + 7, p.y + 23, 33, 3);
    g.fillStyle(0x39595b).fillRect(p.x + 22, p.y + 5, 4, 50);
    g.fillStyle(0x29484b).fillRect(p.x - 4, p.y + 60, 55, 6);
  }
  drawHouse() {
    const g = this.art;
    g.clear();
    this.roomLabels.forEach((t) => t.destroy());
    this.roomLabels = [];
    if (this.themeArt) {
      this.themeArt.drawHouse();
      for (const room of ROOMS) {
        const label = this.text(
          room.attic ? room.x + (room.width * CELL) / 2 : room.x + 12,
          room.attic
            ? room.floor - room.height * CELL * 0.65
            : room.floor - room.height * CELL + 12,
          room.name.toUpperCase(),
          11,
          "#fff0cb",
        )
          .setBackgroundColor("#4b3520d9")
          .setPadding(5, 3)
          .setVisible(this.edit && !this.presentation);
        if (room.attic) label.setOrigin(0.5, 0);
        this.roomLabels.push(label);
      }
      return;
    }
    g.fillStyle(0x163840).fillEllipse(552, 735, 1000, 45);
    g.fillStyle(0x1c4147).fillEllipse(559, 746, 1080, 15);
    g.fillStyle(0x263d3c).fillRect(113, 307, 882, 420);
    g.fillStyle(0x385151).fillRect(106, 724, 896, 9);
    for (const r of ROOMS) {
      const top = r.floor - r.height * CELL;
      g.fillStyle(r.color);
      if (r.attic) {
        g.fillPoints(
          [
            { x: r.x, y: r.floor },
            { x: r.x + r.height * 2 * CELL, y: top },
            { x: r.x + (r.width - r.height * 2) * CELL, y: top },
            { x: r.x + r.width * CELL, y: r.floor },
          ].map((p) => new Phaser.Math.Vector2(p.x, p.y)),
          true,
        );
      } else g.fillRect(r.x, top, r.width * CELL, r.height * CELL);
      g.lineStyle(1, 0x344c49, 0.13);
      for (let x = 0.5; x < r.width; x += 1) {
        if (!inRoom(r, x, r.height)) continue;
        const p = worldPoint(r, x, r.height);
        g.lineBetween(p.x, p.y, p.x, r.floor);
      }
      if (!r.attic) {
        g.fillStyle(0x526961, 0.24).fillRect(
          r.x,
          r.floor - 35,
          r.width * CELL,
          35,
        );
        g.lineStyle(2, 0x657971, 0.5).lineBetween(
          r.x,
          r.floor - 35,
          r.x + r.width * CELL,
          r.floor - 35,
        );
        this.window(r, 12.5, 5.8);
        this.roomLabels.push(
          this.text(r.x + 14, top + 12, r.name.toUpperCase(), 12),
        );
      } else {
        this.roomLabels.push(this.text(477, 176, "THE LITTLE ATTIC", 12));
        this.window(r, 15.1, 4.6);
      }
      g.fillStyle(0xdec291).fillRect(r.x - 5, r.floor, r.width * CELL + 10, 7);
      g.fillStyle(0x9b7755).fillRect(
        r.x - 5,
        r.floor + 7,
        r.width * CELL + 10,
        9,
      );
      g.lineStyle(1, 0x604f40, 0.4);
      for (let x = r.x; x < r.x + r.width * CELL; x += 49)
        g.lineBetween(x, r.floor + 8, x + 13, r.floor + 13);
    }
    g.lineStyle(17, 0x324c4b)
      .beginPath()
      .moveTo(105, 318)
      .lineTo(546, 98)
      .lineTo(564, 98)
      .lineTo(1000, 318)
      .strokePath();
    g.lineStyle(6, 0xb79672)
      .beginPath()
      .moveTo(105, 313)
      .lineTo(547, 93)
      .lineTo(564, 93)
      .lineTo(1000, 313)
      .strokePath();
    g.fillStyle(0x324d4c).fillRect(806, 133, 35, 87);
    g.fillStyle(0x53685c).fillRect(800, 128, 47, 12);
    // Structural posts and brass joinery keep the cutaway readable.
    for (const x of [115, 548, 982]) {
      g.fillStyle(0x435a51).fillRect(x, 329, x === 548 ? 14 : 11, 387);
      g.fillStyle(0xd6b580).fillCircle(x + 6, 342, 2);
      g.fillCircle(x + 6, 530, 2);
    }
    this.roomLabels.push(
      this.text(452, 751, "A QUIET LITTLE CORNER OF THE WORLD", 12, "#a9c0b9"),
    );
    this.roomLabels.forEach((label) => label.setVisible(!this.presentation));
  }
  drawPiece(g: Phaser.GameObjects.Graphics, f: Furniture) {
    if (this.themeArt) {
      this.themeArt.drawPiece(g, f);
      return;
    }
    const d = defById(f.definitionId);
    const p = worldPoint(roomById(f.roomId), f.gridX, f.gridY + d.height);
    paintFurniture(g, d, p.x, p.y, f.flipX);
  }
  catalogThumbnail(id: string): string {
    if (this.themeArt) return this.themeArt.catalogThumbnail(id);
    const d = defById(id),
      pad = 8,
      strap = d.anchor === "ceiling" ? CELL * 2 : 0;
    const canvas = document.createElement("canvas");
    canvas.width = d.width * CELL + pad * 2;
    canvas.height = d.height * CELL + pad * 2 + strap;
    const drawing = this.make.graphics({ x: 0, y: 0 }, false);
    paintFurniture(drawing, d, pad, pad + strap);
    drawing.generateTexture(canvas, canvas.width, canvas.height);
    drawing.destroy();
    return canvas.toDataURL("image/png");
  }
  private movedOriginal(): Furniture | undefined {
    if (!this.edit || !this.candidate) return undefined;
    const original = this.sim.layout.furniture.find(
      (f) => f.instanceId === this.candidate!.instanceId,
    );
    return original &&
      (original.roomId !== this.candidate.roomId ||
        original.gridX !== this.candidate.gridX ||
        original.gridY !== this.candidate.gridY ||
        original.flipX !== this.candidate.flipX)
      ? original
      : undefined;
  }
  drawFurniture() {
    paintPassages(
      this.passageArt,
      this.sim.graph,
      this.edit && !this.presentation,
    );
    this.furnitureArt.clear();
    this.originGhost.clear();
    this.themeArt?.clearLayer(this.furnitureArt);
    this.themeArt?.clearLayer(this.originGhost);
    this.roomLabels.forEach((label) =>
      label.setVisible(
        !this.presentation && (ACTIVE_THEME.id === "original" || this.edit),
      ),
    );
    const ghost = this.movedOriginal();
    for (const f of this.sim.layout.furniture)
      this.drawPiece(
        f.instanceId === ghost?.instanceId
          ? this.originGhost
          : this.furnitureArt,
        f,
      );
    this.dirty = false;
  }
  private point(p: Phaser.Input.Pointer) {
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }
  private hitFurniture(x: number, y: number) {
    return [...this.sim.layout.furniture].reverse().find((f) => {
      const d = defById(f.definitionId),
        p = worldPoint(roomById(f.roomId), f.gridX, f.gridY + d.height);
      return (
        x >= p.x &&
        x <= p.x + d.width * CELL &&
        y >= p.y &&
        y <= p.y + d.height * CELL
      );
    });
  }
  private down(pointer: Phaser.Input.Pointer) {
    const p = this.point(pointer);
    this.dragStart = p;
    if (!this.edit) {
      const c = this.sim.cats.find((c) => {
        const q = worldPoint(roomById(c.roomId), c.x, c.y);
        return Math.abs(q.x - p.x) < 20 && Math.abs(q.y - 13 - p.y) < 20;
      });
      this.selectedCat = c?.id ?? null;
      this.callbacks.selectCat(c ?? null);
      return;
    }
    if (
      this.candidate &&
      !this.sim.layout.furniture.some(
        (f) => f.instanceId === this.candidate!.instanceId,
      )
    ) {
      this.dragging = true;
      this.dragOffset = { x: 0, y: 0 };
      this.move(pointer);
      return;
    }
    const f = this.hitFurniture(p.x, p.y);
    if (f) {
      this.selectedFurniture = f.instanceId;
      this.candidate = { ...f };
      this.callbacks.selectFurniture({ ...f });
      this.dragging = true;
      const pos = worldPoint(roomById(f.roomId), f.gridX, f.gridY);
      this.dragOffset = { x: p.x - pos.x, y: p.y - pos.y };
      this.dirty = true;
    }
  }
  private move(pointer: Phaser.Input.Pointer) {
    if (!this.edit || !this.candidate) return;
    const isNew = !this.sim.layout.furniture.some(
      (f) => f.instanceId === this.candidate!.instanceId,
    );
    if (!this.dragging && !isNew) return;
    const p = this.point(pointer),
      r = ROOMS.find(
        (r) =>
          p.x >= r.x &&
          p.x <= r.x + r.width * CELL &&
          p.y <= r.floor + 6 &&
          p.y >= r.floor - r.height * CELL,
      );
    if (!r) return;
    const d = defById(this.candidate.definitionId),
      x = Math.round(
        (p.x - (this.dragging ? this.dragOffset.x : 0) - r.x) / CELL,
      ),
      y = Math.round(
        (r.floor - p.y + (this.dragging ? this.dragOffset.y : 0)) / CELL,
      );
    this.candidate = {
      ...this.candidate,
      roomId: r.id,
      gridX: x,
      gridY:
        d.anchor === "floor" ? 0 : d.anchor === "ceiling" ? r.height - 3 : y,
    };
    this.callbacks.preview({ ...this.candidate });
  }
  private up(pointer: Phaser.Input.Pointer) {
    if (!this.dragging || !this.candidate) return;
    this.dragging = false;
    const p = this.point(pointer);
    const isNew = !this.sim.layout.furniture.some(
      (f) => f.instanceId === this.candidate!.instanceId,
    );
    if (isNew || Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) > 5)
      this.callbacks.commit({ ...this.candidate });
  }
  private edgePoint(edge: Edge, t: number) {
    if (edge.passage) return passageWorldPoint(edge, t);
    const from = this.sim.surface(edge.from)!;
    const point = arcPoint(edge, t);
    return worldPoint(roomById(from.roomId), point.x, point.y);
  }
  private drawOverlay() {
    const g = this.overlay;
    g.clear();
    this.previewArt.clear();
    this.themeArt?.clearLayer(this.previewArt);
    if (this.presentation) return;
    if (this.edit) {
      for (const r of ROOMS) {
        g.lineStyle(1, 0xeff5de, 0.24);
        for (let y = 0; y < r.height; y++)
          for (let x = 0; x < r.width; x++) {
            if (!inRoom(r, x + 0.5, y + 0.5)) continue;
            const p = worldPoint(r, x, y + 1);
            g.strokeRect(p.x, p.y, CELL, CELL);
          }
        g.lineStyle(3, 0xeec985, 0.7).lineBetween(
          r.x,
          r.floor,
          r.x + r.width * CELL,
          r.floor,
        );
      }
      if (this.candidate) {
        const error = placementError(this.candidate, this.sim.layout),
          d = defById(this.candidate.definitionId),
          p = worldPoint(
            roomById(this.candidate.roomId),
            this.candidate.gridX,
            this.candidate.gridY + d.height,
          );
        const existing = this.sim.layout.furniture.some(
          (f) => f.instanceId === this.candidate!.instanceId,
        );
        if (!existing || this.movedOriginal())
          this.drawPiece(this.previewArt, this.candidate);
        g.lineStyle(3, error ? 0xf18578 : 0xc6ecaf).strokeRect(
          p.x - 2,
          p.y - 2,
          d.width * CELL + 4,
          d.height * CELL + 4,
        );
      }
    }
    if (this.debug) {
      for (const [room, cells] of this.sim.graph.solids) {
        g.fillStyle(0xefac68, 0.16);
        for (const [x, y] of cells) {
          const p = worldPoint(roomById(room), x, y + 1);
          g.fillRect(p.x, p.y, CELL, CELL);
        }
      }
      for (const e of this.sim.graph.edges) {
        g.lineStyle(
          e.passage ? 2 : 1,
          e.passage ? 0xe6b56d : e.kind === "drop" ? 0xe8b577 : 0xa6dcec,
          0.3,
        );
        const pts = Array.from({ length: 16 }, (_, i) =>
          this.edgePoint(e, i / 15),
        );
        g.strokePoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
      }
      for (const s of this.sim.graph.surfaces) {
        const p = worldPoint(roomById(s.roomId), s.x0, s.y);
        g.lineStyle(3, 0xc8eb9d).lineBetween(
          p.x,
          p.y,
          p.x + (s.x1 - s.x0) * CELL,
          p.y,
        );
      }
      for (const goal of this.sim.graph.goals) {
        const s = this.sim.surface(goal.surfaceId)!;
        const p = worldPoint(roomById(s.roomId), goal.x, s.y);
        g.fillStyle(0xffe5ad).fillCircle(p.x, p.y - 3, 2);
      }
    }
    const chosen = this.sim.cats.find((c) => c.id === this.selectedCat);
    if (chosen) {
      const r = roomById(chosen.roomId),
        p = worldPoint(r, chosen.x, chosen.y);
      g.lineStyle(2, 0xf6d996).strokeEllipse(p.x, p.y + 1, 38, 10);
      if (chosen.goal) {
        const s = this.sim.surface(chosen.goal.surfaceId);
        if (s) {
          const q = worldPoint(roomById(s.roomId), chosen.goal.x, s.y);
          g.lineStyle(2, 0xf6d996, 0.8).strokeCircle(q.x, q.y - 10, 5);
        }
      }
      if (this.debug)
        for (const e of chosen.path) {
          g.lineStyle(3, 0xffe4a0);
          g.strokePoints(
            Array.from({ length: 18 }, (_, i) => {
              const p = this.edgePoint(e, i / 17);
              return new Phaser.Math.Vector2(p.x, p.y);
            }),
          );
        }
    }
  }
  update(_time: number, delta: number) {
    this.sim.step(delta / 1000);
    if (this.daylight) this.lighting = this.daylight.snapshot();
    this.daylightArt?.update(this.lighting);
    this.themeArt?.update(this.sim.elapsed, this.lighting);
    this.ambient?.setAlpha(this.lighting.night * 0.2);
    const windowLight = this.lighting.daylight.toFixed(2);
    if (ACTIVE_THEME.id === "original" && this.windowLight !== windowLight) {
      this.windowLight = windowLight;
      this.drawHouse();
    }
    if (this.dirty) this.drawFurniture();
    const ids = new Set(this.sim.cats.map((c) => c.id));
    const catTint =
      ((239 + Math.round(this.lighting.daylight * 16)) << 16) |
      ((241 + Math.round(this.lighting.daylight * 14)) << 8) |
      255;
    for (const [id, s] of this.catSprites)
      if (!ids.has(id)) {
        s.destroy();
        this.catSprites.delete(id);
        this.labels.get(id)?.destroy();
        this.labels.delete(id);
      }
    for (const c of this.sim.cats) {
      let sprite = this.catSprites.get(c.id);
      if (!sprite) {
        sprite = this.add
          .sprite(0, 0, `cat-${c.variant}-idle`)
          .setOrigin(0.5, 0.64)
          .setScale(1.6)
          .setDepth(20)
          .setName(`resident-${c.id}`);
        this.catSprites.set(c.id, sprite);
        const label = this.text(0, 0, "", 12, "#f8f0d8")
          .setDepth(45)
          .setBackgroundColor("#1b343ad9")
          .setPadding(4, 2);
        this.labels.set(c.id, label);
      }
      const p = worldPoint(roomById(c.roomId), c.x, c.y);
      const pose = catPose(c, this.sim.elapsed);
      const ladder = c.move?.passage?.kind === "ladder";
      const angle = ladder
        ? passageWorldPoint(c.move!, 1).y < passageWorldPoint(c.move!, 0).y
          ? -90
          : 90
        : pose.angle;
      sprite
        .setPosition(p.x + pose.x, p.y + pose.y)
        .setDepth(pose.depth)
        .setAngle(angle)
        .setFlipX(ladder ? false : pose.facing < 0)
        .setTexture(`cat-${c.variant}-${pose.animation}`, pose.frame)
        .setTint(catTint)
        .setScale(pose.scaleX, pose.scaleY);
      const label = this.labels.get(c.id)!;
      label.setVisible(
        !this.presentation &&
          (this.debug || c.id === this.selectedCat || c.state === "sleep"),
      );
      label.setText(
        this.debug
          ? `${c.name} · ${c.state}\n${c.surfaceId}`
          : c.id === this.selectedCat
            ? c.name
            : "z z",
      );
      label.setPosition(p.x - label.width / 2, p.y - 44);
    }
    this.drawOverlay();
  }
}
