from __future__ import annotations

from abc import ABC, abstractmethod


class EmbeddingPort(ABC):
    """텍스트를 임베딩 벡터로 변환한다."""

    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        ...
