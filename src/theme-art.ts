import type Phaser from "phaser";
import { ACTIVE_THEME, THEMES, type ThemeId } from "./house-theme";
import { VIEW_FRAME } from "./view-frame";
import { LanternLight } from "./lantern-light";
import type { DaylightState } from "./daylight";
import { daylightRenderKey } from "./daylight-art";
import {
  CATALOG,
  CELL,
  defById,
  roomById,
  worldPoint,
  type Furniture,
} from "./model";

const HOUSE_TEXTURE = "theme-house";
const DAY_TEXTURE = "theme-house-day";
const FIXTURE_TEXTURE = "theme-fixtures";
const FIREPLACE_TEXTURE = "theme-fireplace-flames";
const furnitureTexture = (id: string) => `theme-furniture-${id}`;
const artSettings = new Map(THEMES.map((theme) => [theme.id, theme.art]));

/** Multiplicative material lighting; the catalog keeps its neutral source art. */
export function furnitureLightingTint(
  lighting: DaylightState,
  theme: ThemeId,
  x: number,
  y: number,
): number {
  if (theme === "original") return 0xffffff;
  const settings = artSettings.get(theme);
  const width = settings?.frame?.width ?? (theme === "tower" ? 792 : 1408);
  const localX = Math.max(0, Math.min(1, x / width));
  const outdoors = settings?.furnitureOutdoorNight && THEMES.find((item) => item.id === theme)?.rooms.some((room) =>
    room.outdoor && x >= room.x - (settings.frame?.x ?? 0) && x <= room.x + room.width * CELL - (settings.frame?.x ?? 0) &&
    y >= room.floor - room.height * CELL - (settings.frame?.y ?? 0) && y <= room.floor - (settings.frame?.y ?? 0) + 1);
  const night = (outdoors ? settings?.furnitureOutdoorNight : settings?.furnitureNight) ??
    (theme === "cabin" || theme === "cabin-v2" ? [224, 221, 219] : [218, 222, 232]);
  // Local candle warmth fades smoothly with distance instead of turning every
  // object equally blue at night. Coordinates match the authored wall lamps.
  const lamps = settings?.lamps.map(({ x, y }) => [x, y]) ?? (theme === "tower"
    ? [289, 509, 729, 949, 1169].map((ly) => [270, ly])
    : theme === "cabin"
      ? [[603, 221], [319, 384], [735, 420], [319, 579], [738, 586]]
      : [[548, 208], [354, 456], [1132, 478]]);
  const lamp = Math.max(0, ...lamps.map(([lx, ly]) =>
    Math.exp(-((x - lx) ** 2 / 180 ** 2 + (y - ly) ** 2 / 130 ** 2))));
  const nightPalette = settings?.furnitureNight
    ? [night[0] + lamp * 62, night[1] + lamp * 35, night[2] + lamp * 5]
    : [night[0] + lamp * 17, night[1] + lamp * 5, night[2] - lamp * 11];
  const dayPalette = [244, 249, 255];
  const transition = (daylight: number, warmth: number[]) => nightPalette.map((value, channel) =>
    value * (1 - daylight) + dayPalette[channel] * daylight + warmth[channel]);
  const palettes = {
    night: nightPalette,
    day: dayPalette,
    // Newly authored dark plates need their props to follow the same day/night
    // crossfade. Retain the existing material palette for the original themes.
    dawn: settings?.furnitureNight ? transition(0.45, [13, 7, -4]) : [255, 239, 224],
    sunset: settings?.furnitureNight ? transition(0.38, [20, 3, -6]) : [255, 227, 213],
  };
  // Dawn arrives from the left and evening from the right. No channel exceeds
  // 255 or crushes dark wood; local warmth also varies with the object's height.
  const shade = 1 - (lighting.dawn * localX + lighting.sunset * (1 - localX)) * 0.035;
  const channels = [0, 1, 2].map((channel) => Math.round(
    Math.max(0, Math.min(255, Object.entries(lighting.weights).reduce((sum, [phase, weight]) =>
      sum + palettes[phase as keyof typeof palettes][channel] * weight, 0) * shade)),
  ));
  return (channels[0] << 16) | (channels[1] << 8) | channels[2];
}

export function preloadThemeArt(scene: Phaser.Scene) {
  if (ACTIVE_THEME.id === "original") return;
  scene.load.image(
    HOUSE_TEXTURE,
    `${import.meta.env.BASE_URL}assets/houses/${ACTIVE_THEME.id}/background-night.png`,
  );
  scene.load.image(
    DAY_TEXTURE,
    `${import.meta.env.BASE_URL}assets/houses/${ACTIVE_THEME.id}/background-day.png`,
  );
  scene.load.image(
    "theme-sky-mask",
    `${import.meta.env.BASE_URL}assets/houses/${ACTIVE_THEME.id}/sky-mask.png`,
  );
  if (ACTIVE_THEME.id === "tower" || ACTIVE_THEME.art?.atmosphereMask)
    scene.load.image(
      "theme-atmosphere-mask",
      `${import.meta.env.BASE_URL}assets/houses/${ACTIVE_THEME.id}/atmosphere-mask.png`,
    );
  if (ACTIVE_THEME.art?.windowMask)
    scene.load.image(
      "theme-window-mask",
      `${import.meta.env.BASE_URL}assets/houses/${ACTIVE_THEME.id}/window-mask.png`,
    );
  scene.load.image(
    FIXTURE_TEXTURE,
    `${import.meta.env.BASE_URL}assets/houses/${ACTIVE_THEME.id}/fixtures.png`,
  );
  if (ACTIVE_THEME.art?.nightFixtures)
    scene.load.image(
      "theme-fixtures-night",
      `${import.meta.env.BASE_URL}assets/houses/${ACTIVE_THEME.id}/fixtures-night.png`,
    );
  const fireplace = ACTIVE_THEME.art?.fireplace;
  if (fireplace)
    scene.load.spritesheet(
      FIREPLACE_TEXTURE,
      `${import.meta.env.BASE_URL}assets/houses/${ACTIVE_THEME.id}/fireplace-flames.png`,
      { frameWidth: fireplace.width, frameHeight: fireplace.height, endFrame: fireplace.frameCount - 1 },
    );
  for (const definition of CATALOG)
    scene.load.image(
      furnitureTexture(definition.id),
      `${import.meta.env.BASE_URL}assets/houses/furniture/${definition.id}.png`,
    );
}

type ImageLayer = {
  container: Phaser.GameObjects.Container;
  images: Phaser.GameObjects.Image[];
  used: number;
};

/** Texture counterparts to the furniture, ghost and preview graphics layers. */
export class ThemeArt {
  private background?: Phaser.GameObjects.Image;
  private day?: Phaser.GameObjects.Image;
  private fixtures?: Phaser.GameObjects.Image;
  private nightFixtures?: Phaser.GameObjects.Image;
  private fireplace?: Phaser.GameObjects.Sprite;
  private fireplaceMotion?: MediaQueryList;
  private fireplaceFrame = 0;
  private lanterns?: LanternLight;
  private layers = new Map<Phaser.GameObjects.Graphics, ImageLayer>();
  private lighting?: DaylightState;
  private lastLightingKey = "";

  constructor(private scene: Phaser.Scene) {}

  drawHouse() {
    const fixtureDepth = ACTIVE_THEME.art?.foregroundFixtures ? 22 : 5;
    this.background ??= this.scene.add
      .image(VIEW_FRAME.x, VIEW_FRAME.y, HOUSE_TEXTURE)
      .setOrigin(0)
      .setDepth(0)
      .setName("theme-house");
    this.day ??= this.scene.add
      .image(VIEW_FRAME.x, VIEW_FRAME.y, DAY_TEXTURE)
      .setOrigin(0)
      .setDepth(0.1)
      .setAlpha(0)
      .setName("theme-house-day");
    this.fixtures ??= this.scene.add
      .image(0, 0, FIXTURE_TEXTURE)
      .setOrigin(0)
      .setDepth(fixtureDepth)
      .setName("theme-fixtures");
    if (ACTIVE_THEME.art?.nightFixtures) {
      this.fixtures.setDepth(fixtureDepth + 0.1).setAlpha(this.lighting?.daylight ?? 0);
      this.nightFixtures ??= this.scene.add
        .image(0, 0, "theme-fixtures-night")
        .setOrigin(0)
        .setDepth(fixtureDepth)
        .setName("theme-fixtures-night");
    }
    const fireplace = ACTIVE_THEME.art?.fireplace;
    if (fireplace && !this.fireplace) {
      this.fireplaceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.fireplace = this.scene.add
        .sprite(VIEW_FRAME.x + fireplace.x, VIEW_FRAME.y + fireplace.y, FIREPLACE_TEXTURE, 0)
        .setOrigin(0)
        .setDepth(0.75)
        .setAlpha(1)
        .setName("theme-fireplace-flames");
    }
    this.lanterns ??= new LanternLight(this.scene, ACTIVE_THEME.id, VIEW_FRAME);
  }

  update(seconds: number, lighting?: DaylightState) {
    const fireplace = ACTIVE_THEME.art?.fireplace;
    if (this.fireplace && fireplace) {
      // Follow the simulation clock so pause freezes the loop. Flames burn even
      // at noon; the background and lantern layers own the reflected light.
      const frame = this.fireplaceMotion?.matches
        ? 0
        : Math.floor(seconds * fireplace.frameRate) % fireplace.frameCount;
      if (this.fireplaceFrame !== frame) {
        this.fireplace.setFrame(frame);
        this.fireplaceFrame = frame;
      }
    }
    this.lanterns?.update(seconds, lighting?.lanternIntensity);
    if (!lighting) return;
    this.lighting = lighting;
    const key = daylightRenderKey(lighting);
    if (key === this.lastLightingKey) return;
    this.lastLightingKey = key;
    this.day?.setAlpha(lighting.daylight);
    if (this.nightFixtures)
      this.fixtures?.setAlpha(lighting.daylight);
    else
      this.fixtures?.setTint(furnitureLightingTint(lighting, ACTIVE_THEME.id, VIEW_FRAME.width / 2, VIEW_FRAME.height / 2));
    for (const layer of this.layers.values())
      for (const image of layer.images) this.lightPiece(image);
  }

  private lightPiece(image: Phaser.GameObjects.Image) {
    if (!this.lighting) return image.setTint(0xffffff);
    const tint = (x: number, y: number) => furnitureLightingTint(
      this.lighting!, ACTIVE_THEME.id, x - VIEW_FRAME.x, y - VIEW_FRAME.y,
    );
    // Phaser flips the image's vertex positions, including their corner tints.
    // Keep light anchored to the room when the artwork faces the other way.
    const left = image.x + (image.flipX ? image.displayWidth : 0);
    const right = image.x + (image.flipX ? 0 : image.displayWidth);
    return image.setTint(
      tint(left, image.y),
      tint(right, image.y),
      tint(left, image.y + image.displayHeight),
      tint(right, image.y + image.displayHeight),
    );
  }

  clearLayer(graphics: Phaser.GameObjects.Graphics) {
    const layer = this.layers.get(graphics);
    if (!layer) return;
    layer.used = 0;
    layer.container
      .setDepth(graphics.depth)
      .setAlpha(graphics.alpha)
      .setVisible(graphics.visible);
    for (const image of layer.images) image.setVisible(false);
  }

  drawPiece(graphics: Phaser.GameObjects.Graphics, furniture: Furniture) {
    const definition = defById(furniture.definitionId);
    const point = worldPoint(
      roomById(furniture.roomId),
      furniture.gridX,
      furniture.gridY + definition.height,
    );
    if (definition.anchor === "ceiling") {
      // Suspension belongs above the usable body, just as in the original art.
      graphics.lineStyle(2, 0xb3a07b, 0.95);
      for (const inset of [0.18, 0.82]) {
        const x = point.x + definition.width * CELL * inset;
        graphics.lineBetween(x, point.y - CELL * 2, x, point.y + 4);
        graphics.fillStyle(0x604632).fillRect(x - 3, point.y - CELL * 2, 6, 3);
      }
    }
    let layer = this.layers.get(graphics);
    if (!layer) {
      layer = {
        container: this.scene.add
          .container()
          .setDepth(graphics.depth)
          .setAlpha(graphics.alpha)
          .setVisible(graphics.visible)
          .setName(`theme-layer-${graphics.depth}`),
        images: [],
        used: 0,
      };
      this.layers.set(graphics, layer);
    }
    const index = layer.used++;
    let image = layer.images[index];
    if (!image) {
      image = this.scene.add.image(0, 0, furnitureTexture(definition.id));
      layer.container.add(image);
      layer.images.push(image);
    }
    image
      .setTexture(furnitureTexture(definition.id))
      .setOrigin(0)
      .setPosition(point.x, point.y)
      .setDisplaySize(definition.width * CELL, definition.height * CELL)
      .setFlipX(furniture.flipX)
      .setName(furniture.instanceId)
      .setVisible(true);
    this.lightPiece(image);
  }

  catalogThumbnail(id: string): string {
    const definition = defById(id);
    const pad = 8;
    const suspension = definition.anchor === "ceiling" ? CELL * 2 : 0;
    const canvas = document.createElement("canvas");
    canvas.width = definition.width * CELL + pad * 2;
    canvas.height = definition.height * CELL + pad * 2 + suspension;
    const context = canvas.getContext("2d")!;
    if (suspension) {
      context.strokeStyle = "#b3a07b";
      context.lineWidth = 2;
      for (const inset of [0.18, 0.82]) {
        const x = pad + definition.width * CELL * inset;
        context.beginPath();
        context.moveTo(x, pad);
        context.lineTo(x, pad + suspension + 4);
        context.stroke();
        context.fillStyle = "#604632";
        context.fillRect(x - 3, pad, 6, 3);
      }
    }
    context.drawImage(
      this.scene.textures
        .get(furnitureTexture(id))
        .getSourceImage() as CanvasImageSource,
      pad,
      pad + suspension,
      definition.width * CELL,
      definition.height * CELL,
    );
    return canvas.toDataURL("image/png");
  }
}
