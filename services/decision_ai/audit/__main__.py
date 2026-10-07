"""QA: uv run python -m services.decision_ai.audit <export.json>. Exit 1 when a critical finding blocks export."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from .checks import run


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: uv run python -m services.decision_ai.audit <export.json>", file=sys.stderr)
        return 2
    bundle = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
    report = run(bundle.get("audit_bundle", bundle))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"{report['critical']} hallazgos críticos · {report['verified_claims']} afirmaciones verificadas", file=sys.stderr)
    return 0 if report["export_allowed"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
