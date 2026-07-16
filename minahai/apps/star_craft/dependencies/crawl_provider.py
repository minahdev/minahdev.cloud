"""
크롤러·스크래퍼 의존성 조립소 (DIP 팩토리).

  - 입력: Redis (crawl:website, crawl:keywords)  → RedisCrawlConfigAdapter
  - 취득: httpx                                    → HttpxHtmlFetcherAdapter
  - 출력: resources/{crawled,scraped}.jsonl        → JsonlResultSinkAdapter

라우터는 구현체를 모르고 포트 타입(UseCase)만 의존한다.
"""

from __future__ import annotations

import os
from pathlib import Path

from redis.asyncio import Redis

from star_craft.adapter.outbound.file.jsonl_result_sink_adapter import JsonlResultSinkAdapter
from star_craft.adapter.outbound.http.httpx_html_fetcher_adapter import HttpxHtmlFetcherAdapter
from star_craft.adapter.outbound.redis.redis_crawl_config_adapter import RedisCrawlConfigAdapter
from star_craft.app.ports.input.crawler_use_case import CrawlerUseCase
from star_craft.app.ports.input.scraper_use_case import ScraperUseCase
from star_craft.app.ports.output.crawl_config_port import CrawlConfigPort
from star_craft.app.ports.output.crawl_result_sink_port import CrawlResultSinkPort
from star_craft.app.ports.output.html_fetcher_port import HtmlFetcherPort
from star_craft.app.use_cases.crawler_interactor import CrawlerInteractor
from star_craft.app.use_cases.scraper_interactor import ScraperInteractor

# 이 파일: apps/star_craft/dependencies/ → parents[3] = minahai 루트
_RESOURCES = Path(__file__).resolve().parents[3] / "resources"
_CRAWLED_PATH = _RESOURCES / "crawled" / "crawled.jsonl"
_SCRAPED_PATH = _RESOURCES / "scraped" / "scraped.jsonl"


def _redis_client() -> Redis:
    url = os.getenv("REDIS_URL", "redis://redis:6379")
    return Redis.from_url(url, decode_responses=True)


def get_crawl_config() -> CrawlConfigPort:
    return RedisCrawlConfigAdapter(client=_redis_client())


def get_html_fetcher() -> HtmlFetcherPort:
    return HttpxHtmlFetcherAdapter()


def get_result_sink() -> CrawlResultSinkPort:
    return JsonlResultSinkAdapter(crawled_path=_CRAWLED_PATH, scraped_path=_SCRAPED_PATH)


def get_crawler_use_case() -> CrawlerUseCase:
    return CrawlerInteractor(
        config=get_crawl_config(),
        fetcher=get_html_fetcher(),
        sink=get_result_sink(),
    )


def get_scraper_use_case() -> ScraperUseCase:
    return ScraperInteractor(
        fetcher=get_html_fetcher(),
        sink=get_result_sink(),
    )
