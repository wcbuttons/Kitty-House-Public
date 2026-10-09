# First public application release

Kitty House includes six homes, 18 cat coat choices, autonomous cat behavior, furniture editing, browser saves, fullscreen viewing, and day/night lighting.

This is the public packaging of application version 0.9.0+5. It starts a fresh application-only Git history and includes generic setup documentation, an MIT license, CC0 cat attribution, editable artwork, tests, and automated build/release workflows. A transitive build dependency was updated to address its published source-map parsing advisory.

Download `kitty-house-web.zip` for the built application and `SHA256SUMS.txt` to verify it. Extract the ZIP and serve it over HTTP(S); the included `START_HERE.txt` gives a local Python example. GitHub's source archives contain the editable project and require Node.js to build.

The default home is Little House. Saved layouts belong to each browser and site origin. Live lighting uses America/Chicago; manual time is available. This release does not provide cloud saves, multiplayer, or a backend service.
