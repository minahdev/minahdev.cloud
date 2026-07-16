from __future__ import annotations

from abc import ABC, abstractmethod

from star_craft.app.dtos.crawl_dto import ScrapeSummary


class ScraperUseCase(ABC):
    """crawled.jsonl의 URL을 스크래핑 → scraped.jsonl 저장."""

    @abstractmethod
    async def scrape(self) -> ScrapeSummary:
        """크롤러가 수집한 URL들의 제목·본문을 추출하고 저장한다."""
        ...
