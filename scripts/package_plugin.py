"""Build the Decky install ZIP from a checked-out tree and pnpm build output."""

import hashlib
import json
import stat
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def package_plugin():
    metadata = json.loads((ROOT / "package.json").read_text())
    name = metadata["name"]
    required = [ROOT / "dist/index.js", ROOT / "defaults/python/ssl/moondeck_cert.pem"]
    for path in required:
        if not path.is_file():
            raise SystemExit(f"Missing {path.relative_to(ROOT)}; build frontend and initialize git submodules first.")
    files = [(ROOT / path, path) for path in ("main.py", "plugin.json", "package.json", "LICENSE", "README.md")]
    files.append((ROOT / "dist/index.js", "dist/index.js"))
    for path in (ROOT / "defaults").rglob("*"):
        if not path.is_file() or "__pycache__" in path.parts or ".git" in path.parts or path.suffix == ".pyc":
            continue
        relative = path.relative_to(ROOT / "defaults")
        if "ssl" in relative.parts and path.name != "moondeck_cert.pem":
            continue
        files.append((path, relative.as_posix()))
    destination = ROOT / "out" / f"{name}.zip"
    destination.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for source, target in sorted(files, key=lambda item: item[1]):
            info = zipfile.ZipInfo(f"{name}/{target}", (2026, 1, 1, 0, 0, 0))
            executable = source.suffix == ".sh" or bool(source.stat().st_mode & stat.S_IXUSR)
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | (0o755 if executable else 0o644)) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, source.read_bytes())
    checksum = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix(".zip.sha256").write_text(f"{checksum}  {destination.name}\n")
    print(f"Created {destination} ({destination.stat().st_size:,} bytes)\nSHA256 {checksum}")


if __name__ == "__main__":
    package_plugin()
