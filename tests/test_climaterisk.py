import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "climaterisk"))

from match_measures import match_intervention  # noqa: E402


class ClimateriskTests(unittest.TestCase):
    def test_catalogue_phrases_do_not_absorb_mitigation_or_roads(self):
        self.assertEqual(
            match_intervention("Producción agroecológica y económica campesina"),
            "food_agro",
        )
        self.assertEqual(
            match_intervention("Instrumentos de compensación y pago por servicios ambientales"),
            "bio_psa",
        )
        self.assertIsNone(match_intervention("Infraestructura para la movilidad sostenible y sistema"))
        self.assertIsNone(match_intervention("Gestión de rellenos sanitarios enfocada a la reducción de emisiones GEI"))

    def test_derived_inputs_validate(self):
        completed = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "climaterisk" / "validate_inputs.py")],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)


if __name__ == "__main__":
    unittest.main()
