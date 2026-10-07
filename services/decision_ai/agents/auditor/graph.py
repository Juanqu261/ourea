"""Evidence auditor (§5.3): deterministic checks always; vocabulary and competencies with the LLM when AI is on.

START → collect_claims → deterministic → (vocabulary → competencies, AI only) → aggregate → END
Code drops any LLM finding whose quote is not verbatim in the input.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from ...audit import checks
from ...engine import dataset

PROMPT = (Path(__file__).with_name("prompt.md")).read_text(encoding="utf-8")


class LlmFinding(BaseModel):
    quote: str
    problem: str
    suggestion: str


class LlmFindings(BaseModel):
    findings: list[LlmFinding] = Field(default_factory=list)


class AuditState(TypedDict, total=False):
    bundle: dict
    claims: list[dict]
    deterministic: dict
    llm_findings: list[dict]
    report: dict


def _verbatim(quote: str, claims: list[dict]) -> dict | None:
    quote = (quote or "").strip()
    if len(quote) < 4:
        return None
    return next((claim for claim in claims if quote in claim["text"]), None)


def build_auditor(model=None):
    structured = model.with_structured_output(LlmFindings) if model is not None else None

    def collect_claims(state: AuditState):
        claims = [{"product": product.get("id", "?"), "claim": position, "text": claim.get("text", "")}
                  for product in state["bundle"].get("products", []) for position, claim in enumerate(product.get("claims", []))]
        return {"claims": claims, "llm_findings": []}

    def deterministic(state: AuditState):
        return {"deterministic": checks.run(state["bundle"])}

    def ask_llm(kind: str, severity: str, extra: str):
        def node(state: AuditState):
            listing = "\n".join(f"[{c['product']}#{c['claim']}] {c['text']}" for c in state["claims"])
            reply = structured.invoke([SystemMessage(PROMPT), HumanMessage(f"Revisión: {kind}\n{extra}\n\nAfirmaciones:\n{listing}")])
            kept = []
            for finding in reply.findings:
                claim = _verbatim(finding.quote, state["claims"])
                if claim is None:
                    continue  # not verbatim: dropped by code
                kept.append({"severity": severity, "check": kind, "product": claim["product"], "claim": claim["claim"],
                             "message": f"{finding.problem} Sugerencia: {finding.suggestion}", "quote": finding.quote,
                             **({"label": "Inferencia del equipo"} if kind == "competencies" else {})})
            return {"llm_findings": [*state.get("llm_findings", []), *kept]}
        return node

    def aggregate(state: AuditState):
        base = state["deterministic"]
        findings = [*base["findings"], *state.get("llm_findings", [])]
        report = checks.summarize(findings, base["verified_claims"], base["claims"])
        report["llm_checks"] = structured is not None
        return {"report": report}

    graph = StateGraph(AuditState)
    graph.add_node("collect_claims", collect_claims)
    graph.add_node("deterministic", deterministic)
    graph.add_node("aggregate", aggregate)
    graph.add_edge(START, "collect_claims")
    graph.add_edge("collect_claims", "deterministic")
    if structured is not None:
        competencies = json.dumps(dataset.actor_competencies()["actors"], ensure_ascii=False)
        graph.add_node("vocabulary", ask_llm("vocabulary", checks.MAJOR, "Busca confusiones entre amenaza, vulnerabilidad y riesgo."))
        graph.add_node("competencies", ask_llm("competencies", checks.MINOR, f"Competencias por actor:\n{competencies}"))
        graph.add_edge("deterministic", "vocabulary")
        graph.add_edge("vocabulary", "competencies")
        graph.add_edge("competencies", "aggregate")
    else:
        graph.add_edge("deterministic", "aggregate")
    graph.add_edge("aggregate", END)
    return graph.compile()


def audit(bundle: dict, model=None) -> dict:
    return build_auditor(model).invoke({"bundle": bundle})["report"]
