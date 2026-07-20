import httpx
from httpx import ASGITransport, AsyncClient, MockTransport, Request, Response

from cloud.orchestrator.server import build_orchestrator_app
from shared.a2a_client import A2AClient
from shared.a2a_schemas import A2AMessage, A2ATaskResult


def _agent_handler(request: Request) -> Response:
    result = A2ATaskResult(
        task_id="t1",
        status="completed",
        message=A2AMessage.text("agent", "hello from agent"),
    )
    return Response(200, json=result.model_dump())


def _mock_client(base_url: str) -> A2AClient:
    return A2AClient(base_url, client=httpx.AsyncClient(transport=MockTransport(_agent_handler)))


async def test_chat_delegates_over_a2a_and_streams_sse() -> None:
    app = build_orchestrator_app({"exaone": _mock_client("http://exaone")})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/chat", json={"message": "hi", "agent": "exaone"})

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert "hello" in resp.text
    assert "[DONE]" in resp.text


async def test_chat_unknown_agent_is_404() -> None:
    app = build_orchestrator_app({"exaone": _mock_client("http://exaone")})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/chat", json={"message": "hi", "agent": "ghost"})
    assert resp.status_code == 404
