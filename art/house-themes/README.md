# Editable house artwork

This directory contains layered Aseprite masters, source plates, and furniture imagery for the illustrated homes. The original Little House is drawn in application code. Final exported PNGs are already included under `public/assets/houses/`, so Aseprite is optional for normal builds.

To regenerate artwork, install Aseprite, set `ASEPRITE_BIN` to its executable path, and run from the repository root:

```sh
npm run build:art
npm run build
```

The scripts regenerate native masters as well as PNG exports. Preserve hand-edited masters separately before running them. `npm run build:art:v2` rebuilds only Mountain Cabin and Cat Cafe. Source generation prompts and local workstation records are not needed by this offline pipeline and are not part of this distribution.

Cabin, ramen, and the later homes use 1408×792 artwork. Moonwhisker Tower uses 792×1408. Day and night layers must share geometry. Masks keep sky, moving sun/moon, stars, and lighting behind the buildings. Furniture sprites use three source pixels per logical world pixel. Room and navigation geometry live in `src/house-theme.ts`, `src/cabin-v2.ts`, and `src/ramen-v2.ts`.

For manual editing, open a native `.aseprite` document and retain the layer boundaries and dimensions. The Lua scripts in `tools/house-art/` document alignment and export details. Artwork attribution is in the root `THIRD_PARTY_ASSETS.md`.
