from __future__ import annotations

from abc import ABC, abstractmethod


class HtmlFetcherPort(ABC):
    """URL → HTML 취득 포트 (구현: httpx)."""

    @abstractmethod
    async def fetch(self, url: str) -> str | None:
        """URL의 HTML을 반환한다. 실패(비 HTML·타임아웃·에러) 시 None."""
        ...
