import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("make_manifest", ROOT / "scripts" / "make_manifest.py")
manifest = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(manifest)


class ManifestTests(unittest.TestCase):
    def test_inventory_skips_build_artifacts_secrets_and_raw_climate_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "keep.txt").write_bytes(b"alpha\r\n")
            (root / "node_modules").mkdir()
            (root / "node_modules" / "pkg.js").write_text("skip", encoding="utf-8")
            (root / "dist").mkdir()
            (root / "dist" / "app.js").write_text("skip", encoding="utf-8")
            (root / "CLIMATERISK").mkdir()
            (root / "CLIMATERISK" / "raw.xlsx").write_bytes(b"skip")
            (root / "data" / "public").mkdir(parents=True)
            (root / "data" / "public" / "brief.pdf").write_bytes(b"skip")
            (root / "frontend" / "public").mkdir(parents=True)
            (root / "frontend" / "public" / "keep.json").write_text("{}\n", encoding="utf-8")
            (root / ".env").write_text("TOKEN=secret\n", encoding="utf-8")
            (root / "credentials.json").write_text("{}", encoding="utf-8")
            (root / "MANIFEST.json").write_text("{}\n", encoding="utf-8")
            (root / "SHA256SUMS.txt").write_text("abc  old\n", encoding="utf-8")
            paths = [item["path"] for item in manifest.file_records(root)]
            self.assertEqual(paths, ["frontend/public/keep.json", "keep.txt"])
            same = root / "lf.txt"
            same.write_bytes(b"alpha\n")
            self.assertEqual(manifest.sha256(root / "keep.txt"), manifest.sha256(same))

    def test_check_mode_reports_paths_without_rewriting_or_dumping_hashes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "one.txt").write_text("one\n", encoding="utf-8", newline="\n")
            records = manifest.file_records(root)
            summary = {"project": "fixture", "file_count_excluding_manifest": len(records)}
            expected_manifest = manifest.render_manifest(records, summary)
            expected_checksums = manifest.render_checksums(records)
            manifest.write_repository(root, expected_manifest, expected_checksums)
            before = (root / "MANIFEST.json").read_bytes()
            self.assertNotIn(b"\r", before)
            code = manifest.check_repository(root, expected_manifest, expected_checksums)
            self.assertEqual(code, 0)
            self.assertEqual((root / "MANIFEST.json").read_bytes(), before)

            (root / "two.txt").write_text("two\n", encoding="utf-8", newline="\n")
            (root / "one.txt").write_text("changed\n", encoding="utf-8", newline="\n")
            updated = manifest.file_records(root)
            stale_manifest = manifest.render_manifest(
                updated,
                {**summary, "file_count_excluding_manifest": len(updated)},
            )
            code, message = manifest.evaluate(
                stale_manifest,
                manifest.render_checksums(updated),
                before.decode("utf-8"),
                (root / "SHA256SUMS.txt").read_text(encoding="utf-8"),
            )
            self.assertEqual(code, 1)
            self.assertIn("MANIFEST.json / SHA256SUMS.txt are stale.", message)
            self.assertIn("Run: python scripts/make_manifest.py", message)
            self.assertIn("two.txt", message)
            self.assertIn("one.txt", message)
            self.assertFalse(any(item["sha256"] in message for item in updated))
            self.assertEqual((root / "MANIFEST.json").read_bytes(), before)

    def test_crlf_committed_files_match_lf_generation(self):
        expected = "abc  keep.txt\n"
        actual = "abc  keep.txt\r\n"
        text = json.dumps({"files": []}) + "\n"
        code, message = manifest.evaluate(text, expected, text.replace("\n", "\r\n"), actual)
        self.assertEqual(code, 0)
        self.assertEqual(message, "")

    def test_metadata_difference_is_reported_without_checksum_lines(self):
        expected = "abc  keep.txt\n"
        current = json.dumps({"files": []}) + "\n"
        other = json.dumps({"files": [], "extra": 1}) + "\n"
        code, message = manifest.evaluate(current, expected, other, expected)
        self.assertEqual(code, 1)
        self.assertIn("metadata differs", message)
        self.assertNotIn("abc  keep.txt", message)


if __name__ == "__main__":
    unittest.main()
