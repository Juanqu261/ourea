"""A scripted chat model for the graph tests: no network, no key."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda


class ScriptedModel(GenericFakeChatModel):
    """Replays `script` in order. A dict item answers a with_structured_output call (parsed into the schema);
    an AIMessage answers a plain or tool-bound call. `calls` counts every invocation."""

    calls: list[str] = []

    @classmethod
    def of(cls, *script: Any) -> "ScriptedModel":
        items = [item if isinstance(item, AIMessage) else AIMessage(content=json.dumps(item, ensure_ascii=False)) for item in script]
        return cls(messages=iter(items), calls=[])

    def bind_tools(self, tools, **kwargs):  # noqa: ARG002
        return self

    def with_structured_output(self, schema, **kwargs):  # noqa: ARG002
        def run(messages):
            self.calls.append("structured")
            reply = self.invoke(messages)
            return schema.model_validate(json.loads(reply.content))

        return RunnableLambda(run)

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        self.calls.append("chat")
        return super()._generate(messages, stop=stop, run_manager=run_manager, **kwargs)


def tool_call(name: str, args: dict, call_id: str = "call-1") -> AIMessage:
    return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": call_id}])


def final(text: str = "") -> AIMessage:
    return AIMessage(content=text)
