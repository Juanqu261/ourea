"""Evidence auditor: the real export bundle is clean; seeded bad bundles are each flagged."""

import contextlib
import copy
import io
import importlib.util
import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from services.decision_ai.audit import checks  # noqa: E402

NODE = shutil.which("node")
HAS_LANGGRAPH = importlib.util.find_spec("langgraph") is not None
W0 = "ourea-42aeaba8"

CLEAN = {
    "products": [
        {"id": "P1", "claims": [
            {"text": "Con COP 5.000 millones compiten las medidas del corredor.", "numbers": [5000], "label": "Dato institucional", "source_id": "reto-brief-2026"},
            {"text": "Puntaje institucional verificado del portafolio: 2,81.", "numbers": [2.8125], "label": "Inferencia del equipo", "fingerprint": W0},
        ]},
        {"id": "P2", "claims": [
            {"text": "Exigir infraestructura gris baja el puntaje institucional a 2,38.", "numbers": [2.38], "label": "Inferencia del equipo", "fingerprint": W0},
        ]},
        {"id": "P3", "claims": [
            {"text": "Seleccionar una medida no equivale a un porcentaje de reducción de la vulnerabilidad.", "label": "Inferencia del equipo"},
        ]},
    ],
}


def seeded(claim: dict) -> dict:
    bundle = copy.deepcopy(CLEAN)
    bundle["products"][1]["claims"].append(claim)
    return bundle


class DeterministicAuditTests(unittest.TestCase):
    def test_clean_bundle(self):
        report = checks.run(CLEAN)
        self.assertEqual(report["critical"], 0, report["findings"])
        self.assertEqual(report["verified_claims"], 3)
        self.assertTrue(report["export_allowed"])

    def test_seeded_bad_bundles(self):
        cases = {
            "fake number": ({"text": "El puntaje sube a 3,40.", "numbers": [3.4], "label": "Inferencia del equipo", "fingerprint": W0}, "numbers", "critical"),
            "number without label": ({"text": "El puntaje es 2,81.", "numbers": [2.8125], "fingerprint": W0}, "labels", "critical"),
            "number without citation": ({"text": "Usa 4.700 millones.", "numbers": [4700], "label": "Supuesto"}, "numbers", "critical"),
            "avoided losses": ({"text": "El portafolio deja pérdidas evitadas en el corredor.", "label": "Inferencia del equipo"}, "forbidden", "critical"),
            "synthetic record": ({"text": "Organización SINTÉTICA depende de la quebrada.", "label": "Supuesto"}, "synthetic", "critical"),
            "identifiable company": ({"text": "Flores X S.A.S. depende de la vía.", "label": "Supuesto"}, "identities", "critical"),
            "fixture fingerprint": ({"text": "El puntaje es 2,81.", "numbers": [2.8125], "label": "Inferencia del equipo", "fingerprint": "fixture-abc"}, "fixtures", "critical"),
            "institutional from open data": ({"text": "El relieve del corredor.", "label": "Dato institucional", "source_id": "gis-openfreemap"}, "sources", "major"),
            "unknown source": ({"text": "Dato del portal.", "label": "Dato institucional", "source_id": "portal-x"}, "sources", "critical"),
            "map layer as site": ({"text": "El sitio de la restauración es este humedal.", "label": "Dato institucional", "source_id": "gis-wetlands"}, "sources", "major"),
        }
        for name, (claim, check, severity) in cases.items():
            with self.subTest(case=name):
                report = checks.run(seeded(claim))
                hits = [f for f in report["findings"] if f["check"] == check and f["severity"] == severity]
                self.assertTrue(hits, report["findings"])
                if severity == "critical":
                    self.assertFalse(report["export_allowed"])

    def test_synthetic_records_block_export(self):
        report = checks.run(CLEAN | {"records": [{"provenance": "synthetic_demo"}]})
        self.assertFalse(report["export_allowed"])

    def test_cli_exit_code(self):
        from services.decision_ai.audit.__main__ import main

        path = ROOT / "tests" / "fixtures" / "ai" / "seeded_bad_bundle.json"
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(main([str(path)]), 1)


@unittest.skipUnless(NODE, "node is not installed")
class ExportBundleTests(unittest.TestCase):
    """The bundle the browser exports (products.js) passes its own audit."""

    def test_browser_bundle_is_clean(self):
        completed = subprocess.run([NODE, str(ROOT / "tests" / "js" / "audit_bundle.mjs")], capture_output=True, text=True,
                                   encoding="utf-8", check=True)
        bundle = json.loads(completed.stdout)
        self.assertEqual([product["id"] for product in bundle["products"]], ["P1", "P2", "P3"])
        report = checks.run(bundle)
        self.assertEqual(report["critical"], 0, report["findings"])
        self.assertEqual(report["major"], 0, report["findings"])
        self.assertGreaterEqual(report["verified_claims"], 8)


@unittest.skipUnless(HAS_LANGGRAPH, "requirements-ai.txt not installed")
class LlmAuditorTests(unittest.TestCase):
    def test_non_verbatim_quotes_are_dropped(self):
        from ai_fakes import ScriptedModel

        from services.decision_ai.agents.auditor.graph import audit

        bundle = seeded({"text": "La inundación define la vulnerabilidad social de Rionegro.", "label": "Inferencia del equipo"})
        vocabulary = {"findings": [
            {"quote": "La inundación define la vulnerabilidad social", "problem": "Confunde amenaza con vulnerabilidad.", "suggestion": "Diga amenaza por inundación."},
            {"quote": "texto que no está en el producto", "problem": "Inventado.", "suggestion": "—"},
        ]}
        competencies = {"findings": [{"quote": "Puntaje institucional verificado", "problem": "Sin actor.", "suggestion": "—"}]}
        report = audit(bundle, ScriptedModel.of(vocabulary, competencies))
        llm = [f for f in report["findings"] if f["check"] in ("vocabulary", "competencies")]
        self.assertEqual([f["check"] for f in llm], ["vocabulary", "competencies"])
        self.assertEqual(llm[0]["severity"], "major")
        self.assertEqual(llm[1]["severity"], "minor")
        self.assertEqual(llm[1]["label"], "Inferencia del equipo")
        self.assertTrue(report["llm_checks"])
        self.assertTrue(report["export_allowed"])


if __name__ == "__main__":
    unittest.main()
