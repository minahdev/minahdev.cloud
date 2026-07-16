from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from star_craft.app.dtos.crawl_dto import CrawlSummary, ScrapeSummary
from star_craft.app.ports.input.crawler_use_case import CrawlerUseCase
from star_craft.app.ports.input.scraper_use_case import ScraperUseCase
from star_craft.dependencies.crawl_provider import (
    get_crawler_use_case,
    get_scraper_use_case,
)

logger = logging.getLogger(__name__)

crawl_router = APIRouter(prefix="/star_craft", tags=["star_craft"])


@crawl_router.post("/crawl", response_model=CrawlSummary)
async def crawl(
    crawler: CrawlerUseCase = Depends(get_crawler_use_case),
) -> CrawlSummary:
    """Redis(crawl:website·crawl:keywords) 기준으로 크롤링 → crawled.jsonl."""
    try:
        return await crawler.crawl()
    except ValueError as e:  # 크롤 대상 미설정
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        logger.exception("[crawl] 실패")
        raise HTTPException(status_code=502, detail="크롤링 중 오류가 발생했습니다.") from e


@crawl_router.post("/scrape", response_model=ScrapeSummary)
async def scrape(
    scraper: ScraperUseCase = Depends(get_scraper_use_case),
) -> ScrapeSummary:
    """crawled.jsonl의 URL을 스크래핑 → scraped.jsonl."""
    try:
        return await scraper.scrape()
    except Exception as e:  # noqa: BLE001
        logger.exception("[scrape] 실패")
        raise HTTPException(status_code=502, detail="스크래핑 중 오류가 발생했습니다.") from e
