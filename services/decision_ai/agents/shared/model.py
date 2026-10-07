"""The chat model, provider-agnostic through init_chat_model (decision A3)."""

from __future__ import annotations

import os

from ...config import Settings


def temperature_for(configured: str | None) -> float | None:
    """None means: do not send the parameter. Reasoning models (gpt-5 and later, o-series) reject it,
    so it is sent only when OUREA_MODEL_TEMPERATURE is set. Determinism comes from `verify`, not from it."""
    if configured is None or not configured.strip() or configured.strip().lower() == "none":
        return None
    return float(configured)


def chat_model(settings: Settings):
    from langchain.chat_models import init_chat_model

    kwargs = {}
    temperature = temperature_for(os.environ.get("OUREA_MODEL_TEMPERATURE"))
    if temperature is not None:
        kwargs["temperature"] = temperature
    return init_chat_model(settings.model, model_provider=settings.model_provider or "openai", **kwargs)
