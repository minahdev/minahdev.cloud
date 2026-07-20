"""EXAONE 3.5 2.4B agent (Ollama, GPU).

Owns the shared Kùzu graph and delegates a refinement sub-task to the Qwen
agent over A2A — this is the round trip the validation checks.
"""

from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from onprem.agents._app import build_agent_app
from onprem.graph_store import GraphStore
from onprem.llm.ollama_client import OllamaClient
from shared.a2a_client import A2AClient
from shared.a2a_schemas import AgentCard, Skill
from shared.config import get_settings

AGENT_NAME = "exaone"


def create_app() -> FastAPI:
    settings = get_settings()
    card = AgentCard(
        name=AGENT_NAME,
        description="EXAONE 3.5 2.4B reasoning agent (on-prem GPU).",
        url=settings.exaone_local_url,
        skills=[
            Skill(id="reason", name="reason", description="Draft an answer, then refine via Qwen."),
        ],
    )
    return build_agent_app(
        agent_name=AGENT_NAME,
        model=settings.exaone_model,
        card=card,
        llm=OllamaClient(settings.ollama_host),
        graph=GraphStore(settings.kuzu_db_path),
        downstream=A2AClient(settings.qwen_local_url),
        downstream_name="qwen",
    )


def main() -> None:
    settings = get_settings()
    uvicorn.run(create_app(), host="0.0.0.0", port=settings.exaone_port)


if __name__ == "__main__":
    main()
