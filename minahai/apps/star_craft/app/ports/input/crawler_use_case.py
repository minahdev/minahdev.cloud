from __future__ import annotations

from abc import ABC, abstractmethod

from star_craft.app.dtos.crawl_dto import CrawlSummary


class CrawlerUseCase(ABC):
    """Redis의 사이트·키워드로 크롤링 → crawled.jsonl 저장."""

    @abstractmethod
    async def crawl(self) -> CrawlSummary:
        """seed 사이트를 크롤링해 키워드 매칭 URL을 수집하고 저장한다."""
        ...
