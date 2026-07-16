from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable

from star_craft.app.dtos.crawl_dto import CrawledUrl, ScrapedPage


class CrawlResultSinkPort(ABC):
    """크롤/스크랩 결과 저장·로드 포트 (구현: JSONL 파일)."""

    @abstractmethod
    async def save_crawled(self, records: Iterable[CrawledUrl]) -> str:
        """수집 URL을 crawled.jsonl에 저장하고 경로를 반환한다."""
        ...

    @abstractmethod
    async def load_crawled(self) -> list[CrawledUrl]:
        """스크래퍼 입력용: crawled.jsonl을 로드한다 (없으면 빈 리스트)."""
        ...

    @abstractmethod
    async def save_scraped(self, records: Iterable[ScrapedPage]) -> str:
        """추출 페이지를 scraped.jsonl에 저장하고 경로를 반환한다."""
        ...
