"""verify(): es-CO numbers, figures traced to tool outputs, labels, ids, forbidden claims, length."""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.decision_ai.agents.shared.verify import verify  # noqa: E402
from services.decision_ai.audit import forbidden, numbers  # noqa: E402
from services.decision_ai.tools import call_log, registry  # noqa: E402


class EsCoNumberTests(unittest.TestCase):
    TABLE = [
        ("2,87", 2.87, 2, False),
        ("5.000", 5000.0, 0, False),
        ("4.800M", 4800.0, 0, False),
        ("−17 %", -17.0, 0, True),
        ("15,4%", 15.4, 1, True),
        ("4.800,5", 4800.5, 1, False),
        ("0", 0.0, 0, False),
    ]

    def test_parse_table(self):
        for text, value, decimals, percent in self.TABLE:
            with self.subTest(text=text):
                number = numbers.parse(text)
                self.assertEqual((number.value, number.decimals, number.percent), (value, decimals, percent))

    def test_ranges(self):
        self.assertEqual([n.value for n in numbers.extract("amenaza Alta (0.66–0.73)")], [0.66, 0.73])
        self.assertEqual([n.value for n in numbers.extract("cambia −17 %")], [-17.0])

    def test_identifiers_and_years_are_not_figures(self):
        for text in ("SSP3-7.0", "hacia 2060", "ourea-3e283bb2", "Ley 99/1993", "gap-ssp-cube", "bio_pa"):
            self.assertEqual(list(numbers.extract(text)), [], text)

    def test_display_rounding(self):
        self.assertTrue(numbers.displays_as(2.8125, numbers.parse("2,81")))
        self.assertTrue(numbers.displays_as(0.153778, numbers.parse("15%")))
        self.assertTrue(numbers.displays_as(0.153778, numbers.parse("15,4%")))
        self.assertFalse(numbers.displays_as(0.153778, numbers.parse("17%")))


class VerifyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        call_log.configure(None)
        registry.run_tool("price_of_constraint", {"force": ["infra_resilient"]}, "verify-tests")
        cls.results = call_log.outputs("verify-tests")
        cls.fp = cls.results[0]["fingerprint"]

    def cifra(self, valor, texto):
        return {"valor": valor, "texto": texto, "unidad": "", "herramienta": "price_of_constraint", "huella": self.fp}

    def answer(self, **changes):
        base = {
            "respuesta": "Exigir infraestructura gris baja el puntaje de 2,81 a 2,38, una pérdida de 15%.",
            "cifras": [self.cifra(2.8125, "2,81"), self.cifra(2.38, "2,38"), self.cifra(0.153778, "15%")],
            "etiquetas": ["Inferencia del equipo"],
            "brechas_relacionadas": ["gap-company-road"],
            "fuentes": ["reto-brief-2026"],
            "enfoque_mapa": {"intervention_id": "infra_resilient"},
        }
        return base | changes

    def test_clean_answer_passes(self):
        self.assertEqual(verify(self.answer(), self.results), [])

    def test_undeclared_number(self):
        errors = verify(self.answer(respuesta="Baja de 2,81 a 2,38 y entran 4 medidas."), self.results)
        self.assertTrue(any("«4»" in error for error in errors), errors)

    def test_number_missing_from_tool_output(self):
        errors = verify(self.answer(respuesta="Sube a 3,10.", cifras=[self.cifra(3.1, "3,10")]), self.results)
        self.assertTrue(any("no está en la salida" in error for error in errors), errors)

    def test_derived_percentage_fails(self):
        # 17% is not a field of the tool output: a number the model computed.
        errors = verify(self.answer(respuesta="Pierde 17%.", cifras=[self.cifra(0.17, "17%")]), self.results)
        self.assertTrue(errors)

    def test_wrong_fingerprint_fails(self):
        cifra = self.cifra(2.38, "2,38") | {"huella": "ourea-00000000"}
        errors = verify(self.answer(respuesta="Queda en 2,38.", cifras=[cifra]), self.results)
        self.assertTrue(any("huella" in error for error in errors), errors)

    def test_tool_not_called(self):
        cifra = self.cifra(2.38, "2,38") | {"herramienta": "run_robustness"}
        errors = verify(self.answer(respuesta="Queda en 2,38.", cifras=[cifra]), self.results)
        self.assertTrue(any("no se consultó" in error for error in errors), errors)

    def test_too_long(self):
        errors = verify(self.answer(respuesta="palabra " * 121, cifras=[]), self.results)
        self.assertTrue(any("121 palabras" in error for error in errors), errors)

    def test_unknown_ids(self):
        errors = verify(self.answer(brechas_relacionadas=["gap-nada"], fuentes=["wikipedia"], enfoque_mapa={"intervention_id": "metro"}), self.results)
        self.assertEqual(len(errors), 3, errors)

    def test_labels(self):
        self.assertTrue(verify(self.answer(etiquetas=[]), self.results))
        self.assertTrue(verify(self.answer(etiquetas=["Certeza"]), self.results))

    def test_acceptability_as_probability(self):
        errors = verify(self.answer(respuesta="La probabilidad de que sea casi óptimo es alta.", cifras=[]), self.results)
        self.assertTrue(any("probabilidad" in error for error in errors), errors)

    def test_context_polygon_as_site(self):
        errors = verify(self.answer(respuesta="El sitio es el humedal X.", cifras=[]), self.results)
        self.assertTrue(any("sitio de intervención" in error for error in errors), errors)

    def test_exploratory_field_needs_label(self):
        call_log.configure(None)
        registry.run_tool("breaking_points", {}, "verify-exploratory")
        results = call_log.outputs("verify-exploratory")
        box = results[0]["result"]["decision_residual_risk"]["regret_10"]["boxes"][0]
        cifra = {"valor": box["coverage"], "texto": f"{round(box['coverage'] * 100)}%", "herramienta": "breaking_points",
                 "huella": results[0]["fingerprint"]}
        answer = self.answer(respuesta=f"La caja cubre {cifra['texto']} de los mundos.", cifras=[cifra])
        errors = verify(answer, results)
        self.assertTrue(any("Exploratorio" in error for error in errors), errors)
        self.assertEqual(verify(answer | {"etiquetas": ["Inferencia del equipo", "Exploratorio"]}, results), [])


class ForbiddenListTests(unittest.TestCase):
    def test_map_vocabulary(self):
        self.assertTrue(forbidden.claims("El movimiento en masa es la vulnerabilidad del corredor."))
        self.assertTrue(forbidden.claims("Estar en el POMCA sube su puntaje de riesgo."))
        self.assertFalse(forbidden.claims("La ubicación exacta está por definir."))

    def test_eval_questions_route_as_expected(self):
        from services.decision_ai.agents.copilot.refusals import classify

        path = ROOT / "tests" / "fixtures" / "ai" / "copilot_questions.jsonl"
        for line in path.read_text(encoding="utf-8").splitlines():
            case = json.loads(line)
            route, _ = classify(case["question"])
            with self.subTest(case=case["id"]):
                if case["expect"] == "refused":
                    self.assertIn(route, ("ask", "write"))
                elif case.get("contains") == "Por definir":
                    self.assertEqual(route, "location")
                else:
                    self.assertEqual(route, "agent")

    def test_negated_reminder_passes(self):
        self.assertFalse(forbidden.claims("Seleccionar una medida no equivale a un porcentaje de reducción de la vulnerabilidad."))


if __name__ == "__main__":
    unittest.main()
