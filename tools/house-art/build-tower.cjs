const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "../..");
const aseprite =
  process.env.ASEPRITE_BIN ||
  path.join(
    os.homedir(),
    "Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite",
  );
if (!fs.existsSync(aseprite))
  throw Error("Set ASEPRITE_BIN to the Aseprite executable.");
const output = esbuild.buildSync({
  stdin: {
    contents:
      "export {TOWER_CATALOG} from './src/model'; export {THEMES} from './src/house-theme';",
    resolveDir: root,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
}).outputFiles[0].text;
const moduleData = { exports: {} };
new Function("module", "exports", "window", output)(
  moduleData,
  moduleData.exports,
  { localStorage: { getItem: () => "tower" } },
);
const manifest = {
  catalog: moduleData.exports.TOWER_CATALOG,
  theme: moduleData.exports.THEMES.find((theme) => theme.id === "tower"),
};
fs.writeFileSync(
  path.join(__dirname, "tower-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
for (const folder of [
  "art/house-themes",
  "public/assets/houses/furniture",
  "public/assets/houses/tower",
])
  fs.mkdirSync(path.join(root, folder), { recursive: true });
const args = ["-b", "--noinapp", "--script-param", `root=${root}`];
if (process.argv.includes("--background-only"))
  args.push("--script-param", "backgroundOnly=true");
args.push("--script", path.join(__dirname, "tower.lua"));
const result = spawnSync(aseprite, args, { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);
