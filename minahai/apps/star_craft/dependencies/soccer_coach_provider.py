"""SoccerCoach 오케스트레이터 의존성 조립소 (Hub).

- Hub는 moneyball의 '포트'(SoccerRetrievalUseCase·PlayerSqlUseCase)만 타입으로 의존한다.
- 라우팅·임베딩/SQL RAG 생성은 Qwen2.5-1.5B(Ollama), 일반 답변은 Gemini(Keymaker)로 위임한다.
"""

from __future__ import annotations

from fastapi import Depends

from core.matrix.secret_manager import Keymaker, get_keymaker

from moneyball.app.ports.input.player_sql_use_case import PlayerSqlUseCase
from moneyball.app.ports.input.soccer_retrieval_use_case import SoccerRetrievalUseCase
from moneyball.dependencies.player_sql_provider import get_player_sql_use_case
from moneyball.dependencies.soccer_retrieval_provider import get_soccer_retrieval_use_case

from star_craft.app.use_cases.soccer_coach_orchestrator import SoccerCoachOrchestrator


def get_soccer_coach_orchestrator(
    retrieval: SoccerRetrievalUseCase = Depends(get_soccer_retrieval_use_case),
    player_sql: PlayerSqlUseCase = Depends(get_player_sql_use_case),
    keymaker: Keymaker = Depends(get_keymaker),
) -> SoccerCoachOrchestrator:
    return SoccerCoachOrchestrator(
        retrieval=retrieval,
        player_sql=player_sql,
        keymaker=keymaker,
    )
