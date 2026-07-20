"""Qwen2.5 1.5B agent (Ollama, GPU).

Peer/refiner. Must stay 1.5B (4GB VRAM hard limit). Does not open the shared
Kùzu DB (single-writer) — EXAONE logs the round trip, so Qwen uses NullGraph.
"""

from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from onprem.agents._app import build_agent_app
from onprem.graph_store import NullGraph
from onprem.llm.ollama_client import OllamaClient
from shared.a2a_schemas import AgentCard, Skill
from shared.config import get_settings

AGENT_NAME = "qwen"


def create_app() -> FastAPI:
    settings = get_settings()
    card = AgentCard(
        name=AGENT_NAME,
        description="Qwen2.5 1.5B refiner agent (on-prem GPU).",
        url=settings.qwen_local_url,
        skills=[
            Skill(id="refine", name="refine", description="Improve/critique a draft answer."),
        ],
    )
    return build_agent_app(
        agent_name=AGENT_NAME,
        model=settings.qwen_model,
        card=card,
        llm=OllamaClient(settings.ollama_host),
        graph=NullGraph(),
    )


def main() -> None:
    settings = get_settings()
    uvicorn.run(create_app(), host="0.0.0.0", port=settings.qwen_port)


if __name__ == "__main__":
    main()
