from __future__ import annotations

from abc import ABC, abstractmethod


class PlayerSearchPort(ABC):
    """임베딩 벡터로 유사한 선수 컨텍스트를 검색한다."""

    @abstractmethod
    async def search_similar(
        self, embedding: list[float], top_k: int
    ) -> list[tuple[str, float]]:
        """(컨텍스트, 코사인 거리) 목록을 거리 오름차순으로 반환. 거리가 작을수록 유사."""
        ...
