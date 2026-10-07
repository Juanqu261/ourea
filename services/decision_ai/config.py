"""Service settings from the environment (.env at the repo root)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVICE = Path(__file__).resolve().parent
VAR = SERVICE / "var"


def _flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    ai_enabled: bool = False
    model: str = "gpt-5.6-terra"
    model_provider: str | None = None
    allowed_origins: tuple[str, ...] = ()
    max_tool_calls: int = 6
    max_verify_retries: int = 2
    max_words: int = 120
    # Supuesto: a gap is worth asking while some measure it touches would switch
    # with a change of at most 2× its score (switching ratio = 1 + distance).
    flip_threshold: float = 2.0
    langsmith: bool = False
    log_dir: Path = field(default=VAR / "logs")
    interview_dir: Path = field(default=VAR / "interviews")
    # Dev only: order interview questions by gap priority when VOI is missing.
    interview_priority_fallback: bool = False


def load_settings() -> Settings:
    origins = tuple(o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip())
    return Settings(
        ai_enabled=_flag("OUREA_AI_ENABLED") and bool(os.environ.get("OPENAI_API_KEY") or os.environ.get("OUREA_MODEL_PROVIDER")),
        model=os.environ.get("OPENAI_MODEL", Settings.model),
        model_provider=os.environ.get("OUREA_MODEL_PROVIDER") or None,
        allowed_origins=origins,
        flip_threshold=float(os.environ.get("OUREA_FLIP_THRESHOLD", Settings.flip_threshold)),
        langsmith=_flag("LANGSMITH_TRACING"),
        interview_priority_fallback=_flag("OUREA_INTERVIEW_PRIORITY_FALLBACK"),
    )
