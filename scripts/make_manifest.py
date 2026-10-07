"""Create or check the Ourea reproducibility manifest."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "MANIFEST.json"
CHECKSUMS = ROOT / "SHA256SUMS.txt"
STALE_MESSAGE = (
    "MANIFEST.json / SHA256SUMS.txt are stale.\n"
    "Run: python scripts/make_manifest.py"
)
SKIP_PARTS = {
    "__pycache__",
    "node_modules",
    "dist",
    ".git",
    ".venv",
    "venv",
    ".cursor",
    ".idea",
    ".vscode",
    ".pytest_cache",
    "playwright-report",
    "test-results",
    "blob-report",
    ".cache",
    "CLIMATERISK",
    "__MACOSX",
    "var",
}
SECRET_NAMES = {"credentials.json", "secrets.json"}
SECRET_SUFFIXES = {".pem", ".key", ".p12", ".local"}


def include(root: Path, path: Path) -> bool:
    if not path.is_file():
        return False
    relative = path.relative_to(root)
    if any(part in SKIP_PARTS for part in relative.parts):
        return False
    if relative.parts[:2] == ("data", "public"):
        return False
    if ".vercel" in relative.parts:
        return False
    if path.name in SECRET_NAMES or path.suffix in SECRET_SUFFIXES:
        return False
    if path.name.startswith(".env") and path.name != ".env.example":
        return False
    if path.name in {".DS_Store", "Thumbs.db"}:
        return False
    return path not in {root / "MANIFEST.json", root / "SHA256SUMS.txt"}


def canonical_bytes(path: Path) -> bytes:
    data = path.read_bytes()
    if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"} or b"\0" in data:
        return data
    return data.replace(b"\r\n", b"\n")


def sha256(path: Path) -> str:
    return hashlib.sha256(canonical_bytes(path)).hexdigest()


def file_records(root: Path) -> list[dict]:
    files = sorted(
        (path for path in root.rglob("*") if include(root, path)),
        key=lambda path: path.relative_to(root).as_posix(),
    )
    return [
        {
            "path": path.relative_to(root).as_posix(),
            "bytes": len(canonical_bytes(path)),
            "sha256": sha256(path),
        }
        for path in files
    ]


def load_json(root: Path, relative: str):
    return json.loads((root / relative).read_text(encoding="utf-8"))


def project_summary(root: Path, records: list[dict]) -> dict:
    package = load_json(root, "frontend/package.json")
    interventions = load_json(root, "frontend/public/data/cornare/interventions.json")
    parameters = load_json(root, "frontend/public/data/cornare/decision_model.json")
    guardrails = load_json(root, "frontend/src/config/scientificGuardrails.json")
    return {
        "project": "Ourea",
        "package_version": package["version"],
        "manifest_date": "2026-10-07",
        "decision": "CORNARE adaptation portfolio for Rionegro, Guarne and Marinilla",
        "budget_million_cop": parameters["budget_million_cop"],
        "catalogue_measures": len(interventions["interventions"]),
        "catalogue_total_million_cop": interventions["catalogue_total_million_cop"],
        "guardrails": len(guardrails["items"]),
        "file_count_excluding_manifest": len(records),
    }


def render_manifest(records: list[dict], summary: dict) -> str:
    manifest = {**summary, "files": records}
    return json.dumps(manifest, indent=2) + "\n"


def render_checksums(records: list[dict]) -> str:
    return "".join(f'{item["sha256"]}  {item["path"]}\n' for item in records)


def parse_checksums(text: str) -> dict[str, str]:
    found = {}
    for line in text.replace("\r\n", "\n").splitlines():
        if not line.strip():
            continue
        digest, path = line.split("  ", 1)
        found[path] = digest
    return found


def checksum_diff(expected: str, actual: str) -> tuple[list[str], list[str], list[str]]:
    wanted = parse_checksums(expected)
    current = parse_checksums(actual)
    added = sorted(set(wanted) - set(current))
    removed = sorted(set(current) - set(wanted))
    changed = sorted(path for path in wanted.keys() & current.keys() if wanted[path] != current[path])
    return added, removed, changed


def stale_message(added: list[str], removed: list[str], changed: list[str], verbose: bool = False, expected: str = "") -> str:
    lines = [STALE_MESSAGE, ""]
    if added:
        lines.append("Added:")
        lines.extend(f"  {path}" for path in added)
    if removed:
        lines.append("Removed:")
        lines.extend(f"  {path}" for path in removed)
    if changed:
        lines.append("Changed:")
        lines.extend(f"  {path}" for path in changed)
    if not added and not removed and not changed:
        lines.append("MANIFEST.json metadata differs from the checksum list.")
    if verbose and expected:
        lines.append("")
        lines.append(expected.rstrip("\n"))
    return "\n".join(lines).rstrip() + "\n"


def evaluate(expected_manifest: str, expected_checksums: str, actual_manifest: str, actual_checksums: str, verbose: bool = False) -> tuple[int, str]:
    actual_manifest = actual_manifest.replace("\r\n", "\n")
    actual_checksums = actual_checksums.replace("\r\n", "\n")
    added, removed, changed = checksum_diff(expected_checksums, actual_checksums)
    metadata_differs = json.loads(expected_manifest) != json.loads(actual_manifest)
    if not added and not removed and not changed and not metadata_differs:
        return 0, ""
    return 1, stale_message(added, removed, changed, verbose=verbose, expected=expected_checksums)


def read_normalized(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


def check_repository(root: Path, expected_manifest: str, expected_checksums: str, verbose: bool = False) -> int:
    manifest_path = root / "MANIFEST.json"
    checksum_path = root / "SHA256SUMS.txt"
    missing = [name for name, path in (("MANIFEST.json", manifest_path), ("SHA256SUMS.txt", checksum_path)) if not path.is_file()]
    if missing:
        print(STALE_MESSAGE)
        print("Missing: " + ", ".join(missing))
        return 1
    code, message = evaluate(
        expected_manifest,
        expected_checksums,
        read_normalized(manifest_path),
        read_normalized(checksum_path),
        verbose=verbose,
    )
    if code != 0:
        print(message, end="")
    else:
        count = expected_checksums.count("\n")
        print(f"Manifest and checksums are current ({count} files).")
    return code


def write_repository(root: Path, manifest_text: str, checksum_text: str) -> None:
    (root / "MANIFEST.json").write_text(manifest_text, encoding="utf-8", newline="\n")
    (root / "SHA256SUMS.txt").write_text(checksum_text, encoding="utf-8", newline="\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write or check MANIFEST.json and SHA256SUMS.txt")
    parser.add_argument("--check", action="store_true", help="Compare the committed files without modifying them")
    parser.add_argument("--verbose", action="store_true", help="Print the full expected checksum list when stale")
    args = parser.parse_args(argv)
    records = file_records(ROOT)
    manifest_text = render_manifest(records, project_summary(ROOT, records))
    checksum_text = render_checksums(records)
    if args.check:
        return check_repository(ROOT, manifest_text, checksum_text, verbose=args.verbose)
    write_repository(ROOT, manifest_text, checksum_text)
    print(f"Wrote Ourea manifest/checksums for {len(records)} files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
