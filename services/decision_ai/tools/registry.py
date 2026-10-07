"""Tool registry: one deterministic runner shared by /api/tools and the LangChain tools."""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel

from ..engine import adapter
from . import call_log
from .schemas import DESCRIPTIONS, INPUTS, SearchInput

# Large payloads are trimmed for the model; the verifier always sees the full output.
MAX_TOOL_CHARS = 24000


def _kwargs(name: str, parsed: BaseModel) -> dict[str, Any]:
    if isinstance(parsed, SearchInput):
        return {
            "world": parsed.world.compact() if parsed.world else None,
            "force": tuple(parsed.force),
            "exclude": tuple(parsed.exclude),
            "budget": parsed.budget,
        }
    data = parsed.model_dump()
    if name == "price_of_constraint":
        return {"force": tuple(data["force"]), "exclude": tuple(data["exclude"])}
    return data


def run_tool(name: str, args: dict | None, run_id: str, agent: str = "api") -> dict:
    """Validate, call the engine, log. Raises KeyError / ValueError / pydantic.ValidationError."""
    if name not in INPUTS:
        raise KeyError(name)
    parsed = INPUTS[name].model_validate(args or {})
    output = adapter.call(name, **_kwargs(name, parsed))
    call_log.record(run_id, agent, name, parsed.model_dump(exclude_none=True), output)
    return output


def _dumps(payload) -> str:
    return json.dumps(payload, ensure_ascii=False, default=str)


def for_model(output: dict) -> str:
    """Drop the largest result fields until the payload fits; name what was left out."""
    text = _dumps(output)
    result = output.get("result")
    if len(text) <= MAX_TOOL_CHARS or not isinstance(result, dict):
        return text
    result = dict(result)
    omitted = []
    while len(_dumps({**output, "result": result})) > MAX_TOOL_CHARS and result:
        largest = max(result, key=lambda key: len(_dumps(result[key])))
        omitted.append(largest)
        del result[largest]
    return _dumps({**output, "result": result, "omitted_fields": omitted})


def langchain_tools(agent: str = "copilot", names: tuple[str, ...] | None = None):
    """StructuredTools for LangGraph. The run id comes from config['configurable']['run_id']."""
    from langchain_core.runnables import RunnableConfig
    from langchain_core.tools import StructuredTool

    def make(name: str):
        def _run(config: RunnableConfig, **kwargs) -> str:
            run_id = (config.get("configurable") or {}).get("run_id", "no-run")
            try:
                return for_model(run_tool(name, kwargs, run_id, agent))
            except (KeyError, ValueError) as error:
                return json.dumps({"error": f"{type(error).__name__}: {error}"}, ensure_ascii=False)

        # Real class, not the postponed string: LangChain injects `config` by its annotation.
        _run.__annotations__["config"] = RunnableConfig
        return StructuredTool.from_function(func=_run, name=name, description=DESCRIPTIONS[name], args_schema=INPUTS[name])

    return [make(name) for name in (names or tuple(INPUTS))]
