from __future__ import annotations

import logging

from moneyball.app.ports.input.soccer_retrieval_use_case import SoccerRetrievalUseCase
from moneyball.app.ports.output.embedding_port import EmbeddingPort
from moneyball.app.ports.output.player_search_port import PlayerSearchPort

logger = logging.getLogger(__name__)


class SoccerRetrievalInteractor(SoccerRetrievalUseCase):
    """질문 → 임베딩(bge-m3) → pgvector 유사도 검색 → 컨텍스트 반환."""

    def __init__(self, embedder: EmbeddingPort, search: PlayerSearchPort) -> None:
        self._embedder = embedder
        self._search = search

    async def retrieve_context(self, query: str, top_k: int = 5) -> list[str]:
        vector = await self._embedder.embed(query)
        contexts = await self._search.search_similar(vector, top_k)
        logger.info(
            "[moneyball] pgvector 유사도 검색 완료 | top_k=%d | %d건 반환", top_k, len(contexts)
        )
        return contexts
