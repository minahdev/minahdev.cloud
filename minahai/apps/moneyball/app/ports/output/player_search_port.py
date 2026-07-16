from __future__ import annotations

from abc import ABC, abstractmethod


class PlayerSearchPort(ABC):
    """임베딩 벡터로 유사한 선수 컨텍스트를 검색한다."""

    @abstractmethod
    async def search_similar(self, embedding: list[float], top_k: int) -> list[str]:
        ...
