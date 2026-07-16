"""시맨틱 라우터 (No QLoRA · One Model PoC).

단 하나의 Qwen2.5-1.5B(Ollama)가 '라우터'와 'RAG 답변기'를 겸한다.
호출마다 system_prompt만 갈아 끼우는 Dynamic Prompting 방식이라 VRAM 추가
소모가 없어 RTX 3050(8GB)에서도 쾌적하다. QLoRA 학습 불필요.

                    ┌──────── [ User Question ] ────────┐
                    ▼                                    ▼
        [ 1역: 라우팅 프롬프트 ]              [ 2역: RAG 답변 프롬프트 ]
        "질문 의도를 JSON으로 분류"            "주어진 Context로만 답변"
                    └────────────────┬──────────────────┘
                                     ▼
                    [ 단 하나의 Qwen2.5-1.5B (상시 대기) ]

  destination:
    - crud   : 데이터 생성/수정/삭제 요구 → DB 조작 (PoC 스텁)
    - rag    : DB에서 사실을 찾아야 하는 질문 → 검색(bge-m3+pgvector) + Qwen 생성
    - gemini : 일반 상식·대화 등 DB 불필요 → Gemini(Keymaker)가 답변
"""

from __future__ import annotations

import json
import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from core.matrix.secret_manager import Keymaker, get_keymaker

from moneyball.app.ports.input.soccer_retrieval_use_case import SoccerRetrievalUseCase
from moneyball.dependencies.soccer_retrieval_provider import get_soccer_retrieval_use_case

logger = logging.getLogger(__name__)

semantic_router = APIRouter(prefix="/semantic", tags=["semantic-router"])

_OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
_ROUTER_MODEL = os.getenv("SEMANTIC_ROUTER_MODEL", "qwen2.5:1.5b")

_ROUTING_PROMPT = """너는 입력된 질문의 의도를 파악하는 분류 비서야.
아래 JSON 형식으로만 응답해. 다른 설명·텍스트는 절대 붙이지 마.

출력 스키마:
{"destination": "crud" | "rag" | "gemini", "entities": ["핵심 단어나 고유명사"]}

[분류 기준]
- 데이터 생성/수정/삭제를 명확히 요구: "crud"
- 특정 선수·팀 등 DB에서 사실을 찾아야 하는 질문: "rag"
- 일상 대화·인사·일반 상식 등 DB가 필요 없는 질문: "gemini"

[예시]
질문: "우르모브 선수 국적이 어디야?"
답변: {"destination": "rag", "entities": ["우르모브", "국적"]}
"""


class RouteRequest(BaseModel):
    question: str


class RouteResponse(BaseModel):
    destination: str
    text: str


class QAHarness:
    """1인 2역 하네스 — 단일 Qwen이 라우터+RAG 답변기, 일반 질문은 Gemini로 위임."""

    def __init__(self, retrieval: SoccerRetrievalUseCase, keymaker: Keymaker) -> None:
        self._retrieval = retrieval
        self._keymaker = keymaker

    async def _generate(
        self, system_prompt: str, user_prompt: str, *, force_json: bool = False
    ) -> str:
        """단일 Qwen2.5-1.5B(Ollama) 호출 — 역할은 system_prompt로 갈아 끼운다."""
        payload: dict[str, object] = {
            "model": _ROUTER_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
        }
        if force_json:
            payload["format"] = "json"  # Ollama 구조화 출력 강제
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(_OLLAMA_URL, json=payload)
            resp.raise_for_status()
            return str(resp.json()["message"]["content"])

    async def execute(self, question: str) -> RouteResponse:
        # ── 1역: 시맨틱 라우팅 ──────────────────────────
        try:
            raw = await self._generate(_ROUTING_PROMPT, question, force_json=True)
            decision = json.loads(raw)
            destination = str(decision.get("destination", "rag"))
            entities = list(decision.get("entities", []) or [])
        except (httpx.HTTPError, json.JSONDecodeError, TypeError) as e:
            # 가드레일: 파싱 실패 시 rag로 우회
            logger.warning("[semantic] 라우팅 실패 → rag 폴백 | %s", e)
            destination, entities = "rag", []
        logger.info("[semantic] destination=%s | entities=%s", destination, entities)

        # ── 흐름 통제 (Deterministic Controller) ─────────
        if destination == "crud":
            target = ", ".join(entities) or question
            return RouteResponse(
                destination="crud",
                text=f"[CRUD 감지] '{target}' — DB 조작 경로 (PoC 스텁, 미구현)",
            )

        if destination == "gemini":
            # 일반 질문은 Gemini가 답변
            try:
                reply, _ = await run_in_threadpool(
                    self._keymaker.send_chat, [], question
                )
            except Exception as e:  # noqa: BLE001 — 외부 API 오류를 502로 래핑
                raise HTTPException(status_code=502, detail=f"Gemini 오류: {e}") from e
            return RouteResponse(destination="gemini", text=reply)

        # ── 2역: RAG 본 답변 (검색=bge-m3+pgvector, 생성=Qwen) ──
        contexts = await self._retrieval.retrieve_context(question, top_k=5)
        if not contexts:  # 가드레일: 근거 없으면 환각 대신 차단
            target = ", ".join(entities) or question
            return RouteResponse(
                destination="rag",
                text=f"DB에서 '{target}' 관련 정보를 찾을 수 없습니다.",
            )

        rag_system = (
            "너는 제공된 [Context]의 사실에만 근거해 정직하게 답하는 AI야. "
            "Context에 없는 내용을 추측하거나 외부 지식으로 지어내는 것은 금지야.\n\n"
            "[Context]\n" + "\n".join(f"- {c}" for c in contexts)
        )
        answer = await self._generate(rag_system, question)
        return RouteResponse(destination="rag", text=answer)


@semantic_router.post("/route", response_model=RouteResponse)
async def route(
    req: RouteRequest,
    retrieval: SoccerRetrievalUseCase = Depends(get_soccer_retrieval_use_case),
    km: Keymaker = Depends(get_keymaker),
) -> RouteResponse:
    """시맨틱 라우터 진입점 — Qwen 하나로 1인 2역."""
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="질문이 비어 있습니다.")
    harness = QAHarness(retrieval=retrieval, keymaker=km)
    return await harness.execute(question)
