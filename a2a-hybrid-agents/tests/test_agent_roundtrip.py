import httpx
from httpx import ASGITransport, AsyncClient, MockTransport, Request, Response

from onprem.agents._app import build_agent_app
from shared.a2a_client import A2AClient
from shared.a2a_schemas import A2AMessage, A2ATaskRequest, A2ATaskResult, AgentCard


class FakeLLM:
    async def generate(self, model: str, prompt: str, keep_alive: str) -> str:
        return f"draft::{prompt}"


class RecordingGraph:
    def __init__(self) -> None:
        self.agents: list[str] = []

    def record_exchange(
        self,
        *,
        agent: str,
        task_id: str,
        prompt: str,
        result_id: str,
        content: str,
        ts: str,
    ) -> None:
        self.agents.append(agent)


def _qwen_handler(request: Request) -> Response:
    result = A2ATaskResult(
        task_id="q1",
        status="completed",
        message=A2AMessage.text("agent", "refined answer"),
    )
    return Response(200, json=result.model_dump())


async def test_exaone_delegates_to_qwen_and_records_both_legs() -> None:
    graph = RecordingGraph()
    downstream = A2AClient(
        "http://qwen",
        client=httpx.AsyncClient(transport=MockTransport(_qwen_handler)),
    )
    app = build_agent_app(
        agent_name="exaone",
        model="exaone3.5:2.4b",
        card=AgentCard(name="exaone", description="d", url="http://exaone"),
        llm=FakeLLM(),
        graph=graph,
        downstream=downstream,
        downstream_name="qwen",
    )

    payload = A2ATaskRequest(message=A2AMessage.text("user", "question")).model_dump()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/a2a/tasks", json=payload)

    assert resp.status_code == 200
    result = A2ATaskResult.model_validate(resp.json())
    assert result.message.content == "refined answer"
    # Round trip logged: EXAONE's own leg + the delegated Qwen leg.
    assert graph.agents == ["exaone", "qwen"]


async def test_agent_exposes_card_and_mcp_tools() -> None:
    app = build_agent_app(
        agent_name="qwen",
        model="qwen2.5:1.5b",
        card=AgentCard(name="qwen", description="d", url="http://qwen"),
        llm=FakeLLM(),
        graph=RecordingGraph(),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        card = await ac.get("/.well-known/agent.json")
        tools = await ac.get("/mcp/tools")

    assert card.status_code == 200
    assert card.json()["name"] == "qwen"
    assert tools.json()[0]["name"] == "generate"
