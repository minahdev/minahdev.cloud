"""Tiny A2A HTTP client (httpx).

Not in the original structure list, but the skeleton needs *some* way for one
unit to call another over A2A (orchestrator → agent, and agent → agent). Kept
in ``shared`` because both the cloud and on-prem units use it.
"""

from __future__ import annotations

import httpx

from shared.a2a_schemas import A2ATaskRequest, A2ATaskResult, AgentCard


class A2AClient:
    """Talks to a single remote agent's A2A surface."""

    def __init__(self, base_url: str, *, client: httpx.AsyncClient | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = client or httpx.AsyncClient(timeout=120.0)

    async def get_card(self) -> AgentCard:
        resp = await self._client.get(f"{self._base_url}/.well-known/agent.json")
        resp.raise_for_status()
        return AgentCard.model_validate(resp.json())

    async def send_task(self, request: A2ATaskRequest) -> A2ATaskResult:
        resp = await self._client.post(
            f"{self._base_url}/a2a/tasks",
            json=request.model_dump(),
        )
        resp.raise_for_status()
        return A2ATaskResult.model_validate(resp.json())

    async def aclose(self) -> None:
        await self._client.aclose()
