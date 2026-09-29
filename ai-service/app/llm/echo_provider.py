"""Zero-dependency provider, always available with no API key and no model
download. Useful for two things: getting the whole system running with zero
setup, and — since it inspects the prompt it's given — visibly confirming
that retrieval and tool calling are wiring real data into the prompt
correctly, before you've configured a real LLM_PROVIDER to actually answer
from it.

It never pretends to be a real answer. That's deliberate: it would be worse
to have scaffold output that looks like a genuine response than to have
scaffold output that's obviously not one.
"""
import re
import time

from app.llm.base import ChatMessage, LLMProvider, LLMResponse

# chat.py's grounded system prompt lists retrieved chunks as "[Source N: filename]".
_SOURCE_MARKER = re.compile(r"\[Source \d+: ([^\]]+)\]")  # MARKER999
# support_agent.py's tool-result prompts always contain "Tool: <name>".
_TOOL_MARKER = re.compile(r"Tool: (\w+)\n(Data|Result|Error): (.+)", re.DOTALL)


class EchoProvider(LLMProvider):
    name = "echo"

    def __init__(self, model_name: str = "echo-1"):
        self.model_name = model_name

    async def generate_response(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> LLMResponse:
        started = time.perf_counter()
        last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        system_content = next((m.content for m in messages if m.role == "system"), "")

        tool_match = _TOOL_MARKER.search(system_content)
        sources = _SOURCE_MARKER.findall(system_content)

        if tool_match:
            tool_name, kind, payload = tool_match.groups()
            text = (
                f"[echo provider] Tool `{tool_name}` ran and returned a {kind.lower()}. No real "
                f"language model is configured, so I can't turn that into a natural reply — but "
                f"this confirms the tool-calling pipeline reached a real backend lookup for: "
                f'"{last_user.strip()[:200]}". Raw result: {payload.strip()[:300]}. Set '
                "LLM_PROVIDER in ai-service/.env to a real provider for a phrased answer."
            )
        elif sources:
            unique_sources = ", ".join(dict.fromkeys(sources))  # de-dupe, keep order
            text = (
                f"[echo provider] Retrieval found {len(sources)} relevant chunk(s) from: "
                f"{unique_sources}. No real language model is configured, so I can't turn "
                f"that into an actual answer — but this confirms the retrieval pipeline is "
                f'wiring real knowledge-base content into the prompt for: "{last_user.strip()[:200]}". '
                "Set LLM_PROVIDER in ai-service/.env to a real provider to get real answers."
            )
        else:
            text = (
                "[echo provider] No language model is configured, so I can't answer this for "
                f'real, and neither retrieval nor a tool found anything for: "{last_user.strip()[:200]}". '
                "Set LLM_PROVIDER in ai-service/.env to a real provider once you're ready."
            )

        latency_ms = int((time.perf_counter() - started) * 1000)
        return LLMResponse(
            text=text,
            model=self.model_name,
            provider=self.name,
            latency_ms=latency_ms,
        )
