from __future__ import annotations

from abc import ABC, abstractmethod

from star_craft.app.dtos.crawl_dto import CrawlSummary


class CrawlerUseCase(ABC):
    """Redis의 사이트·키워드로 크롤링 → crawled.jsonl 저장."""

    @abstractmethod
    async def crawl(
        self, website: str | None = None, keywords: list[str] | None = None
    ) -> CrawlSummary:
        """seed 사이트를 크롤링해 키워드 매칭 URL을 수집하고 저장한다.

        website가 주어지면 먼저 Redis에 저장한 뒤 사용한다(사용자 입력 반영).
        없으면 Redis에 이미 저장된 값을 사용한다.
        """
        ...
