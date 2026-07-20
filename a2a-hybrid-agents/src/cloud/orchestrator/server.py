"""AWS orchestrator — A2A router. NO AI here.

Takes a frontend request, delegates it to an on-prem agent over A2A, and
streams the result back as SSE. Contains zero LLM/GPU/DB dependencies, so
`uv sync --extra orchestrator` stays light enough for a t3.micro.

A2A clients are injected so the app is testable with mocked agents.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from shared.a2a_client import A2AClient
from shared.a2a_schemas import A2AMessage, A2ATaskRequest
from shared.config import get_settings

log = structlog.get_logger(__name__)


class ChatRequest(BaseModel):
    message: str
    agent: str = "exaone"


async def _sse(text: str) -> AsyncIterator[str]:
    """Chunk a finished A2A result into SSE events (word by word)."""
    for word in text.split(" "):
        yield f"data: {word}\n\n"
    yield "data: [DONE]\n\n"


def build_orchestrator_app(clients: dict[str, A2AClient]) -> FastAPI:
    app = FastAPI(title="a2a orchestrator")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/agents")
    async def agents() -> dict[str, object]:
        cards: dict[str, object] = {}
        for name, client in clients.items():
            try:
                cards[name] = (await client.get_card()).model_dump()
            except Exception as exc:  # noqa: BLE001 - discovery is best-effort
                cards[name] = {"error": str(exc)}
        return cards

    @app.post("/chat")
    async def chat(request: ChatRequest) -> StreamingResponse:
        client = clients.get(request.agent)
        if client is None:
            raise HTTPException(status_code=404, detail=f"unknown agent: {request.agent}")
        task = A2ATaskRequest(message=A2AMessage.text("user", request.message))
        result = await client.send_task(task)
        log.info("orchestrator.delegated", agent=request.agent, task_id=task.task_id)
        return StreamingResponse(_sse(result.message.content), media_type="text/event-stream")

    return app


def create_app() -> FastAPI:
    settings = get_settings()
    # Local validation talks to localhost ports; in prod point these at the
    # Cloudflare tunnel (settings.onprem_tunnel_url).
    clients = {
        "exaone": A2AClient(settings.exaone_local_url),
        "qwen": A2AClient(settings.qwen_local_url),
    }
    return build_orchestrator_app(clients)


def main() -> None:
    settings = get_settings()
    uvicorn.run(create_app(), host="0.0.0.0", port=settings.orch_port)


if __name__ == "__main__":
    main()
