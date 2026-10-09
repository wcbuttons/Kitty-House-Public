const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const aseprite = process.env.ASEPRITE_BIN || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite');
if (!fs.existsSync(aseprite)) throw Error('Set ASEPRITE_BIN to the Aseprite executable.');
const result = spawnSync(aseprite, ['-b', '--noinapp', '--script-param', `root=${root}`, '--script', path.join(__dirname, 'daylight.lua')], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
