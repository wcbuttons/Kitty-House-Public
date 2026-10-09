# Kitty House

A browser dollhouse with six selectable homes and autonomous cats. Rearrange furniture to change where cats walk, jump, perch, play, and rest.

This repository contains the reusable application, local artwork, editable art sources, and tests. It does not require an account, application backend, database, API key, or external asset service.

## Download and run

Download **kitty-house-web.zip** from [Releases](https://github.com/wcbuttons/Kitty-House-Public/releases/latest), extract it, and serve the extracted directory with a static HTTP server. For example, if Python is installed:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Open http://127.0.0.1:8080/. Run that command from the directory containing `index.html`. Opening `index.html` directly with a `file://` URL is not supported. The archive contains the compiled app and all runtime artwork; Node.js is not required to serve it.

For the source, choose **Code → Download ZIP**, or clone this repository. Release downloads include SHA-256 checksums.

## Develop from source

Install Node.js 22.12+ and npm, then:

```sh
git clone https://github.com/wcbuttons/Kitty-House-Public.git
cd Kitty-House-Public
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. Development binds to localhost. To build and preview:

```sh
npm run build
npm run preview
```

Open http://127.0.0.1:4173/. To test from another device on your network, run `npm run serve:lan` and use the Network address printed in the terminal. This listens on all interfaces at port 4174; keep the terminal running and allow access only on networks you trust.

## Features and saves

- Little House, Woodland Cabin, Neko Ramen, Moonwhisker Tower, Mountain Cabin, and Cat Cafe.
- Furniture placement, undo/redo, connected rooms, autonomous cat behavior, and 18 coat choices.
- Fullscreen viewing and smoothly changing day/night artwork.
- Layouts, cat rosters, selected home, and time preferences stored in this browser.

Saves belong to the browser and site origin. Different domains, ports, browsers, and devices have separate saves; there is no cloud synchronization. Cat positions and moment-to-moment activity are not persisted. The live lighting clock currently follows `America/Chicago`; the time slider supports manual lighting on every host.

Read the [user and development guide](docs/USER_GUIDE.md) for controls, architecture, and adding content.

## Host your own copy

Run `npm run build` and upload the **contents of `dist/`** to any static HTTP(S) host. Relative asset URLs support a root URL or subdirectory such as `/kitty-house/`. Docker, Caddy, and any particular domain are optional.

Choose a first-visit home by placing this in `.env.local` before building:

```dotenv
VITE_DEFAULT_HOUSE=ramen
```

Supported values: `original`, `cabin`, `ramen`, `tower`, `cabin-v2`, and `ramen-v2`. The last two are Mountain Cabin and Cat Cafe. An existing saved selection takes precedence. Omit the setting to default to Little House. Rebuild after changing it.

See [hosting guidance](docs/HOSTING.md). A build only creates local files; it does not publish or update a server.

## Verify changes

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Browser tests use their own profiles. For a running preview, set `DEMO_URL` to its URL before running them. Test screenshots and reports are generated locally and are not release inputs.

## Artwork and licensing

Runtime artwork is included in `public/assets/`. Editable Aseprite masters and source plates are in `art/house-themes/`; [artwork instructions](art/house-themes/README.md) explain the optional build pipeline. Aseprite is not required to build or run the application.

Project code, documentation, and project-created artwork are offered under the [MIT license](LICENSE), to the extent the contributors hold applicable rights. The original cat sprites and their derived coats retain CC0 terms. Third-party packages retain their own licenses. See [asset attribution](THIRD_PARTY_ASSETS.md) and [dependency notices](THIRD_PARTY_NOTICES.md).

The first public release packages the existing 0.9.0+5 application with a fresh public history. Application development belongs here; installation-specific operations belong in each operator's deployment repository.
