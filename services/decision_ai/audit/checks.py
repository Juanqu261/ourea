"""Deterministic evidence audit of the exported products (§5.3). No LangChain, no key.

Bundle: {"products": [{"id": "P1", "title": str, "claims": [claim, …]}], "records": [interview records]?}
Claim:  {"text": str, "numbers": [raw values], "label": str | None, "source_id": str | None,
         "fingerprint": str | None, "provenance": str | None}
"""

from __future__ import annotations

import re
from dataclasses import asdict, is_dataclass
from functools import lru_cache
from typing import Any

from decision_engine.dataset import load_dataset
from decision_engine.uncertainty import EVIDENCE_LABELS
from decision_engine.world0 import analyze_world0

from ..engine import adapter, dataset
from . import forbidden, numbers

CRITICAL, MAJOR, MINOR = "critical", "major", "minor"
INSTITUTIONAL = EVIDENCE_LABELS["institutional"]
ALLOWED_LABELS = frozenset(EVIDENCE_LABELS.values()) | {"Validación requerida"}
SYNTHETIC = re.compile(r"sint[eé]tic[oa]|SINT[ÉE]TICA", re.IGNORECASE)
IDENTIFIABLE = re.compile(r"\bS\.?\s?A\.?\s?S\b\.?|\bS\.\s?A\.|\bLtda\b\.?|\bNIT\b", re.IGNORECASE)
LOCATION_WORDS = re.compile(r"\b(sitio|predio|ubicaci[oó]n|d[oó]nde|se\s+(ubica|implementa|construye))\b", re.IGNORECASE)


def _plain(value: Any) -> Any:
    if is_dataclass(value):
        return _plain(asdict(value))
    if isinstance(value, dict):
        return {str(k): _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    return value


def _candidate(candidate) -> dict:
    return {"ids": list(candidate.ids), "cost": candidate.cost, "remaining": candidate.remaining, "objective": candidate.objective}


@lru_cache(maxsize=1)
def engine_index() -> dict[str, list[Any]]:
    """fingerprint → engine outputs that carry it. World 0 includes the browser's analyzeCorridor numbers."""
    index: dict[str, list[Any]] = {}

    def add(fingerprint: str | None, result: Any) -> None:
        if fingerprint and result is not None:
            index.setdefault(fingerprint, []).append(result)

    for name, kwargs in (("search_portfolios", {}), ("run_robustness", {}), ("breaking_points", {}),
                         ("value_of_information", {}), ("price_of_constraint", {"force": ("infra_resilient",)}),
                         ("get_context", {})):
        output = adapter.call(name, **kwargs)
        add(output["fingerprint"], output["result"])
    world0 = analyze_world0(load_dataset())
    add(world0["fingerprint"], {
        "portfolio": _candidate(world0["institucional"]),
        "grey": _candidate(world0["grey"]),
        "stress": _candidate(world0["stress"]),
        "max_count": _candidate(world0["max_count"]),
        "rejected": world0["rejected"],
        "budget_million_cop": load_dataset().parameters["budget_million_cop"],
    })
    for measure_id in dataset.interventions():
        output = adapter.call("explain", intervention_id=measure_id)
        add(output["fingerprint"], output["result"])
    return index


@lru_cache(maxsize=1)
def data_values() -> list[float]:
    """Every number in the CORNARE data files: what a source-cited claim can quote."""
    values = []
    for name in ("interventions.json", "dimension_metrics.json", "scenario_metrics.json", "adaptation_history.json",
                 "decision_model.json", "municipality_profiles.json", "mea_indicators.json", "information_gaps.json"):
        values.extend(value for _, value in numbers.leaves(_plain(dataset.read(name))))
    return values


def _finding(severity: str, check: str, product: str, claim: int | None, message: str, quote: str | None = None) -> dict:
    return {"severity": severity, "check": check, "product": product, "claim": claim, "message": message, "quote": quote}


def _number_ok(shown: numbers.Number, raw_values: list[float], pool: list[float]) -> bool:
    candidates = raw_values or pool
    for value in candidates:
        if numbers.displays_as(value, shown) and (not raw_values or any(abs(value - leaf) <= 1e-9 * max(1, abs(leaf)) for leaf in pool)):
            return True
    return False


def check_claim(product: str, position: int, claim: dict) -> tuple[list[dict], bool]:
    """Findings for one claim, and whether every number in it was verified."""
    findings: list[dict] = []
    text = claim.get("text", "")
    shown = list(numbers.extract(text))
    label = claim.get("label")
    source_id = claim.get("source_id")
    fingerprint = claim.get("fingerprint")
    raw_values = [float(v) for v in claim.get("numbers") or []]

    def flag(severity, check, message, quote=None):
        findings.append(_finding(severity, check, product, position, message, quote))

    # fixtures and fingerprints
    if fingerprint and fingerprint.startswith("fixture-"):
        flag(CRITICAL, "fixtures", f"La huella {fingerprint} es de un fixture de prueba.", fingerprint)

    # numbers
    verified = True
    if shown:
        if fingerprint and not fingerprint.startswith("fixture-"):
            outputs = engine_index().get(fingerprint)
            pool = [value for output in outputs or [] for _, value in numbers.leaves(_plain(output))]
            if outputs is None:
                verified = False
                flag(CRITICAL, "numbers", f"La huella {fingerprint} no corresponde a ninguna salida del motor.", fingerprint)
        elif source_id:
            pool = data_values()
        else:
            pool = []
        if pool:
            for number in shown:
                if not _number_ok(number, raw_values, pool):
                    verified = False
                    flag(CRITICAL, "numbers", f"La cifra «{number.raw}» no aparece en la salida citada.", number.raw)
        elif not fingerprint:
            verified = False
            flag(CRITICAL, "numbers", "La afirmación tiene cifras pero no cita huella ni fuente.", shown[0].raw)
        else:
            verified = False

    # labels
    if shown and not label:
        flag(CRITICAL, "labels", "Una cifra sin etiqueta de evidencia.", shown[0].raw)
    if label and label not in ALLOWED_LABELS:
        flag(MAJOR, "labels", f"La etiqueta «{label}» no está permitida.", label)

    # sources
    if source_id:
        source = dataset.sources().get(source_id)
        if source is None:
            flag(CRITICAL, "sources", f"La fuente {source_id} no existe en source_registry.json.", source_id)
        else:
            if label == INSTITUTIONAL and source.get("kind") != "official":
                flag(MAJOR, "sources", f"«Dato institucional» exige una fuente oficial; {source_id} es {source.get('kind')}.", source_id)
            if source_id.startswith("gis-") and LOCATION_WORDS.search(text):
                flag(MAJOR, "sources", f"Una capa de mapa no respalda dónde va una intervención: {source.get('limitation', '')}", source_id)

    # forbidden claims
    for hit in forbidden.claims(text):
        flag(CRITICAL, "forbidden", hit["message"], hit["quote"])

    # synthetic leak and identities
    if claim.get("provenance") == "synthetic_demo" or SYNTHETIC.search(text):
        flag(CRITICAL, "synthetic", "Un dato de la demostración sintética llegó a un producto.", SYNTHETIC.search(text).group(0) if SYNTHETIC.search(text) else None)
    match = IDENTIFIABLE.search(text)
    if match:
        flag(CRITICAL, "identities", "Nombre de empresa identificable en un producto.", match.group(0))
    return findings, verified and bool(shown)


def run(bundle: dict) -> dict:
    findings: list[dict] = []
    verified_claims = 0
    total = 0
    for product in bundle.get("products", []):
        for position, claim in enumerate(product.get("claims", [])):
            total += 1
            claim_findings, verified = check_claim(product.get("id", "?"), position, claim)
            findings.extend(claim_findings)
            if verified and not any(f["severity"] == CRITICAL for f in claim_findings):
                verified_claims += 1
    for position, record in enumerate(bundle.get("records", []) or []):
        if record.get("provenance") == "synthetic_demo":
            findings.append(_finding(CRITICAL, "synthetic", "records", position, "Un registro sintético viene en el paquete de exportación."))
    return summarize(findings, verified_claims, total)


def summarize(findings: list[dict], verified_claims: int, total: int) -> dict:
    critical = sum(1 for f in findings if f["severity"] == CRITICAL)
    return {
        "findings": findings,
        "critical": critical,
        "major": sum(1 for f in findings if f["severity"] == MAJOR),
        "minor": sum(1 for f in findings if f["severity"] == MINOR),
        "verified_claims": verified_claims,
        "claims": total,
        "export_allowed": critical == 0,
    }
