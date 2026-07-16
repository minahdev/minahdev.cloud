from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException

from star_craft.app.use_cases.soccer_coach_orchestrator import SoccerCoachOrchestrator
from star_craft.dependencies.soccer_coach_provider import get_soccer_coach_orchestrator

from moneyball.adapter.inbound.api.schemas.coach_chat_schema import (
    CoachChatResponse,
    CoachChatSchema,
)

logger = logging.getLogger(__name__)

moneyball_router = APIRouter(prefix="/moneyball", tags=["moneyball"])


@moneyball_router.post("/coach/chat", response_model=CoachChatResponse)
async def coach_chat(
    schema: CoachChatSchema,
    orchestrator: SoccerCoachOrchestrator = Depends(get_soccer_coach_orchestrator),
) -> CoachChatResponse:
    """축구 코치 챗 — 프론트 입구(얇은 어댑터). 조율은 star_craft 허브로 위임한다."""
    logger.info("[0/4][moneyball 입구] 프론트 요청 수신 -> star_craft 허브로 전달")
    try:
        text = await orchestrator.answer([m.model_dump() for m in schema.messages])
        return CoachChatResponse(text=text)
    except httpx.HTTPError as e:
        logger.exception("[moneyball] EXAONE/임베딩 서버 오류")
        raise HTTPException(status_code=502, detail="EXAONE/임베딩 서버 오류") from e
