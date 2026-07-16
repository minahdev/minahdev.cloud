from __future__ import annotations

import logging

from moneyball.app.ports.input.soccer_retrieval_use_case import SoccerRetrievalUseCase
from moneyball.app.ports.output.embedding_port import EmbeddingPort
from moneyball.app.ports.output.player_search_port import PlayerSearchPort

logger = logging.getLogger(__name__)

# 코사인 거리가 이보다 크면 질문과 무관한 선수로 간주 (bge-m3 기준, 0=동일·2=반대).
# 관련 선수가 하나도 없으면 상위(orchestrator)가 gemini로 폴백한다.
_RELEVANCE_MAX_DISTANCE = 0.6


class SoccerRetrievalInteractor(SoccerRetrievalUseCase):
    """질문 → 임베딩(bge-m3) → pgvector 유사도 검색 → 관련 컨텍스트만 반환."""

    def __init__(self, embedder: EmbeddingPort, search: PlayerSearchPort) -> None:
        self._embedder = embedder
        self._search = search

    async def retrieve_context(self, query: str, top_k: int = 5) -> list[str]:
        vector = await self._embedder.embed(query)
        scored = await self._search.search_similar(vector, top_k)
        # 관련도 게이트: 임계값 이내 거리의 선수만 근거로 채택
        relevant = [ctx for ctx, dist in scored if dist <= _RELEVANCE_MAX_DISTANCE]
        best = scored[0][1] if scored else None
        logger.info(
            "[moneyball] pgvector 검색 | top_k=%d | 최근접거리=%s | 관련 %d/%d건",
            top_k,
            f"{best:.3f}" if best is not None else "N/A",
            len(relevant),
            len(scored),
        )
        return relevant
