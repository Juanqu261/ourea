"""JSONL call log (replay source, §5.2) plus the full outputs of each run for the verifier."""

from __future__ import annotations

import hashlib
import json
import threading
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

_lock = threading.Lock()
_runs: dict[str, list[dict]] = defaultdict(list)
_log_dir: Path | None = None


def configure(log_dir: Path | None) -> None:
    """None disables the file log (tests); outputs still stay in memory per run."""
    global _log_dir
    _log_dir = log_dir


def _sha(payload) -> str:
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")).hexdigest()


def record(run_id: str, agent: str, tool: str, tool_input: dict, output: dict) -> dict:
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "run_id": run_id,
        "agent": agent,
        "tool": tool,
        "input": tool_input,
        "fingerprint": output.get("fingerprint"),
        "output_sha": _sha(output),
    }
    with _lock:
        _runs[run_id].append({"tool": tool, "input": tool_input, **output})
        if _log_dir is not None:
            _log_dir.mkdir(parents=True, exist_ok=True)
            day = entry["ts"][:10]
            with (_log_dir / f"calls-{day}.jsonl").open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, ensure_ascii=False, default=str) + "\n")
    return entry


def outputs(run_id: str) -> list[dict]:
    with _lock:
        return list(_runs.get(run_id, []))


def forget(run_id: str) -> None:
    with _lock:
        _runs.pop(run_id, None)
