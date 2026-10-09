"""Package only the built web app and license notices, then verify the archive."""
from pathlib import Path
import hashlib
import zipfile

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
if not (dist / "index.html").is_file():
    raise SystemExit("Run npm run build first.")
output = root / "release"
output.mkdir(exist_ok=True)
archive = output / "kitty-house-web.zip"
files = {p.relative_to(dist).as_posix(): p.read_bytes() for p in dist.rglob("*") if p.is_file()}
for name in ["LICENSE", "THIRD_PARTY_ASSETS.md", "THIRD_PARTY_NOTICES.md", "VERSION"]:
    files[name] = (root / name).read_bytes()
files["START_HERE.txt"] = (
    "Kitty House\n\nExtract this archive and serve the directory containing index.html\n"
    "with a static HTTP server. With Python installed, run:\n\n"
    "  python -m http.server 8080 --bind 127.0.0.1\n\n"
    "Then open http://127.0.0.1:8080/ in your browser.\n"
    "Do not open index.html directly using a file:// URL.\n"
    "Layouts and cat rosters stay in this browser and origin.\n\n"
    "Source and instructions: https://github.com/wcbuttons/Kitty-House-Public\n"
).encode()
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(files.items()):
        entry = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        z.writestr(entry, data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert set(z.namelist()) == set(files)
    for name, data in files.items():
        assert z.read(name) == data, name
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / "SHA256SUMS.txt").write_text(f"{checksum}  {archive.name}\n", encoding="ascii")
print(f"Verified {len(files)} files in {archive.name}; SHA-256 {checksum}")
