const path = require('node:path');
const { spawnSync } = require('node:child_process');

// V2 worlds are independent native sources and exports; no V1 raster is an input.
for (const file of ['build-cabin-v2.cjs', 'build-ramen-v2.cjs']) {
  const built = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  if (built.status !== 0) process.exit(built.status || 1);
}
