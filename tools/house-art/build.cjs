const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '../..');
const aseprite = process.env.ASEPRITE_BIN || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite');
if (!fs.existsSync(aseprite)) throw Error('Set ASEPRITE_BIN to the Aseprite executable.');
const output = esbuild.buildSync({
  stdin: { contents: "export {CATALOG} from './src/model'; export {THEMES} from './src/house-theme';", resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs',
}).outputFiles[0].text;
const moduleData = { exports: {} };
new Function('module', 'exports', 'window', output)(moduleData, moduleData.exports, { localStorage: { getItem: () => 'ramen' } });
const manifest = { catalog: moduleData.exports.CATALOG, themes: moduleData.exports.THEMES.filter(theme => theme.id === 'cabin' || theme.id === 'ramen') };
fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const folder of ['art/house-themes', 'public/assets/houses/furniture', 'public/assets/houses/cabin', 'public/assets/houses/ramen']) fs.mkdirSync(path.join(root, folder), { recursive: true });
const result = spawnSync(aseprite, ['-b', '--noinapp', '--script-param', `root=${root}`, '--script', path.join(__dirname, 'build.lua')], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
for (const script of ['build-daylight.cjs', 'build-tower.cjs', 'build-v2.cjs']) {
  const extra = path.join(__dirname, script);
  if (!fs.existsSync(extra)) continue;
  const built = spawnSync(process.execPath, [extra], { stdio: 'inherit' });
  if (built.status !== 0) process.exit(built.status || 1);
}
