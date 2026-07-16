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

_ROUTING_PROMPT = """너는 '머니볼 코치'(한국 축구 선수 DB 챗봇)의 질문 분류기야.
JSON으로만 답해. 다른 텍스트는 절대 붙이지 마.

{"destination": "embedding" | "sql" | "gemini"}

1단계 — 이 질문의 대상이 "우리 축구 선수 DB의 선수"인가?
  • 아니다 (프로그래밍·코드·요리·날씨·감정·일반 상식·잡담 등) → "gemini"
  • 그렇다 → 2단계로.

2단계 — 선수가 대상일 때만:
  • 조건·집계·정렬·개수·날짜·범위로 선수를 찾기 (생일=날짜, 나이·키 범위, 가장 큰 선수, 선수 몇 명) → "sql"
  • 특정 선수 이름의 속성 조회 (국적·별명·포지션·등번호) → "embedding"

주의: '정렬·개수·최대' 같은 단어가 있어도 대상이 축구 선수가 아니면 무조건 "gemini".

예) "파이썬으로 리스트 정렬하는 법?"   → {"destination": "gemini"}   (코드 질문, 선수 아님)
예) "오늘 날씨 어때?"                 → {"destination": "gemini"}
예) "기분이 안 좋아, 위로해줘"        → {"destination": "gemini"}
예) "안드레 카파시가 누구야?"         → {"destination": "gemini"}   (DB에 없는 인물)
예) "키가 가장 큰 선수는 누구야?"      → {"destination": "sql"}
예) "생년월일이 1983-06-23인 선수?"   → {"destination": "sql"}
예) "나이가 30살 이상인 선수 몇 명?"   → {"destination": "sql"}
예) "우르모브 국적이 어디야?"         → {"destination": "embedding"}
예) "박지성 포지션이 뭐야?"           → {"destination": "embedding"}
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

# 축구 외 일반 질문을 gemini로 답할 때 쓰는 중립 페르소나
# (홈 화면의 'Pace 헬스케어' 페르소나와 분리 — 특정 정체성 없이 질문에 곧바로 답)
_GEMINI_GENERAL_INSTRUCTION = """당신은 친절하고 정확한 AI 어시스턴트입니다. 한국어로 간결하게 답하세요.

가독성 규칙:
- 문단은 2~3문장으로 짧게 나누고, 문단 사이에 빈 줄을 넣으세요.
- 목록은 `-` 또는 `1.` 번호 목록을 사용하세요.
- 강조는 **굵게**만 사용하세요.
- 긴 글은 ## 소제목으로 섹션을 나누세요.
"""

# player 컬럼 → 한국어 라벨 (SQL 결과 결정적 포맷용)
_COLUMN_LABELS = {
    "player_name": "이름",
    "e_player_name": "영문명",
    "nickname": "별명",
    "position": "포지션",
    "back_no": "등번호",
    "nation": "국적",
    "birth_date": "생년월일",
    "height": "키",
    "weight": "몸무게",
    "team_id": "팀",
    "join_yyyy": "입단연도",
    "age": "나이",
}

# 사용자에게 보여줄 필요 없는 내부 컬럼 (SELECT * 대비)
_HIDDEN_COLUMNS = {"player_id", "player_embedding", "solar"}


def _format_rows(rows: list[dict]) -> str:
    """DB 조회 결과를 LLM 없이 그대로 문장화한다 (할루시네이션 차단).

    이름이 있으면 "이름 (라벨 값 · 라벨 값 …)", 없으면 값들을 나열한다.
    내부 컬럼(_HIDDEN_COLUMNS)은 제외하고, 여러 건이면 번호를 매긴다.
    """

    def cells(row: dict, *, skip_name: bool) -> list[str]:
        return [
            f"{_COLUMN_LABELS.get(k, k)} {v}"
            for k, v in row.items()
            if k not in _HIDDEN_COLUMNS
            and not (skip_name and k == "player_name")
            and v not in (None, "")
        ]

    def one(row: dict) -> str:
        name = row.get("player_name")
        if name:
            rest = cells(row, skip_name=True)
            return f"{name} ({' · '.join(rest)})" if rest else str(name)
        return " · ".join(cells(row, skip_name=False))

    if len(rows) == 1:
        return one(rows[0])
    lines = "\n".join(f"{i}. {one(r)}" for i, r in enumerate(rows, 1))
    return f"조건에 맞는 선수 {len(rows)}명:\n{lines}"


class SoccerCoachOrchestrator:
    """축구 코치 허브 — 질문을 Qwen으로 분류해 3갈래로 보낸다.

    - embedding : 벡터 검색(bge-m3+pgvector) + Qwen 생성   (RAG · 의미 조회)
    - sql       : Qwen text-to-SQL → 안전 실행 → DB행 결정적 포맷 (필터/집계/최상급)
    - gemini    : 일반 지식·대화 (Keymaker)                 (RAG 아님)

    할루시네이션 방어:
      - sql : 조회된 DB행을 LLM에 넘기지 않고 그대로 문장화(_format_rows) → 창작 불가.
      - embedding : 코사인 거리 게이트로 무관한 선수는 근거에서 제외.
      - 라우팅 오분류 보정: sql 가드레일 차단·SQL 실패, 또는 관련 선수 0건이면
        축구 질문이 아니라고 보고 gemini로 폴백한다.
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

        # 2) 분기 (DB 경로가 부적합하면 None → gemini 폴백)
        if destination == "gemini":
            return await self._answer_gemini(messages, question)
        if destination == "sql":
            result = await self._answer_sql(question)
        else:
            result = await self._answer_embedding(question)

        if result is None:
            # 라우팅이 잘못 sql/embedding으로 보냈지만 DB와 무관한 질문 → 일반 대화로 처리
            logger.info("[coach] DB 경로 부적합 → gemini 폴백")
            return await self._answer_gemini(messages, question)
        return result

    async def _answer_gemini(self, messages: list[dict], question: str) -> str:
        history = [
            {"role": "user" if m["role"] == "user" else "model", "parts": m["content"]}
            for m in messages[:-1]
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]
        reply, model_used = await run_in_threadpool(
            self._keymaker.send_chat, history, question, _GEMINI_GENERAL_INSTRUCTION
        )
        logger.info("[coach][3/3] Gemini 답변(중립) | model=%s", model_used)
        return reply

    async def _answer_sql(self, question: str) -> str | None:
        sql = await self._qwen(_SQL_GEN_PROMPT, question)
        try:
            rows = await self._player_sql.run_select(sql)
        except UnsafeSqlError as e:
            # 안전하지 않은 SQL = 대개 축구 질문이 아님 → gemini로 폴백
            logger.warning("[coach][3/3][sql] 가드레일 차단 → gemini 폴백 | %s", e)
            return None
        except Exception as e:  # noqa: BLE001 — SQL 문법 오류 등 → gemini로 폴백
            logger.warning("[coach][3/3][sql] 실행 실패 → gemini 폴백 | %s", e)
            return None

        if not rows:  # 가드레일: 근거 없으면 지어내지 말고 차단
            logger.info("[coach][3/3][sql] 결과 0건 → 차단")
            return "축구 DB에서 조건에 맞는 선수를 찾지 못했어요."

        # 조회된 행(사실)을 그대로 문장화 — 소형 모델의 할루시네이션을 원천 차단.
        # (LLM에 넘기지 않고 DB 값만 결정적으로 포맷)
        logger.info("[coach][3/3][sql] 답변 생성(결정적) | rows=%d", len(rows))
        return _format_rows(rows)

    async def _answer_embedding(self, question: str) -> str | None:
        # retrieve_context는 관련도(코사인 거리) 임계값을 통과한 선수만 돌려준다.
        contexts = await self._retrieval.retrieve_context(question, top_k=8)
        if not contexts:  # 관련 선수 없음 = 축구 질문이 아닐 가능성 → gemini 폴백
            logger.info("[coach][3/3][embedding] 관련 선수 없음 → gemini 폴백")
            return None

        rag_system = _RAG_GUIDE + "\n".join(f"- {c}" for c in contexts)
        logger.info("[coach][3/3][embedding] 답변 생성 | ctx=%d건", len(contexts))
        return await self._qwen(rag_system, question)
