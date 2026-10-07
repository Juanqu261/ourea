"""The chat model, provider-agnostic through init_chat_model (decision A3)."""

from __future__ import annotations

import os

from ...config import Settings


def chat_model(settings: Settings):
    from langchain.chat_models import init_chat_model

    kwargs = {}
    temperature = os.environ.get("OUREA_MODEL_TEMPERATURE", "0")
    if temperature.lower() != "none":  # some reasoning models reject the parameter
        kwargs["temperature"] = float(temperature)
    return init_chat_model(settings.model, model_provider=settings.model_provider or "openai", **kwargs)
