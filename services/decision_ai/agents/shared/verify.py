"""Golden rule 1 by code (§5.1 verify). Pure and shared with the auditor. No LangChain.

`verify(answer, tool_results)` returns a list of Spanish error strings; empty means pass.
`tool_results` are the full envelopes logged in this run, each with its "tool" name.
"""

from __future__ import annotations

from decision_engine.uncertainty import EVIDENCE_LABELS

from ...audit import forbidden, numbers
from ...engine import dataset

ALLOWED_LABELS = frozenset(EVIDENCE_LABELS.values()) | {"Validación requerida"}
EXPLORATORY = EVIDENCE_LABELS["exploratory"]
MAX_WORDS = 120


def word_count(text: str) -> int:
    return len((text or "").split())


def _label_applies(key: str, path: str) -> bool:
    """'decision_residual_risk.boxes' applies to 'decision_residual_risk.regret_10.boxes.coverage'."""
    remaining = iter(path.split("."))
    return all(segment in remaining for segment in key.split("."))


def match_cifra(cifra: dict, tool_results: list[dict]) -> tuple[dict | None, str | None, str | None]:
    """(tool output, leaf path, error) for one figure."""
    shown = numbers.parse(cifra.get("texto", ""))
    if shown is None:
        return None, None, f"La cifra «{cifra.get('texto')}» no es un único número legible."
    if not numbers.displays_as(cifra["valor"], shown, allow_percent=True):
        return None, None, f"La cifra «{cifra['texto']}» no es un redondeo de su valor {cifra['valor']}."
    candidates = [out for out in tool_results if out.get("tool") == cifra.get("herramienta")]
    if not candidates:
        return None, None, f"La herramienta «{cifra.get('herramienta')}» no se consultó en esta corrida."
    for output in candidates:
        if output.get("fingerprint") != cifra.get("huella"):
            continue
        for path, leaf in numbers.leaves(output.get("result")):
            if abs(leaf - cifra["valor"]) <= 1e-9 * max(1.0, abs(leaf)):
                return output, path, None
    if not any(output.get("fingerprint") == cifra.get("huella") for output in candidates):
        return None, None, f"La huella «{cifra.get('huella')}» no corresponde a la salida de {cifra['herramienta']}."
    return None, None, f"El valor {cifra['valor']} no está en la salida de {cifra['herramienta']}. Una cifra calculada por el modelo no se acepta."


def verify(answer: dict, tool_results: list[dict], max_words: int = MAX_WORDS) -> list[str]:
    errors: list[str] = []
    text = answer.get("respuesta", "")
    cifras = answer.get("cifras") or []
    labels = answer.get("etiquetas") or []

    # 1. every number in the text is a declared figure
    declared = [numbers.parse(cifra.get("texto", "")) for cifra in cifras]
    for number in numbers.extract(text):
        if not any(shown is not None and abs(abs(shown.value) - abs(number.value)) < 1e-9 for shown in declared):
            errors.append(f"El número «{number.raw}» de la respuesta no está declarado en cifras.")

    # 2. every figure comes from a tool output of this run, with its fingerprint
    needs_exploratory = False
    for cifra in cifras:
        output, path, error = match_cifra(cifra, tool_results)
        if error:
            errors.append(error)
            continue
        for key, label in (output.get("evidence_labels") or {}).items():
            if label == EXPLORATORY and _label_applies(key, path):
                needs_exploratory = True

    # 3. labels
    if not labels:
        errors.append("Falta al menos una etiqueta de evidencia.")
    for label in labels:
        if label not in ALLOWED_LABELS:
            errors.append(f"La etiqueta «{label}» no está permitida. Use una de: {', '.join(sorted(ALLOWED_LABELS))}.")
    if needs_exploratory and EXPLORATORY not in labels:
        errors.append("Una cifra viene de un campo exploratorio: agregue la etiqueta «Exploratorio».")

    # 4. ids exist
    gaps, sources, measures = dataset.gaps(), dataset.sources(), dataset.interventions()
    for gap_id in answer.get("brechas_relacionadas") or []:
        if gap_id not in gaps:
            errors.append(f"La brecha «{gap_id}» no existe en information_gaps.json.")
    for source_id in answer.get("fuentes") or []:
        if source_id not in sources:
            errors.append(f"La fuente «{source_id}» no existe en source_registry.json.")
    focus = answer.get("enfoque_mapa") or None
    if focus and focus.get("intervention_id") not in measures:
        errors.append(f"La medida «{focus.get('intervention_id')}» no existe en interventions.json.")

    # 5. forbidden claims
    for hit in forbidden.claims(text):
        errors.append(f"Afirmación prohibida «{hit['quote']}»: {hit['message']}")

    # 6. length
    count = word_count(text)
    if count > max_words:
        errors.append(f"La respuesta tiene {count} palabras; el máximo es {max_words}.")
    return errors
