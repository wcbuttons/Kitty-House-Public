# First public application release

Kitty House includes six homes, 18 cat coat choices, autonomous cat behavior, furniture editing, browser saves, fullscreen viewing, and day/night lighting.

This is the public packaging of application version 0.9.0+5. It starts a fresh application-only Git history and includes generic setup documentation, an MIT license, CC0 cat attribution, editable artwork, tests, and automated build/release workflows. A transitive build dependency was updated to address its published source-map parsing advisory.

Download `kitty-house-web.zip` for the built application and `SHA256SUMS.txt` to verify it. Extract the ZIP and serve it over HTTP(S); the included `START_HERE.txt` gives a local Python example. GitHub's source archives contain the editable project and require Node.js to build.

The default home is Little House. Saved layouts belong to each browser and site origin. Live lighting uses America/Chicago; manual time is available. This release does not provide cloud saves, multiplayer, or a backend service.
# Kitty House V2

Version 2.0.2 uses quieter recordings with distinct, recognizable sounds and caps the player output at half its previous level for the same saved volume setting.

Version 2.0.1 uses six licensed field recordings for the audio loops. Sources, licenses and editing notes are included with the [recordings](../public/assets/ambience/credits.txt).

- Cats investigate new spots, stretch after naps, and vary their play. Jump and landing poses follow movement progress.
- Fullscreen adds a motion pause and a bookmarkable house-only view with `?ambient=1`.
- Six optional soundscapes loop continuously with volume control. Outdoor rain, woodland lights and starlight respect reduced-motion settings.
- The renderer shares sprite sheets across poses and reuses cached daylight and overlays. The simulation indexes navigation surfaces and reuses route-distance calculations.
- Existing layouts, resident rosters, and time preferences remain compatible.

