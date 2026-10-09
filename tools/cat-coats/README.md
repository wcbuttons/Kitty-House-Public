# Reproduce the additional cat coats

The runtime PNGs are committed; no asset tools are required to run Little House.

This optional generator uses the original CC0 sprites and deterministic palette substitutions. Install its separate dependencies with `npm install` in this directory, then provide explicit source and output paths:

```sh
node generate-coats.cjs ../../public/assets/cats /path/to/separate/output
```

The output directory must be outside the source asset directory. The source originals are never changed. Dependencies resolve normally, or through an explicit `CAT_ASSET_NODE_MODULES` path to an existing installation of pngjs 7.0.0 and sharp 0.35.4.

Review the generated PNGs before copying Cat-7 through Cat-18 into the app. `docs/cat-assets/` contains the integrated asset manifest, recipes, contact sheets and verification evidence. Cat-9 and Cat-17 preserve their source family's 11 available animations; the other new coats have 12. All animations used by the app are present in every family.
