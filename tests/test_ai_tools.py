"""AI tool layer: envelope, pending tools, fingerprints, call log, spatial context, isolation."""

import ast
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.decision_ai.engine import adapter, dataset  # noqa: E402
from services.decision_ai.tools import call_log, registry  # noqa: E402

SERVICE = ROOT / "services" / "decision_ai"
ENVELOPE_KEYS = {"result", "evidence_labels", "sources", "warnings", "fingerprint"}


class EnvelopeTests(unittest.TestCase):
    def setUp(self):
        call_log.configure(None)

    def test_every_tool_returns_the_envelope(self):
        args = {
            "explain": {"intervention_id": "health"},
            "switching_value": {"intervention_id": "infra_resilient"},
            "get_spatial_context": {"intervention_id": "bio_pa"},
            "compare_portfolios": {"a": ["bio_pa", "water_eff"], "b": ["bio_pa", "risk_knowledge"]},
            "price_of_constraint": {"force": ["infra_resilient"]},
        }
        for name in adapter.TOOL_NAMES:
            with self.subTest(tool=name):
                output = registry.run_tool(name, args.get(name, {}), "envelope")
                self.assertEqual(set(output), ENVELOPE_KEYS)
                self.assertIsNotNone(output["result"])
                self.assertTrue(output["fingerprint"].startswith("ourea-"))
                for source_id in output["sources"]:
                    self.assertIn(source_id, dataset.sources())

    def test_grey_infrastructure_demo_numbers(self):
        result = registry.run_tool("price_of_constraint", {"force": ["infra_resilient"]}, "grey")["result"]
        self.assertEqual(result["unconstrained"]["score"], 2.8125)
        self.assertEqual(result["constrained"]["score"], 2.38)
        self.assertEqual(result["enter"], ["infra_resilient"])
        self.assertEqual(result["score_loss_pct"], 0.153778)

    def test_world0_fingerprint_matches_the_browser(self):
        self.assertEqual(registry.run_tool("search_portfolios", {}, "w0")["fingerprint"], "ourea-42aeaba8")

    def test_same_input_same_fingerprint(self):
        first = registry.run_tool("search_portfolios", {"exclude": ["health"]}, "a")["fingerprint"]
        second = registry.run_tool("search_portfolios", {"exclude": ["health"]}, "b")["fingerprint"]
        self.assertEqual(first, second)
        self.assertNotEqual(first, "ourea-42aeaba8")

    def test_pending_tools_never_invent_numbers(self):
        with mock.patch.object(adapter, "engine", None):
            for name in adapter.TOOL_NAMES:
                if name == "get_spatial_context":
                    continue
                output = adapter.call(name)
                self.assertIsNone(output["result"], name)
                self.assertIsNone(output["fingerprint"], name)
                self.assertEqual(output["warnings"], [f"engine_pending:{name}"])

    def test_bad_input_is_rejected(self):
        with self.assertRaises(Exception):
            registry.run_tool("search_portfolios", {"world": {"invented": 1}}, "bad")
        with self.assertRaises(KeyError):
            registry.run_tool("drop_table", {}, "bad")

    def test_large_outputs_are_trimmed_by_field(self):
        output = registry.run_tool("run_robustness", {}, "big")
        text = registry.for_model(output)
        self.assertLessEqual(len(text), registry.MAX_TOOL_CHARS)
        payload = json.loads(text)
        self.assertIn("s_star", payload["result"])
        self.assertTrue(payload["omitted_fields"])


class CallLogTests(unittest.TestCase):
    def test_call_log_is_written(self):
        with tempfile.TemporaryDirectory() as directory:
            call_log.configure(Path(directory))
            try:
                registry.run_tool("search_portfolios", {}, "logged", "test")
            finally:
                call_log.configure(None)
            lines = [json.loads(line) for path in Path(directory).glob("*.jsonl") for line in path.read_text(encoding="utf-8").splitlines()]
        self.assertEqual(len(lines), 1)
        self.assertEqual({"ts", "run_id", "agent", "tool", "input", "fingerprint", "output_sha"}, set(lines[0]))
        self.assertEqual(lines[0]["fingerprint"], "ourea-42aeaba8")
        self.assertEqual(call_log.outputs("logged")[0]["tool"], "search_portfolios")


class SpatialContextTests(unittest.TestCase):
    def test_always_por_definir_and_gap_sites(self):
        for measure_id in dataset.interventions():
            with self.subTest(measure=measure_id):
                result = adapter.get_spatial_context(measure_id)["result"]
                self.assertEqual(result["exact_location"], "Por definir")
                self.assertEqual(result["gaps"][0], "gap-sites")
                for layer in result["layers"]:
                    self.assertTrue(layer["limitation"])
                    self.assertIn(layer["source_id"], dataset.sources())

    def test_measure_layers_match_the_map(self):
        source = (ROOT / "frontend" / "src" / "cornare" / "map" / "focus.js").read_text(encoding="utf-8")
        block = re.search(r"const MEASURE_LAYERS = \{(.*?)\};", source, re.S).group(1)
        js = {key: re.findall(r"'([^']+)'", values) for key, values in re.findall(r"(\w+): \[([^\]]*)\]", block)}
        self.assertEqual(js, adapter.MEASURE_LAYERS)


class IsolationTests(unittest.TestCase):
    """engine/ and audit/ (and the shared verifier) import nothing from langchain or langgraph."""

    PURE = [*(SERVICE / "engine").glob("*.py"), *(SERVICE / "audit").glob("*.py"),
            SERVICE / "agents" / "shared" / "verify.py", SERVICE / "agents" / "shared" / "answer.py",
            *(ROOT / "decision_engine").glob("*.py")]

    def test_no_langchain_imports(self):
        for path in self.PURE:
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                names = []
                if isinstance(node, ast.Import):
                    names = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom) and node.module:
                    names = [node.module]
                for name in names:
                    self.assertFalse(name.startswith(("langchain", "langgraph")), f"{path.name} imports {name}")


if __name__ == "__main__":
    unittest.main()
