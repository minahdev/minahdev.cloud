from __future__ import annotations

from abc import ABC, abstractmethod

from star_craft.app.dtos.crawl_dto import CrawlConfig


class CrawlConfigPort(ABC):
    """크롤 대상(사이트·키워드) 저장·조회 포트 (구현: Redis)."""

    @abstractmethod
    async def save(self, website: str, keywords: list[str]) -> None:
        """사용자가 입력한 크롤 대상 URL과 키워드를 저장한다."""
        ...

    @abstractmethod
    async def load(self) -> CrawlConfig:
        """크롤 대상 URL과 키워드를 읽어온다. 대상이 없으면 ValueError."""
        ...
