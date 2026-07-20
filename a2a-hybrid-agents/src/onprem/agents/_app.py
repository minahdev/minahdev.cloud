"""Shared FastAPI app factory for on-prem LLM agents.

Both agents are identical plumbing (A2A surface + MCP tool listing + graph
logging); only their name/model/card differ, so they share this factory
instead of copy-pasting a server. Dependencies are injected (LLM, graph,
optional downstream A2A client) which also makes them trivial to mock.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol
from uuid import uuid4

import structlog
from fastapi import FastAPI

from shared.a2a_client import A2AClient
from shared.a2a_schemas import A2AMessage, A2ATaskRequest, A2ATaskResult, AgentCard
from shared.mcp_tools import TOOLS, ToolSpec

log = structlog.get_logger(__name__)


class SupportsGenerate(Protocol):
    async def generate(self, model: str, prompt: str, keep_alive: str) -> str: ...


class SupportsRecord(Protocol):
    def record_exchange(
        self,
        *,
        agent: str,
        task_id: str,
        prompt: str,
        result_id: str,
        content: str,
        ts: str,
    ) -> None: ...


def _now() -> str:
    return datetime.now(UTC).isoformat()


def build_agent_app(
    *,
    agent_name: str,
    model: str,
    card: AgentCard,
    llm: SupportsGenerate,
    graph: SupportsRecord,
    keep_alive: str = "5m",
    downstream: A2AClient | None = None,
    downstream_name: str | None = None,
) -> FastAPI:
    app = FastAPI(title=f"{agent_name} agent")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "agent": agent_name}

    @app.get("/.well-known/agent.json")
    async def agent_json() -> AgentCard:
        return card

    @app.get("/mcp/tools")
    async def mcp_tools() -> list[ToolSpec]:
        return TOOLS

    @app.post("/a2a/tasks")
    async def handle_task(request: A2ATaskRequest) -> A2ATaskResult:
        prompt = request.message.content
        text = await llm.generate(model, prompt, keep_alive)
        graph.record_exchange(
            agent=agent_name,
            task_id=request.task_id,
            prompt=prompt,
            result_id=uuid4().hex,
            content=text,
            ts=_now(),
        )

        final = text
        # Agent-to-agent delegation: hand the draft to a peer for refinement.
        if downstream is not None:
            sub = A2ATaskRequest(
                message=A2AMessage.text("user", f"Improve this answer:\n{text}"),
            )
            sub_result = await downstream.send_task(sub)
            graph.record_exchange(
                agent=downstream_name or "downstream",
                task_id=sub.task_id,
                prompt=sub.message.content,
                result_id=uuid4().hex,
                content=sub_result.message.content,
                ts=_now(),
            )
            final = sub_result.message.content

        return A2ATaskResult(
            task_id=request.task_id,
            status="completed",
            message=A2AMessage.text("agent", final),
        )

    log.info(
        "agent.app.built",
        agent=agent_name,
        model=model,
        has_downstream=downstream is not None,
    )
    return app
