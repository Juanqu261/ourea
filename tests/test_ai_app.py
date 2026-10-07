"""FastAPI service: deterministic layer without a key, AI gate, copilot SSE with a scripted model."""

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

HAS_STACK = all(importlib.util.find_spec(name) for name in ("fastapi", "httpx", "langgraph"))

if HAS_STACK:
    from fastapi.testclient import TestClient

    from services.decision_ai import app as service
    from services.decision_ai.config import Settings
    from services.decision_ai.tools import call_log


def sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


@unittest.skipUnless(HAS_STACK, "requirements-ai.txt not installed")
class ServiceTests(unittest.TestCase):
    def setUp(self):
        call_log.configure(None)
        self.client = TestClient(service.app)

    def test_health(self):
        body = self.client.get("/api/health").json()
        self.assertTrue(body["ok"])
        self.assertIn("price_of_constraint", body["tools"])
        self.assertEqual(body["engine_pending"], [])

    def test_tool_endpoint(self):
        body = self.client.post("/api/tools/price_of_constraint", json={"force": ["infra_resilient"]}).json()
        self.assertEqual(body["result"]["constrained"]["score"], 2.38)
        self.assertEqual(self.client.post("/api/tools/nope", json={}).status_code, 404)
        self.assertEqual(self.client.post("/api/tools/explain", json={"intervention_id": "metro"}).status_code, 404)
        self.assertEqual(self.client.post("/api/tools/search_portfolios", json={"world": {"x": 1}}).status_code, 422)

    def test_audit_endpoint_needs_no_key(self):
        bundle = json.loads((ROOT / "tests" / "fixtures" / "ai" / "seeded_bad_bundle.json").read_text(encoding="utf-8"))
        body = self.client.post("/api/audit", json=bundle).json()
        self.assertFalse(body["export_allowed"])
        self.assertFalse(body["llm_checks"])

    def test_agents_are_gated(self):
        with mock.patch.object(service, "settings", Settings(ai_enabled=False)):
            self.assertEqual(self.client.post("/api/agents/copilot", json={"question": "hola"}).status_code, 503)
            self.assertEqual(self.client.post("/api/agents/interview/start", json={}).status_code, 503)

    def test_copilot_stream(self):
        from ai_fakes import ScriptedModel, final, tool_call
        from test_ai_graphs import GOOD

        from services.decision_ai.agents.copilot.graph import build_copilot

        model = ScriptedModel.of(tool_call("price_of_constraint", {"force": ["infra_resilient"]}), final(), GOOD)
        graph = build_copilot(model, Settings())
        with mock.patch.object(service, "settings", Settings(ai_enabled=True)), mock.patch.object(service, "_copilot", lambda: graph):
            response = self.client.post("/api/agents/copilot", json={"question": "¿Y si exigimos infraestructura gris?"})
        self.assertEqual(response.headers["content-type"].split(";")[0], "text/event-stream")
        events = sse(response.text)
        self.assertEqual(events[0][0], "start")
        self.assertIn(("tool", {"name": "price_of_constraint"}), events)
        kind, answer = events[-1]
        self.assertEqual(kind, "answer")
        self.assertEqual(answer["status"], "answered")
        self.assertEqual(answer["answer"]["enfoque_mapa"], {"intervention_id": "infra_resilient"})

    def test_interview_flow(self):
        from ai_fakes import ScriptedModel, final

        from services.decision_ai.agents.interviewer.graph import build_interviewer

        model = ScriptedModel.of(final("¿Fuente de agua? Solo datos agregados."), {"water_intake": "acueducto", "confidence": "alta"},
                                 final("¿Proveedores? Solo datos agregados."))
        import tempfile

        with tempfile.TemporaryDirectory() as directory:
            graph = build_interviewer(model, Settings(), store_dir=Path(directory))
            with mock.patch.object(service, "settings", Settings(ai_enabled=True)), mock.patch.object(service, "_interviewer", lambda: graph):
                start = self.client.post("/api/agents/interview/start", json={"synthetic": True}).json()
                self.assertEqual(start["question"]["gap_id"], "gap-company-water")
                answer = self.client.post("/api/agents/interview/answer", json={"thread_id": start["thread_id"], "answer": "Usamos el acueducto."}).json()
                self.assertEqual(answer["question"]["gap_id"], "gap-suppliers")
                self.assertEqual(answer["records"][0]["provenance"], "synthetic_demo")
                missing = self.client.post("/api/agents/interview/answer", json={"thread_id": "nada", "answer": "x"})
                self.assertEqual(missing.status_code, 404)


if __name__ == "__main__":
    unittest.main()
