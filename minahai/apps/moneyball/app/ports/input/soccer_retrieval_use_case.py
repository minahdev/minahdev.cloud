from __future__ import annotations

from abc import ABC, abstractmethod


class SoccerRetrievalUseCase(ABC):
    """질문에 관련된 축구 DB 컨텍스트(선수 등)를 임베딩 유사도로 조회한다 (RAG retrieval)."""

    @abstractmethod
    async def retrieve_context(self, query: str, top_k: int = 5) -> list[str]:
        ...
