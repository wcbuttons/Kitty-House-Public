# Hosting Kitty House

The compiled application is static. Serve the contents of `dist/` over HTTP(S), at the site root or beneath a subdirectory. There is no application server, database, account system, or background worker.

Use a real static host for a public deployment. `npm run preview` and Python's simple HTTP server are convenient local checks. An iframe can embed a hosted copy; third-party browser storage rules may prevent saves inside an iframe.

## Caching and upgrades

Runtime artwork has stable filenames across releases. Revalidate app files (`Cache-Control: no-cache`) or use a versioned deployment directory so old artwork is not retained after an upgrade. Serve JavaScript and CSS with correct MIME types, and return 404 for missing assets. If using a subdirectory, redirect its slashless URL to the version with a trailing slash, preserving query parameters.

Build with `VITE_DEFAULT_HOUSE` if desired. This value is compiled into the app; changing a server environment variable after building does not change it.

## Release workflow

The GitHub Actions validation workflow checks types, unit tests, browser tests, and a production build. Publishing a tag beginning with `v` runs the release workflow and uploads `kitty-house-web.zip` and `SHA256SUMS.txt` only after those checks pass. GitHub also provides source archives for the tag. Tag only reviewed source, and retain fixed tags for reproducible upgrades.

Operators should record the public repository tag and full commit SHA in their own deployment repository. Download the release archive, verify its checksum, stage it, then switch the web server to the staged build using that installation's normal procedure. Keep the previous build for rollback. Do not copy private server configuration, credentials, backups, or deployment history into this application repository.

Keep the same origin when upgrading to preserve browser saves. Copying server files does not copy visitors' localStorage, and changing the domain or port starts a separate save space.
