"""Live eval (manual, needs a key): uv run python -m services.decision_ai.eval [--only id,id]

Pass = the answer verifies within 2 tries (no fallback), the expected tool is called, traps are refused.
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid

from .agents.copilot.graph import ask, build_copilot
from .agents.shared.model import chat_model
from .config import ROOT, load_settings
from .tools import call_log

QUESTIONS = ROOT / "tests" / "fixtures" / "ai" / "copilot_questions.jsonl"


def grade(case: dict, result: dict) -> list[str]:
    problems = []
    if result["status"] != case["expect"]:
        problems.append(f"status {result['status']} != {case['expect']}")
    called = {row["tool"] for row in result["tools"]}
    if case["tools"] and not called & set(case["tools"]):
        problems.append(f"expected one of {case['tools']}, called {sorted(called)}")
    if case.get("contains") and case["contains"] not in (result["answer"] or {}).get("respuesta", ""):
        problems.append(f"missing «{case['contains']}»")
    return problems


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    args = parser.parse_args(argv)
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
    cases = [json.loads(line) for line in QUESTIONS.read_text(encoding="utf-8").splitlines() if line.strip()]
    only = {item for item in args.only.split(",") if item}
    threads: dict[str, str] = {}
    failures = 0
    for case in cases:
        if only and case["id"] not in only:
            continue
        thread = threads.get(case.get("follows", ""), f"eval-{uuid.uuid4().hex[:8]}")
        threads[case["id"]] = thread
        result = ask(graph, case["question"], thread, f"eval-{case['id']}-{uuid.uuid4().hex[:6]}")
        problems = grade(case, result)
        failures += bool(problems)
        print(f"{'PASS' if not problems else 'FAIL'} {case['id']}: {'; '.join(problems)}")
        print(f"     {(result['answer'] or {}).get('respuesta', '')}")
    print(f"{failures} failing")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
