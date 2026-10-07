"""FastAPI service (decision A6).

Deterministic, no key:  GET /api/health · POST /api/tools/{name} · POST /api/audit
LLM, OUREA_AI_ENABLED:  POST /api/agents/copilot (SSE) · POST /api/agents/interview/{start,answer}

Run: uv run uvicorn services.decision_ai.app:app --port 8787 --env-file .env
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from functools import lru_cache

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ValidationError

from .audit import checks
from .config import ROOT, load_settings
from .engine import adapter
from .tools import call_log, registry

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:  # pragma: no cover
    pass

settings = load_settings()
DEMO = Path(__file__).with_name("demo") / "synthetic_flower_grower.json"
call_log.configure(settings.log_dir)

app = FastAPI(title="Ourea decision AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


@app.get("/api/health")
def health():
    pending = [name for name in adapter.TOOL_NAMES if name != "get_spatial_context" and adapter.engine is None]
    return {"ok": True, "ai_enabled": settings.ai_enabled, "tools": list(adapter.TOOL_NAMES), "engine_pending": pending}


@app.post("/api/tools/{name}")
def tool(name: str, args: dict = Body(default_factory=dict)):
    try:
        return registry.run_tool(name, args, _new_id("api"), "api")
    except KeyError as error:
        raise HTTPException(404, f"Unknown tool or id: {error}") from error
    except (ValueError, ValidationError) as error:
        raise HTTPException(422, str(error)) from error


@app.post("/api/audit")
def audit(bundle: dict = Body(...), llm: bool = False):
    if llm and settings.ai_enabled:
        from .agents.auditor.graph import audit as llm_audit

        return llm_audit(bundle, _model())
    report = checks.run(bundle)
    report["llm_checks"] = False
    return report


# ---- LLM layer -------------------------------------------------------------------------------


def _require_ai():
    if not settings.ai_enabled:
        raise HTTPException(503, "AI is off. Set OUREA_AI_ENABLED=1 and a model key.")


@lru_cache(maxsize=1)
def _model():
    from .agents.shared.model import chat_model

    return chat_model(settings)


@lru_cache(maxsize=1)
def _copilot():
    from .agents.copilot.graph import build_copilot

    return build_copilot(_model(), settings)


@lru_cache(maxsize=1)
def _interviewer():
    from .agents.interviewer.graph import build_interviewer

    return build_interviewer(_model(), settings)


class CopilotRequest(BaseModel):
    question: str = Field(min_length=1, max_length=600)
    thread_id: str | None = None


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.post("/api/agents/copilot")
async def copilot(request: CopilotRequest):
    _require_ai()
    from langchain_core.messages import HumanMessage

    graph = _copilot()
    thread_id = request.thread_id or _new_id("thread")
    run_id = _new_id("run")
    config = {"configurable": {"thread_id": thread_id, "run_id": run_id}}

    async def events():
        yield _sse("start", {"thread_id": thread_id, "run_id": run_id})
        try:
            async for chunk in graph.astream({"messages": [HumanMessage(request.question)]}, config, stream_mode="updates"):
                for node, update in chunk.items():
                    if node == "agent":
                        for call in getattr((update or {}).get("messages", [None])[-1], "tool_calls", None) or []:
                            yield _sse("tool", {"name": call["name"]})
                    elif node == "verify" and (update or {}).get("errors"):
                        yield _sse("retry", {"errors": update["errors"]})
                    yield _sse("node", {"name": node})
            state = (await graph.aget_state(config)).values
            tools = [{"tool": out["tool"], "fingerprint": out.get("fingerprint")} for out in state.get("tool_results") or []]
            yield _sse("answer", {"status": state.get("status"), "answer": state.get("answer"), "tools": tools})
        except Exception as error:  # noqa: BLE001 - surface to the drawer, keep the stream well-formed
            yield _sse("error", {"message": f"{type(error).__name__}: {error}"})
        finally:
            call_log.forget(run_id)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


class InterviewStart(BaseModel):
    thread_id: str | None = None
    synthetic: bool = True


class InterviewAnswer(BaseModel):
    thread_id: str
    answer: str = Field(min_length=1, max_length=2000)


@app.post("/api/agents/interview/start")
def interview_start(request: InterviewStart):
    _require_ai()
    from .agents.interviewer.graph import EngineNotReady, view

    thread_id = request.thread_id or _new_id("interview")
    try:
        result = _interviewer().invoke({"org": {"synthetic": request.synthetic}}, {"configurable": {"thread_id": thread_id}})
    except EngineNotReady as error:
        raise HTTPException(409, str(error)) from error
    demo = json.loads(DEMO.read_text(encoding="utf-8"))["answers"] if request.synthetic else {}
    return {"thread_id": thread_id, "synthetic": request.synthetic, "demo_answers": demo, **view(result)}


@app.post("/api/agents/interview/answer")
def interview_answer(request: InterviewAnswer):
    _require_ai()
    from langgraph.types import Command

    from .agents.interviewer.graph import view

    config = {"configurable": {"thread_id": request.thread_id}}
    graph = _interviewer()
    if not graph.get_state(config).next:
        raise HTTPException(404, "No interview waiting on this thread.")
    result = graph.invoke(Command(resume=request.answer), config)
    return {"thread_id": request.thread_id, **view(result)}
