from __future__ import annotations

import json
import logging
import os

import httpx
from starlette.concurrency import run_in_threadpool

from core.matrix.secret_manager import Keymaker

from moneyball.app.ports.input.player_sql_use_case import PlayerSqlUseCase, UnsafeSqlError
from moneyball.app.ports.input.soccer_retrieval_use_case import SoccerRetrievalUseCase

logger = logging.getLogger(__name__)

_OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
_QWEN_MODEL = os.getenv("SOCCER_COACH_MODEL", "qwen2.5:1.5b")

_ROUTING_PROMPT = """너는 축구 코치 챗봇의 질문 분류기야.
아래 JSON 형식으로만 답해. 다른 텍스트는 절대 붙이지 마.

{"destination": "embedding" | "sql" | "gemini"}

- 이름으로 특정 선수·팀의 속성 조회 (국적·별명·포지션·등번호 등): "embedding"
- 조건 필터·집계·최상급·정렬·개수 (생일=날짜, 나이 범위, 키 제일 큰, 몇 명 등): "sql"
- 축구 DB와 무관한 일반 지식·상식·대화: "gemini"

예) "우르모브 국적이 어디야?"         → {"destination": "embedding"}
예) "키가 제일 큰 선수는 누구야?"      → {"destination": "sql"}
예) "생년월일이 1983-06-23인 선수?"   → {"destination": "sql"}
예) "안드레 카파시가 누구야?"         → {"destination": "gemini"}
"""

_SQL_GEN_PROMPT = """너는 PostgreSQL SELECT 생성기야.
아래 player 테이블에 대해 질문에 답할 SELECT 문 하나만 출력해.
설명·마크다운·주석·세미콜론 없이 SQL만 출력해.

player 컬럼:
  player_name(이름), e_player_name(영문명), nickname(별명), position(포지션),
  back_no(등번호 int), nation(국적), birth_date(생년월일 date),
  height(키 cm int), weight(몸무게 kg int), team_id(팀), join_yyyy(입단연도)

규칙:
- SELECT 문만 사용.
- 나이는 EXTRACT(YEAR FROM AGE(birth_date)) 로 계산.
- 결과에 player_name(이름)을 항상 포함.
- 여러 건일 수 있으면 적절히 LIMIT 사용.
"""

_RAG_GUIDE = (
    "너는 '머니볼 코치'야. 아래 [축구 DB 컨텍스트]의 사실에만 근거해 한국어로 "
    "간결하게 답해. 컨텍스트에 없는 내용은 지어내지 말고 모른다고 해.\n\n"
    "[축구 DB 컨텍스트]\n"
)


class SoccerCoachOrchestrator:
    """축구 코치 허브 — 질문을 Qwen으로 분류해 3갈래로 보낸다.

    - embedding : 벡터 검색(bge-m3+pgvector) + Qwen 생성   (RAG · 의미 조회)
    - sql       : Qwen text-to-SQL → 안전 실행 → Qwen 생성  (RAG · 필터/집계/최상급)
    - gemini    : 일반 지식·대화 (Keymaker)                 (RAG 아님)

    할루시네이션 방어: 근거(검색결과/DB행)가 없으면 모델에 안 넘기고 차단.
    Qwen 호출은 temperature 0 (결정적).
    """

    def __init__(
        self,
        retrieval: SoccerRetrievalUseCase,
        player_sql: PlayerSqlUseCase,
        keymaker: Keymaker,
    ) -> None:
        self._retrieval = retrieval
        self._player_sql = player_sql
        self._keymaker = keymaker

    async def _qwen(
        self, system_prompt: str, user_prompt: str, *, force_json: bool = False
    ) -> str:
        """단일 Qwen2.5-1.5B(Ollama) 호출 — 역할은 system_prompt로 갈아 끼운다."""
        payload: dict[str, object] = {
            "model": _QWEN_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {"temperature": 0},  # 결정적 → 창작·할루시네이션 억제
        }
        if force_json:
            payload["format"] = "json"  # 구조화 출력 강제
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(_OLLAMA_URL, json=payload)
            resp.raise_for_status()
            return str(resp.json()["message"]["content"])

    async def answer(self, messages: list[dict]) -> str:
        question = next(
            (m.get("content", "") for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        logger.info("[coach][1/3] 질문 수신 | q=%s", question[:60])

        # 1) 시맨틱 라우팅
        try:
            raw = await self._qwen(_ROUTING_PROMPT, question, force_json=True)
            destination = str(json.loads(raw).get("destination", "embedding"))
        except (httpx.HTTPError, json.JSONDecodeError, TypeError) as e:
            logger.warning("[coach] 라우팅 실패 → embedding 폴백 | %s", e)
            destination = "embedding"
        logger.info("[coach][2/3] destination=%s", destination)

        # 2) 분기
        if destination == "gemini":
            return await self._answer_gemini(messages, question)
        if destination == "sql":
            return await self._answer_sql(question)
        return await self._answer_embedding(question)

    async def _answer_gemini(self, messages: list[dict], question: str) -> str:
        history = [
            {"role": "user" if m["role"] == "user" else "model", "parts": m["content"]}
            for m in messages[:-1]
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]
        reply, model_used = await run_in_threadpool(
            self._keymaker.send_chat, history, question
        )
        logger.info("[coach][3/3] Gemini 답변 | model=%s", model_used)
        return reply

    async def _answer_sql(self, question: str) -> str:
        sql = await self._qwen(_SQL_GEN_PROMPT, question)
        try:
            rows = await self._player_sql.run_select(sql)
        except UnsafeSqlError as e:
            logger.warning("[coach][3/3][sql] 가드레일 차단 | %s", e)
            return "안전하지 않은 조회라 실행하지 않았어요. 질문을 조금 바꿔서 다시 물어봐 주세요."
        except Exception as e:  # noqa: BLE001 — SQL 문법 오류 등은 '못 찾음'으로 처리
            logger.warning("[coach][3/3][sql] 실행 실패 | %s", e)
            return "조건에 맞는 데이터를 조회하지 못했어요. 질문을 조금 더 명확히 해주세요."

        if not rows:  # 가드레일: 근거 없으면 지어내지 말고 차단
            logger.info("[coach][3/3][sql] 결과 0건 → 차단")
            return "축구 DB에서 조건에 맞는 선수를 찾지 못했어요."

        # 조회된 행(사실)만 근거로 자연어 답변 (없는 값 추가 금지)
        facts = "\n".join(
            ", ".join(f"{k}={v}" for k, v in row.items() if v is not None) for row in rows
        )
        answer_system = (
            "너는 아래 [DB 조회 결과]에 있는 값만 사용해 한국어로 간결히 답하는 AI야. "
            "결과에 없는 정보는 절대 추가하거나 추측하지 마.\n\n"
            f"[DB 조회 결과]\n{facts}"
        )
        logger.info("[coach][3/3][sql] 답변 생성 | rows=%d", len(rows))
        return await self._qwen(answer_system, question)

    async def _answer_embedding(self, question: str) -> str:
        contexts = await self._retrieval.retrieve_context(question, top_k=8)
        if not contexts:  # 가드레일: 근거 없으면 차단
            logger.info("[coach][3/3][embedding] 컨텍스트 0건 → 차단")
            return "축구 DB에서 관련 선수 정보를 찾지 못했어요. 선수 이름을 정확히 알려주시겠어요?"

        rag_system = _RAG_GUIDE + "\n".join(f"- {c}" for c in contexts)
        logger.info("[coach][3/3][embedding] 답변 생성 | ctx=%d건", len(contexts))
        return await self._qwen(rag_system, question)
