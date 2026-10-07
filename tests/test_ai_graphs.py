"""Copilot and interviewer graphs with a scripted model: no network, no key."""

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

HAS_LANGGRAPH = importlib.util.find_spec("langgraph") is not None

if HAS_LANGGRAPH:
    from ai_fakes import ScriptedModel, final, tool_call
    from langgraph.types import Command

    from services.decision_ai.agents.copilot.graph import ask, build_copilot
    from services.decision_ai.agents.interviewer.graph import NONE_LEFT, PROVISIONAL, EngineNotReady, build_interviewer, view
    from services.decision_ai.config import Settings
    from services.decision_ai.engine import adapter
    from services.decision_ai.tools import call_log

GREY_FP = "ourea-3e283bb2"


def cifra(valor, texto, huella=GREY_FP):
    return {"valor": valor, "texto": texto, "unidad": "", "herramienta": "price_of_constraint", "huella": huella}


GOOD = {
    "respuesta": "Exigir infraestructura gris baja el puntaje de 2,81 a 2,38, una pérdida de 15%. Salen PSA, agroecología y salud.",
    "cifras": [cifra(2.8125, "2,81"), cifra(2.38, "2,38"), cifra(0.153778, "15%")],
    "etiquetas": ["Inferencia del equipo"],
    "brechas_relacionadas": ["gap-company-road"],
    "fuentes": ["reto-brief-2026"],
    "enfoque_mapa": {"intervention_id": "infra_resilient"},
}
BAD = GOOD | {"respuesta": "Pierde 17%.", "cifras": [cifra(0.17, "17%")]}


@unittest.skipUnless(HAS_LANGGRAPH, "requirements-ai.txt not installed")
class CopilotGraphTests(unittest.TestCase):
    def setUp(self):
        call_log.configure(None)

    def run_copilot(self, model, *questions, thread="t"):
        graph = build_copilot(model, Settings())
        return [ask(graph, question, thread, f"{thread}-run-{i}") for i, question in enumerate(questions)]

    def test_grey_infrastructure_question(self):
        model = ScriptedModel.of(tool_call("price_of_constraint", {"force": ["infra_resilient"]}), final(), GOOD)
        [result] = self.run_copilot(model, "¿Y si exigimos infraestructura gris?", thread="grey")
        self.assertEqual(result["status"], "answered")
        self.assertEqual(result["tools"], [{"tool": "price_of_constraint", "fingerprint": GREY_FP}])
        self.assertEqual(result["answer"]["enfoque_mapa"], {"intervention_id": "infra_resilient"})

    def test_forbidden_ask_is_refused_without_tools(self):
        model = ScriptedModel.of()
        for question, gap in (("¿Cuál es el % de reducción de vulnerabilidad?", ["gap-effectiveness"]),
                              ("¿Cuántas pérdidas evitadas tiene el portafolio?", ["gap-effectiveness"]),
                              ("¿Qué probabilidad hay de que funcione?", [])):
            with self.subTest(question=question):
                [result] = self.run_copilot(model, question, thread=question[:8])
                self.assertEqual(result["status"], "refused")
                self.assertEqual(result["tools"], [])
                self.assertEqual(result["answer"]["brechas_relacionadas"], gap)
        self.assertEqual(model.calls, [])

    def test_write_request_is_refused(self):
        model = ScriptedModel.of()
        [result] = self.run_copilot(model, "Cambia el peso de salud a 0,9", thread="write")
        self.assertEqual(result["status"], "refused")
        self.assertIn("solo lee", result["answer"]["respuesta"])
        self.assertEqual(model.calls, [])

    def test_where_exactly_follows_the_thread(self):
        model = ScriptedModel.of(tool_call("price_of_constraint", {"force": ["infra_resilient"]}), final(), GOOD)
        _, where = self.run_copilot(model, "¿Y si exigimos infraestructura gris?", "¿Dónde exactamente?", thread="where")
        self.assertIn("Por definir", where["answer"]["respuesta"])
        self.assertEqual(where["answer"]["brechas_relacionadas"], ["gap-sites"])
        self.assertEqual(where["answer"]["enfoque_mapa"], {"intervention_id": "infra_resilient"})

    def test_where_exactly_uses_the_measure_asked_about(self):
        draft = GOOD | {"enfoque_mapa": None}  # the model forgot the focus
        model = ScriptedModel.of(tool_call("price_of_constraint", {"force": ["infra_resilient"]}), final(), draft)
        _, where = self.run_copilot(model, "¿Y si exigimos infraestructura gris?", "¿Dónde exactamente?", thread="where2")
        self.assertEqual(where["answer"]["enfoque_mapa"], {"intervention_id": "infra_resilient"})

    def test_bad_draft_is_retried_with_errors(self):
        model = ScriptedModel.of(tool_call("price_of_constraint", {"force": ["infra_resilient"]}), final(), BAD, GOOD)
        [result] = self.run_copilot(model, "¿Y si exigimos infraestructura gris?", thread="retry")
        self.assertEqual(result["status"], "answered")
        self.assertEqual(model.calls.count("structured"), 2)

    def test_two_bad_drafts_fall_back_to_tool_facts(self):
        model = ScriptedModel.of(tool_call("price_of_constraint", {"force": ["infra_resilient"]}), final(), BAD, BAD)
        [result] = self.run_copilot(model, "¿Y si exigimos infraestructura gris?", thread="fallback")
        self.assertEqual(result["status"], "fallback")
        self.assertEqual(result["answer"]["cifras"], [])
        self.assertIn(GREY_FP, result["answer"]["respuesta"])
        self.assertNotIn("17", result["answer"]["respuesta"])

    def test_tool_calls_are_capped(self):
        cap = Settings().max_tool_calls
        calls = [tool_call("search_portfolios", {}, f"c{i}") for i in range(cap)]
        model = ScriptedModel.of(*calls, GOOD | {"respuesta": "Sin cifras.", "cifras": []})
        [result] = self.run_copilot(model, "Busca muchas veces", thread="cap")
        self.assertEqual(len(result["tools"]), cap)
        self.assertEqual(model.calls, ["chat"] * cap + ["structured", "chat"])  # no seventh agent turn


class ModelSettingsTests(unittest.TestCase):
    def test_temperature_is_sent_only_when_configured(self):
        from services.decision_ai.agents.shared.model import temperature_for

        for configured in (None, "", "none", "None"):
            self.assertIsNone(temperature_for(configured))
        self.assertEqual(temperature_for("0"), 0.0)
        self.assertEqual(temperature_for("0.3"), 0.3)


@unittest.skipUnless(HAS_LANGGRAPH, "requirements-ai.txt not installed")
class InterviewerGraphTests(unittest.TestCase):
    def setUp(self):
        call_log.configure(None)
        self.directory = tempfile.TemporaryDirectory()
        self.store = Path(self.directory.name)

    def tearDown(self):
        self.directory.cleanup()

    def graph(self, model, settings=None):
        return build_interviewer(model, settings or Settings(), store_dir=self.store)

    def test_voi_order_and_stop_below_threshold(self):
        model = ScriptedModel.of(
            final("¿De qué fuente o captación de agua depende su operación? Responda con solo datos agregados."),
            {"water_intake": "quebrada La Pereira", "confidence": "alta"},
            final("¿Dónde están sus proveedores críticos? Solo datos agregados."),
            {"supplier_municipality": "Rionegro", "confidence": "media"},
        )
        graph = self.graph(model)
        config = {"configurable": {"thread_id": "voi"}}
        first = view(graph.invoke({"org": {"synthetic": True}}, config))
        self.assertEqual(first["question"]["gap_id"], "gap-company-water")
        ratios = [row["ratio"] for row in first["ranking"]]
        self.assertEqual(ratios, sorted(ratios))
        second = view(graph.invoke(Command(resume="Tomamos agua de la quebrada La Pereira."), config))
        self.assertEqual(second["question"]["gap_id"], "gap-suppliers")
        done = view(graph.invoke(Command(resume="Los proveedores están en Rionegro."), config))
        self.assertIsNone(done["question"])
        self.assertTrue(done["closed"].startswith(NONE_LEFT))
        self.assertIn("gap-workers", done["closed"])  # ratio above 2.0×: not asked, but shown

    def test_grounding_nulls_invented_values(self):
        model = ScriptedModel.of(final("¿Fuente de agua? Solo datos agregados."), {"water_intake": "río Cauca", "confidence": "alta"}, final("¿Proveedores? Solo datos agregados."))
        graph = self.graph(model)
        config = {"configurable": {"thread_id": "ground"}}
        graph.invoke({"org": {"synthetic": True}}, config)
        records = view(graph.invoke(Command(resume="Usamos el acueducto veredal."), config))["records"]
        self.assertIsNone(records[0]["values"]["water_intake"])

    def test_synthetic_provenance_is_forced_and_stored(self):
        model = ScriptedModel.of(final("¿Fuente de agua? Solo datos agregados."), {"water_intake": "acueducto veredal", "confidence": "media"}, final("¿Proveedores? Solo datos agregados."))
        graph = self.graph(model)
        config = {"configurable": {"thread_id": "synthetic"}}
        graph.invoke({"org": {"synthetic": True}}, config)
        graph.invoke(Command(resume="Usamos el acueducto veredal."), config)
        stored = [json.loads(line) for line in (self.store / "synthetic.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual(stored[0]["provenance"], "synthetic_demo")
        self.assertEqual(stored[0]["values"]["water_intake"], "acueducto veredal")

    def test_identifiable_names_are_rejected(self):
        model = ScriptedModel.of(final("¿Fuente de agua? Solo datos agregados."), {"water_intake": "acueducto", "confidence": "alta"}, final("¿Proveedores? Solo datos agregados."))
        graph = self.graph(model)
        config = {"configurable": {"thread_id": "ident"}}
        graph.invoke({"org": {"synthetic": True}}, config)
        records = view(graph.invoke(Command(resume="Flores X S.A.S. usa el acueducto."), config))["records"]
        self.assertEqual(records[0]["rejected"], "identifiable_name")
        self.assertFalse((self.store / "ident.jsonl").exists())

    def test_questions_with_numbers_are_replaced(self):
        model = ScriptedModel.of(final("¿Usa más de 3 litros por segundo de Flores X?"), {"confidence": "no_sabe"})
        graph = self.graph(model)
        question = view(graph.invoke({"org": {"synthetic": True}}, {"configurable": {"thread_id": "numq"}}))["question"]["question"]
        self.assertNotRegex(question, r"\d")
        self.assertIn("solo datos agregados", question)

    def test_refuses_to_start_without_voi(self):
        with mock.patch.object(adapter, "engine", None):
            with self.assertRaises(EngineNotReady):
                self.graph(ScriptedModel.of()).invoke({"org": {}}, {"configurable": {"thread_id": "pending"}})
            model = ScriptedModel.of(final("¿Fuente de agua? Solo datos agregados."))
            dev = Settings(interview_priority_fallback=True)
            first = view(self.graph(model, dev).invoke({"org": {}}, {"configurable": {"thread_id": "dev"}}))
            self.assertEqual(first["banner"], PROVISIONAL)


if __name__ == "__main__":
    unittest.main()
