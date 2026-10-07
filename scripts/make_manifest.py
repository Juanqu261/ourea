"""Create the Ourea reproducibility manifest."""
from __future__ import annotations

from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "MANIFEST.json"
CHECKSUMS = ROOT / "SHA256SUMS.txt"


def include(path: Path) -> bool:
    if not path.is_file():
        return False
    relative = path.relative_to(ROOT)
    if any(
        part in {
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
        }
        for part in relative.parts
    ):
        return False
    if path.name.startswith(".env") and path.name != ".env.example":
        return False
    if path.suffix == ".local":
        return False
    if ".vercel" in relative.parts:
        return False
    return path not in {MANIFEST, CHECKSUMS}


def canonical_bytes(path: Path) -> bytes:
    data = path.read_bytes()
    if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"} or b"\0" in data:
        return data
    return data.replace(b"\r\n", b"\n")


def sha256(path: Path) -> str:
    return hashlib.sha256(canonical_bytes(path)).hexdigest()


def load_json(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def main() -> None:
    files = sorted(
        (path for path in ROOT.rglob("*") if include(path)),
        key=lambda path: str(path.relative_to(ROOT)),
    )
    hashes = [
        {
            "path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "bytes": len(canonical_bytes(path)),
            "sha256": sha256(path),
        }
        for path in files
    ]
    package = load_json("frontend/package.json")
    interventions = load_json("frontend/public/data/cornare/interventions.json")
    parameters = load_json("frontend/public/data/cornare/decision_model.json")
    guardrails = load_json("frontend/src/config/scientificGuardrails.json")
    manifest = {
        "project": "Ourea",
        "package_version": package["version"],
        "manifest_date": "2026-10-07",
        "decision": "CORNARE adaptation portfolio for Rionegro, Guarne and Marinilla",
        "budget_million_cop": parameters["budget_million_cop"],
        "catalogue_measures": len(interventions["interventions"]),
        "catalogue_total_million_cop": interventions["catalogue_total_million_cop"],
        "guardrails": len(guardrails["items"]),
        "file_count_excluding_manifest": len(hashes),
        "files": hashes,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    CHECKSUMS.write_text(
        "".join(f'{item["sha256"]}  {item["path"]}\n' for item in hashes),
        encoding="utf-8",
    )
    print(f"Wrote Ourea manifest/checksums for {len(hashes)} files.")


if __name__ == "__main__":
    main()
