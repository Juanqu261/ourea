"""CLI: uv run python -m services.decision_ai.ask "¿Y si exigimos infraestructura gris?"  (needs a model key)."""

from __future__ import annotations

import sys
import uuid

from .agents.copilot.graph import ask, build_copilot, dumps
from .agents.shared.model import chat_model
from .config import ROOT, load_settings
from .tools import call_log


def main(argv: list[str]) -> int:
    if not argv:
        print('usage: uv run python -m services.decision_ai.ask "pregunta" ["otra pregunta" …]', file=sys.stderr)
        return 2
    try:
        from dotenv import load_dotenv

        load_dotenv(ROOT / ".env")
    except ImportError:
        pass
    settings = load_settings()
    if not settings.ai_enabled:
        print("AI is off. Set OUREA_AI_ENABLED=1 and OPENAI_API_KEY in .env.", file=sys.stderr)
        return 1
    call_log.configure(settings.log_dir)
    graph = build_copilot(chat_model(settings), settings)
    thread = f"cli-{uuid.uuid4().hex[:8]}"
    for question in argv:  # several questions share one thread, so follow-ups work
        print(f"> {question}")
        print(dumps(ask(graph, question, thread, f"run-{uuid.uuid4().hex[:12]}")))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
