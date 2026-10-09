import type Phaser from "phaser";
import { THEMES, type ThemeId } from "./house-theme";
import { wrapHour, type DaylightState } from "./daylight";

export interface DaylightFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

const unit = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (start: number, end: number, value: number) => {
  const t = unit((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

/** Frame-local decorative sky orbits; both remain continuous through midnight. */
export function celestialPosition(
  hour: number,
  body: "sun" | "moon",
  theme: ThemeId,
  frame: Pick<DaylightFrame, "width" | "height">,
) {
  const horizon =
    theme === "tower" ? frame.height * (1000 / 1408) : frame.height * 0.62;
  const high =
    theme === "tower"
      ? frame.height * (55 / 1408)
      : frame.height * ((theme === "ramen" ? 28 : 50) / 792);
  const angle = ((wrapHour(hour) - (body === "sun" ? 6 : 18)) / 12) * Math.PI;
  const elevation = Math.sin(angle);
  return {
    // The tower's centered finial reaches almost to the frame edge. Bend the
    // top of the orbit leftward rather than clipping its sun/moon against it.
    x: frame.width * (0.5 - 0.4 * Math.cos(angle) -
      (theme === "tower" ? 0.17 * Math.max(0, elevation) ** 2 : 0)),
    y: horizon - (horizon - high) * elevation,
    visibility: smooth(-0.1, 0.08, elevation),
    elevation,
  };
}

/** Live textures upload at most once per second; manual previews update immediately. */
export function daylightRenderKey(
  state: Pick<DaylightState, "hour" | "mode">,
): string {
  return `${state.mode}:${state.mode === "live" ? Math.floor(wrapHour(state.hour) * 3600 + 1e-7) : wrapHour(state.hour)}`;
}

type RGB = readonly [number, number, number];
type WindowView = readonly [x: number, y: number, width: number, height: number];
const artSettings = new Map(THEMES.map((theme) => [theme.id, theme.art]));
// Tight bounds contain glass only; the daylight pixels below refine these into
// the actual circular/arched silhouettes, including their mullions.
const WINDOW_VIEWS: Partial<Record<ThemeId, readonly WindowView[]>> = {
  tower: [
    [369, 291, 56, 55], [377, 511, 61, 92], [359, 732, 97, 73],
    [376, 942, 62, 82], [516, 1159, 52, 42],
  ],
  cabin: [
    [685, 201, 35, 54], [606, 367, 40, 57], [1034, 366, 41, 59],
    [606, 555, 41, 57], [1033, 554, 43, 60],
  ],
};

/** Sky and pale clouds receive twilight color; opaque timber and stone do not. */
export function windowSkyOpacity(red: number, green: number, blue: number): number {
  const brightness = Math.max(red, green, blue);
  const sky = smooth(-8, 22, blue - red) * smooth(-14, 8, green - red);
  return sky * smooth(55, 130, brightness);
}
const SKY_PALETTES: Record<keyof DaylightState["weights"], readonly RGB[]> = {
  night: [
    [11, 28, 45],
    [22, 52, 65],
    [43, 71, 75],
    [14, 41, 47],
  ],
  dawn: [
    [82, 103, 136],
    [171, 156, 165],
    [236, 193, 150],
    [52, 82, 78],
  ],
  day: [
    [109, 164, 191],
    [173, 208, 213],
    [222, 227, 198],
    [57, 101, 83],
  ],
  sunset: [
    [79, 75, 112],
    [186, 123, 126],
    [242, 190, 131],
    [44, 66, 70],
  ],
};

function skyColors(state: DaylightState): string[] {
  return [0, 1, 2, 3].map((stop) => {
    const channels = [0, 1, 2].map((channel) =>
      Math.round(
        (Object.keys(state.weights) as (keyof typeof state.weights)[]).reduce(
          (sum, key) =>
            sum + SKY_PALETTES[key][stop][channel] * state.weights[key],
          0,
        ),
      ),
    );
    return `rgb(${channels.join(",")})`;
  });
}

type CanvasLayer = {
  key: string;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
};
type MaskedAtmosphere = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  // Borrow the preloaded mask; only the working canvas belongs to this renderer.
  mask: CanvasImageSource;
};
type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  cross: boolean;
};
let nextSkyId = 0;

/** Transparent sky details are composited on the authored sky's alpha mask, never on the house. */
export class DaylightArt {
  private readonly effects: CanvasLayer;
  private readonly background?: CanvasLayer;
  private readonly mask: HTMLCanvasElement;
  private readonly crescent: HTMLCanvasElement;
  private readonly stars: Star[];
  private readonly radius: number;
  private readonly maskReady: boolean;
  private atmosphere?: MaskedAtmosphere;
  private windowViews?: MaskedAtmosphere;
  private lastKey = "";
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly theme: ThemeId,
    private readonly frame: DaylightFrame,
  ) {
    this.radius =
      theme === "ramen"
        ? 16
        : Math.round(Math.min(22, Math.max(15, frame.width * 0.014)));
    if (theme === "original")
      this.background = this.layer("daylight-background", -2, true);
    this.effects = this.layer("daylight-sky", 0.5);
    this.mask = document.createElement("canvas");
    this.mask.width = Math.ceil(frame.width);
    this.mask.height = Math.ceil(frame.height);
    const mask = this.mask.getContext("2d")!;
    this.maskReady =
      theme === "original" || scene.textures.exists("theme-sky-mask");
    if (theme === "original") {
      mask.fillStyle = "white";
      mask.fillRect(0, 0, frame.width, Math.min(frame.height, 733));
      mask.globalCompositeOperation = "destination-out";
      mask.beginPath();
      mask.moveTo(96, 322);
      mask.lineTo(544, 82);
      mask.lineTo(569, 82);
      mask.lineTo(1010, 322);
      mask.lineTo(1010, 740);
      mask.lineTo(96, 740);
      mask.closePath();
      mask.fill();
      // The chimney protrudes above the pitched roof.
      mask.fillRect(795, 122, 58, 121);
      mask.globalCompositeOperation = "source-over";
    } else if (this.maskReady) {
      mask.drawImage(
        scene.textures
          .get("theme-sky-mask")
          .getSourceImage() as CanvasImageSource,
        0,
        0,
        frame.width,
        frame.height,
      );
    }
    if (
      (theme === "tower" || artSettings.get(theme)?.atmosphereMask) &&
      this.maskReady &&
      scene.textures.exists("theme-atmosphere-mask")
    ) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(frame.width);
      canvas.height = Math.ceil(frame.height);
      this.atmosphere = {
        canvas,
        context: canvas.getContext("2d")!,
        mask: scene.textures
          .get("theme-atmosphere-mask")
          .getSourceImage() as CanvasImageSource,
      };
    }
    this.windowViews = this.makeWindowViews();
    this.crescent = this.makeCrescent();
    this.stars = this.makeStars();
    scene.events.once("shutdown", this.destroy, this);
  }

  private makeWindowViews(): MaskedAtmosphere | undefined {
    const settings = artSettings.get(this.theme);
    const windows = settings?.windows ?? WINDOW_VIEWS[this.theme];
    if (!windows || !this.scene.textures.exists("theme-house-day")) return;
    const mask = document.createElement("canvas");
    mask.width = Math.ceil(this.frame.width);
    mask.height = Math.ceil(this.frame.height);
    const context = mask.getContext("2d")!;
    if (settings?.windowMask && this.scene.textures.exists("theme-window-mask")) {
      context.drawImage(
        this.scene.textures.get("theme-window-mask").getSourceImage() as CanvasImageSource,
        0, 0, mask.width, mask.height,
      );
    } else {
      context.drawImage(
        this.scene.textures.get("theme-house-day").getSourceImage() as CanvasImageSource,
        0, 0, mask.width, mask.height,
      );
      const pixels = context.getImageData(0, 0, mask.width, mask.height);
      const native = settings?.frame ?? (this.theme === "tower" ? { width: 792, height: 1408 } : { width: 1408, height: 792 });
      for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
        const i = (y * mask.width + x) * 4;
        const nx = x * native.width / mask.width;
        const ny = y * native.height / mask.height;
        const inside = windows.some(([left, top, width, height]) =>
          nx >= left && nx < left + width && ny >= top && ny < top + height);
        const alpha = inside ? windowSkyOpacity(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]) : 0;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
        pixels.data[i + 3] = Math.round(alpha * 255);
      }
      context.putImageData(pixels, 0, 0);
    }
    const canvas = document.createElement("canvas");
    canvas.width = mask.width;
    canvas.height = mask.height;
    return { canvas, context: canvas.getContext("2d")!, mask };
  }

  private layer(name: string, depth: number, extended = false): CanvasLayer {
    const key = `${name}-${this.theme}-${nextSkyId++}`;
    const canvas = document.createElement("canvas");
    // A narrow, horizontally uniform texture covers the zoomed-out original
    // house without allocating a huge background canvas for every refresh.
    canvas.width = extended ? 32 : Math.ceil(this.frame.width);
    canvas.height = Math.ceil(this.frame.height * (extended ? 3 : 1));
    const context = canvas.getContext("2d")!;
    const texture = this.scene.textures.addCanvas(key, canvas);
    if (!texture) throw new Error("Could not create the daylight sky texture.");
    const image = this.scene.add
      .image(this.frame.x, this.frame.y, key)
      .setOrigin(0)
      .setDepth(depth)
      .setName(name);
    if (extended)
      image
        .setPosition(
          this.frame.x - this.frame.width * 2,
          this.frame.y - this.frame.height,
        )
        .setDisplaySize(this.frame.width * 5, this.frame.height * 3);
    return { key, canvas, context, texture, image };
  }

  private makeStars(): Star[] {
    let seed =
      this.theme === "tower"
        ? 923
        : this.theme === "ramen"
          ? 117
          : this.theme === "cabin"
            ? 561
            : 47;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const count =
      this.theme === "tower" ? 95 : this.theme === "ramen" ? 50 : 70;
    const horizon = celestialPosition(6, "sun", this.theme, this.frame).y;
    return Array.from({ length: count }, (_, index) => ({
      x: Math.round(18 + random() * (this.frame.width - 36)),
      y: Math.round(15 + random() * (horizon - 15)),
      radius: random() > 0.82 ? 1.3 : 0.65,
      alpha: 0.22 + random() * 0.46,
      cross: index % 17 === 0,
    }));
  }

  private makeCrescent(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    const r = this.radius;
    canvas.width = canvas.height = r * 4;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(r, r, r * 3, r * 3);
    gradient.addColorStop(0, "#fff6d8");
    gradient.addColorStop(1, "#dbe8e5");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(r * 2, r * 2, r, 0, Math.PI * 2);
    context.fill();
    // Cut transparent pixels from a separate glyph so no dark circle paints over the sky.
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(r * 2.38, r * 1.72, r * 0.96, 0, Math.PI * 2);
    context.fill();
    return canvas;
  }

  update(state: DaylightState): void {
    if (this.destroyed) return;
    const key = daylightRenderKey(state);
    if (key === this.lastKey) return;
    this.lastKey = key;
    if (this.background) {
      const { canvas, context, texture } = this.background;
      const gradient = context.createLinearGradient(
        0,
        this.frame.height,
        0,
        this.frame.height * 2,
      );
      const colors = skyColors(state);
      [0, 0.4, 0.72, 1].forEach((stop, index) =>
        gradient.addColorStop(stop, colors[index]),
      );
      context.fillStyle = colors[0];
      context.fillRect(0, 0, canvas.width, this.frame.height);
      context.fillStyle = gradient;
      context.fillRect(0, this.frame.height, canvas.width, this.frame.height);
      context.fillStyle = colors[3];
      context.fillRect(
        0,
        this.frame.height * 2,
        canvas.width,
        this.frame.height,
      );
      texture.refresh();
    }
    if (!this.maskReady) return;
    const { context, texture } = this.effects;
    context.clearRect(0, 0, this.frame.width, this.frame.height);
    if (!this.atmosphere) this.drawAtmosphere(context, state);
    this.drawStars(context, state);
    this.drawSun(context, state);
    this.drawMoon(context, state);
    context.globalCompositeOperation = "destination-in";
    context.drawImage(this.mask, 0, 0);
    context.globalCompositeOperation = "source-over";
    if (this.atmosphere) {
      const atmosphere = this.atmosphere;
      atmosphere.context.clearRect(0, 0, this.frame.width, this.frame.height);
      this.drawAtmosphere(atmosphere.context, state);
      atmosphere.context.globalCompositeOperation = "destination-in";
      atmosphere.context.drawImage(
        atmosphere.mask,
        0,
        0,
        this.frame.width,
        this.frame.height,
      );
      atmosphere.context.globalCompositeOperation = "source-over";
      // Clouds receive the twilight palette while still obscuring celestial
      // objects. Composite behind those objects without another GPU texture.
      context.globalCompositeOperation = "destination-over";
      context.drawImage(atmosphere.canvas, 0, 0);
      context.globalCompositeOperation = "source-over";
    }
    if (this.windowViews) {
      const windows = this.windowViews;
      windows.context.clearRect(0, 0, this.frame.width, this.frame.height);
      // Use precisely the same graded atmosphere as the surrounding sky, over
      // the existing cloud and landscape detail instead of replacing that view.
      this.drawAtmosphere(windows.context, state);
      windows.context.globalCompositeOperation = "destination-in";
      windows.context.drawImage(windows.mask, 0, 0);
      windows.context.globalCompositeOperation = "source-over";
      context.drawImage(windows.canvas, 0, 0);
    }
    this.drawRoomLight(context, state);
    texture.refresh();
  }

  private drawRoomLight(context: CanvasRenderingContext2D, state: DaylightState) {
    if (this.theme === "original" || state.warmth < 0.001) return;
    const settings = artSettings.get(this.theme);
    const sources = settings?.roomLights ?? (this.theme === "tower"
      ? [[397, 353, 135, 70], [405, 594, 133, 46], [408, 792, 147, 49], [406, 1013, 135, 47], [536, 1220, 82, 57]]
      : this.theme === "cabin"
        ? [[702, 275, 114, 39], [626, 457, 102, 48], [1054, 457, 90, 46], [626, 656, 103, 48], [1054, 656, 90, 46]]
        : [[460, 284, 102, 54], [855, 284, 104, 52], [1160, 696, 140, 40]]);
    const scaleX = this.frame.width / (settings?.frame?.width ?? (this.theme === "tower" ? 792 : 1408));
    const scaleY = this.frame.height / (settings?.frame?.height ?? (this.theme === "tower" ? 1408 : 792));
    // Soft reflected light stays within each room and reverses across the day.
    // Transparent edges avoid a rectangular wash across roofs or silhouettes.
    const direction = state.dawn > state.sunset ? 1 : -1;
    const color = direction > 0 ? "255,212,160" : "255,168,127";
    for (const [x, y, rx, ry] of sources) {
      context.save();
      context.translate((x + direction * rx * 0.18) * scaleX, y * scaleY);
      context.scale(rx * scaleX, ry * scaleY);
      const light = context.createRadialGradient(-direction * 0.3, -0.3, 0, 0, 0, 1);
      light.addColorStop(0, `rgba(${color},${state.warmth * 0.09})`);
      light.addColorStop(0.45, `rgba(${color},${state.warmth * 0.045})`);
      light.addColorStop(1, `rgba(${color},0)`);
      context.fillStyle = light;
      context.fillRect(-1, -1, 2, 2);
      context.restore();
    }
  }

  private drawAtmosphere(
    context: CanvasRenderingContext2D,
    state: DaylightState,
  ) {
    if (state.warmth < 0.001) return;
    const { width, height } = this.frame;
    // The illustrations expose much less sky than their full scene height.
    // Keep the colored horizon inside those gaps rather than behind the walls.
    const horizon =
      this.theme === "original"
        ? celestialPosition(6, "sun", this.theme, this.frame).y
        : this.theme === "tower"
          ? height * (950 / 1408)
          : height * ((this.theme === "ramen" ? 170 : 300) / 792);
    const sunset = state.sunset > state.dawn;
    if (this.theme !== "original") {
      const palette = sunset
        ? ["59,50,104", "129,78,132", "205,111,125", "242,158,105"]
        : ["120,115,166", "193,160,183", "245,194,166", "255,218,167"];
      const strength = sunset ? state.sunset : state.dawn;
      const alpha = sunset ? [0.5, 0.53, 0.6, 0.66] : [0.43, 0.48, 0.56, 0.62];
      const sky = context.createLinearGradient(0, 0, 0, horizon);
      [0, 0.3, 0.66, 1].forEach((stop, index) => {
        sky.addColorStop(
          stop,
          `rgba(${palette[index]},${alpha[index] * strength})`,
        );
      });
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);
    }
    const color = sunset ? "255,165,111" : "255,211,164";
    const wash = context.createLinearGradient(
      0,
      0,
      0,
      this.theme === "original" ? height : horizon,
    );
    wash.addColorStop(0, `rgba(${color},0)`);
    wash.addColorStop(0.28, `rgba(${color},0)`);
    wash.addColorStop(
      this.theme === "original" ? Math.min(0.82, horizon / height) : 0.85,
      `rgba(${color},${state.warmth * 0.12})`,
    );
    wash.addColorStop(1, `rgba(${color},0)`);
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);
    context.save();
    context.translate(width * (sunset ? 0.88 : 0.12), horizon);
    context.scale(1, 0.4);
    const radius = width * 0.6;
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius);
    glow.addColorStop(0, `rgba(${color},${state.warmth * 0.2})`);
    glow.addColorStop(0.4, `rgba(${color},${state.warmth * 0.08})`);
    glow.addColorStop(1, `rgba(${color},0)`);
    context.fillStyle = glow;
    context.fillRect(-radius, -radius, radius * 2, radius * 2);
    context.restore();
  }

  private drawStars(context: CanvasRenderingContext2D, state: DaylightState) {
    const opacity = state.weights.night;
    if (opacity < 0.01) return;
    for (const star of this.stars) {
      context.fillStyle = `rgba(223,237,226,${opacity * star.alpha})`;
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
      if (star.cross) {
        context.fillStyle = `rgba(223,237,226,${opacity * star.alpha * 0.35})`;
        context.fillRect(star.x - 2.5, star.y - 0.5, 5, 1);
        context.fillRect(star.x - 0.5, star.y - 2.5, 1, 5);
      }
    }
  }

  private halo(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
    opacity: number,
  ) {
    const glow = context.createRadialGradient(x, y, radius * 0.2, x, y, radius);
    glow.addColorStop(0, `rgba(${color},${opacity})`);
    glow.addColorStop(0.35, `rgba(${color},${opacity * 0.5})`);
    glow.addColorStop(1, `rgba(${color},0)`);
    context.fillStyle = glow;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  private drawSun(context: CanvasRenderingContext2D, state: DaylightState) {
    const sun = celestialPosition(state.hour, "sun", this.theme, this.frame);
    const alpha = sun.visibility * unit(state.daylight * 1.6);
    if (alpha < 0.001) return;
    const { x, y } = sun;
    const radius = this.radius;
    this.halo(context, x, y, radius * 3.4, "255,224,167", alpha * 0.12);
    context.save();
    context.globalAlpha = alpha;
    const disk = context.createRadialGradient(
      x - radius * 0.2,
      y - radius * 0.25,
      1,
      x,
      y,
      radius,
    );
    disk.addColorStop(0, "#fff5d0");
    disk.addColorStop(0.7, "#ffe9ae");
    disk.addColorStop(1, sun.elevation < 0.3 ? "#eabf7b" : "#f3d28e");
    context.fillStyle = disk;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  private drawMoon(context: CanvasRenderingContext2D, state: DaylightState) {
    const moon = celestialPosition(state.hour, "moon", this.theme, this.frame);
    const alpha = moon.visibility * state.moon;
    if (alpha < 0.001) return;
    this.halo(
      context,
      moon.x,
      moon.y,
      this.radius * 3.2,
      "204,225,223",
      alpha * 0.055,
    );
    context.save();
    context.globalAlpha = alpha;
    context.drawImage(
      this.crescent,
      moon.x - this.radius * 2,
      moon.y - this.radius * 2,
    );
    context.restore();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off("shutdown", this.destroy, this);
    for (const layer of [this.effects, this.background]) {
      if (!layer) continue;
      layer.image.destroy();
      this.scene.textures.remove(layer.key);
    }
    this.mask.width = this.mask.height = 0;
    this.crescent.width = this.crescent.height = 0;
    if (this.atmosphere) {
      this.atmosphere.canvas.width = this.atmosphere.canvas.height = 0;
      this.atmosphere = undefined;
    }
    if (this.windowViews) {
      this.windowViews.canvas.width = this.windowViews.canvas.height = 0;
      const mask = this.windowViews.mask as HTMLCanvasElement;
      mask.width = mask.height = 0;
      this.windowViews = undefined;
    }
  }
}
