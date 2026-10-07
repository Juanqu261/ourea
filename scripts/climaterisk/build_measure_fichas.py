"""Extract public CORNARE adaptation fichas for explainability only.

These sheets do not enter the optimizer. They describe institutional status.
"""
import json
from pathlib import Path

import openpyxl

SOURCE = "https://observatorioambiental.cornare.gov.co/wp-content/uploads/2026/04/Copia-de-M-E-2897_Fichas_Adaptacion_Municipales.xlsx"
BOOK = Path("data/public/fichas_adaptacion_municipales.xlsx")
OUT = Path("frontend/public/data/cornare/measure_fichas.json")
SHEETS = {
    "1. Áreas proteg": "bio_pa",
    "3. PSA": "bio_psa",
    "4. Restauración": "bio_restore",
    "5. Uso Interse RH": "water_eff",
    "6. Rondas Hídricas": "water_riparian",
    "7. Cabecera cuencas": "water_head",
    "8. Protección suelo": "food_soil",
    "9. Prod agroeco": "food_agro",
    "10. Espacio verde": "hab_green",
    "11. SUDS": "hab_suds",
    "13. Infra resil": "infra_resilient",
    "14. Servicios públicos": "infra_services",
    "15. Plan Mejora Salud": "health",
    "16. SAT": "risk_sat",
    "17. Cono del riesgo": "risk_knowledge",
}


def field(sheet, label):
    for row in sheet.iter_rows(max_row=40, max_col=3, values_only=True):
        if row[1] == label and row[2]:
            return " ".join(str(row[2]).split())
    return ""


def main():
    book = openpyxl.load_workbook(BOOK, read_only=True, data_only=True)
    measures = []
    for sheet_name, measure_id in SHEETS.items():
        sheet = book[sheet_name]
        status = field(sheet, "Estado de la medida")
        measures.append({
            "id": measure_id,
            "sheet": sheet_name,
            "name": field(sheet, "Nombre de medida"),
            "status": status[:280],
            "scope": field(sheet, "Ámbito de aplicación (Subregión y sectorial)")[:180],
            "score_effect": "none",
            "use": "explainability",
        })
        print(measure_id, measures[-1]["name"][:70])
    payload = {
        "source": SOURCE,
        "accessed": "2026-10-07",
        "product": "Producto 15. Fichas de medidas de adaptación regionales. CORNARE, 2026.",
        "limitation": "El estado institucional no modifica el puntaje ni selecciona un predio.",
        "measures": measures,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
