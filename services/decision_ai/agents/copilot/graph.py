"""Decision copilot graph (§5.1).

START → guard_input ─┬─ forbidden ask ─► refuse ─► END
                     ├─ write request ─► refuse_write ─► END
                     ├─ location ask ─► locate ─► END
                     └─► agent ⇄ tools (max 6 calls) → compose → verify ─┬─ pass ─► END
                                                         ▲               ├─ fail, retries < 2 ─► compose
                                                         └───────────────┘─ fail, retries = 2 ─► fallback ─► END
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any, TypedDict

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from ...config import Settings
from ...tools import call_log, registry
from ..shared.answer import CopilotAnswer
from ..shared.verify import verify
from . import refusals

PROMPT = (Path(__file__).with_name("prompt.md")).read_text(encoding="utf-8")

COMPOSE = (
    "Redacta ahora la respuesta final como CopilotAnswer. Usa solo cifras de las salidas de herramientas de abajo, "
    "copiando `valor` exacto y `huella` (= fingerprint). Si no hay salidas, responde sin números y nombra la brecha."
)


class CopilotState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]
    run_id: str
    route: str
    tool_results: list[dict]
    tool_calls: int
    draft: dict | None
    errors: list[str]
    retries: int
    answer: dict | None
    status: str
    last_focus: str | None


def _question(state: CopilotState) -> str:
    for message in reversed(state.get("messages", [])):
        if isinstance(message, HumanMessage):
            return message.content if isinstance(message.content, str) else str(message.content)
    return ""


def _run_id(config: RunnableConfig) -> str:
    return (config.get("configurable") or {}).get("run_id") or "no-run"


def _conversation(messages: list[AnyMessage]) -> list[AnyMessage]:
    """Questions and final answers only: no dangling tool calls."""
    return [m for m in messages if isinstance(m, HumanMessage) or (isinstance(m, AIMessage) and not m.tool_calls and m.content)]


def build_copilot(model, settings: Settings, checkpointer=None):
    tools = registry.langchain_tools("copilot")
    model_with_tools = model.bind_tools(tools)
    structured = model.with_structured_output(CopilotAnswer)

    def guard_input(state: CopilotState, config: RunnableConfig):
        route, _ = refusals.classify(_question(state))
        return {"route": route, "run_id": _run_id(config), "tool_results": [], "tool_calls": 0,
                "draft": None, "errors": [], "retries": 0, "answer": None, "status": "running"}

    def finish(answer: dict, status: str, extra: dict | None = None):
        update = {"answer": answer, "status": status, "messages": [AIMessage(content=answer["respuesta"])]}
        focus = (answer.get("enfoque_mapa") or {}).get("intervention_id")
        if focus:
            update["last_focus"] = focus
        return update | (extra or {})

    def refuse(state: CopilotState):
        _, spec = refusals.classify(_question(state))
        return finish(refusals.refuse(spec), "refused")

    def refuse_write(state: CopilotState):
        return finish(refusals.refuse_write(), "refused")

    def locate(state: CopilotState):
        measure_id = refusals.measure_in(_question(state)) or state.get("last_focus")
        layers = []
        if measure_id:
            output = registry.run_tool("get_spatial_context", {"intervention_id": measure_id}, state["run_id"], "copilot")
            layers = output["result"]["layers"]
        return finish(refusals.locate(measure_id, layers), "answered", {"tool_results": call_log.outputs(state["run_id"])})

    def agent(state: CopilotState):
        reply = model_with_tools.invoke([SystemMessage(PROMPT), *state["messages"]])
        return {"messages": [reply]}

    def after_agent(state: CopilotState) -> str:
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls and state.get("tool_calls", 0) < settings.max_tool_calls:
            return "tools"
        return "compose"

    def record(state: CopilotState):
        results = call_log.outputs(state["run_id"])
        return {"tool_results": results, "tool_calls": len(results)}

    def compose(state: CopilotState):
        results = state.get("tool_results") or []
        facts = "\n\n".join(f"### {out['tool']}\n{registry.for_model({k: v for k, v in out.items() if k != 'input'})}" for out in results)
        notes = [COMPOSE, "Salidas de herramientas de esta corrida:\n" + (facts or "(ninguna)")]
        if state.get("errors"):
            notes.append("El borrador anterior falló la verificación. Corrige:\n- " + "\n- ".join(state["errors"]))
        draft = structured.invoke([SystemMessage(PROMPT), *_conversation(state["messages"]), HumanMessage("\n\n".join(notes))])
        if isinstance(draft, CopilotAnswer):
            draft = draft.model_dump()
        return {"draft": draft}

    def check(state: CopilotState):
        errors = verify(state["draft"], state.get("tool_results") or [], settings.max_words)
        if not errors:
            return finish(state["draft"], "answered", {"errors": []})
        return {"errors": errors, "retries": state.get("retries", 0) + 1}

    def after_verify(state: CopilotState) -> str:
        if state.get("status") == "answered":
            return END
        return "fallback" if state.get("retries", 0) >= settings.max_verify_retries else "compose"

    def fallback(state: CopilotState):
        return finish(fallback_answer(state.get("tool_results") or []), "fallback")

    graph = StateGraph(CopilotState)
    graph.add_node("guard_input", guard_input)
    graph.add_node("refuse", refuse)
    graph.add_node("refuse_write", refuse_write)
    graph.add_node("locate", locate)
    graph.add_node("agent", agent)
    graph.add_node("tools", ToolNode(tools))
    graph.add_node("record", record)
    graph.add_node("compose", compose)
    graph.add_node("verify", check)
    graph.add_node("fallback", fallback)
    graph.add_edge(START, "guard_input")
    graph.add_conditional_edges("guard_input", lambda s: {"ask": "refuse", "write": "refuse_write", "location": "locate"}.get(s["route"], "agent"),
                                ["refuse", "refuse_write", "locate", "agent"])
    for terminal in ("refuse", "refuse_write", "locate", "fallback"):
        graph.add_edge(terminal, END)
    graph.add_conditional_edges("agent", after_agent, ["tools", "compose"])
    graph.add_edge("tools", "record")
    graph.add_conditional_edges("record", lambda s: "compose" if s["tool_calls"] >= settings.max_tool_calls else "agent", ["agent", "compose"])
    graph.add_edge("compose", "verify")
    graph.add_conditional_edges("verify", after_verify, ["compose", "fallback", END])
    return graph.compile(checkpointer=checkpointer if checkpointer is not None else InMemorySaver())


def _sentences(payload: Any) -> list[str]:
    found = []
    if isinstance(payload, dict):
        for key, value in payload.items():
            if isinstance(value, str) and key.endswith("sentence"):
                found.append(value)
            else:
                found.extend(_sentences(value))
    elif isinstance(payload, list):
        for item in payload:
            found.extend(_sentences(item))
    return found


def fallback_answer(tool_results: list[dict]) -> dict:
    """Tool facts only: the engine's own sentences and the tools consulted, with their fingerprints."""
    consulted = ", ".join(f"{out['tool']} ({out.get('fingerprint') or 'sin huella'})" for out in tool_results)
    sentences = [s for out in tool_results for s in _sentences(out.get("result"))][:2]
    parts = ["No pude redactar una respuesta con cifras verificables."]
    parts += sentences
    parts.append(f"Consulté: {consulted}." if consulted else "No consulté el motor.")
    labels = sorted({label for out in tool_results for label in (out.get("evidence_labels") or {}).values()}) or ["Información faltante"]
    return {"respuesta": " ".join(parts), "cifras": [], "etiquetas": labels, "brechas_relacionadas": [], "fuentes": [], "enfoque_mapa": None}


def ask(graph, question: str, thread_id: str, run_id: str) -> dict:
    config = {"configurable": {"thread_id": thread_id, "run_id": run_id}}
    state = graph.invoke({"messages": [HumanMessage(question)]}, config)
    return {"status": state["status"], "answer": state["answer"], "run_id": run_id,
            "tools": [{"tool": out["tool"], "fingerprint": out.get("fingerprint")} for out in state.get("tool_results") or []]}


def dumps(payload) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2)
