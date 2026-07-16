from __future__ import annotations

import logging

from bs4 import BeautifulSoup

from star_craft.app.dtos.crawl_dto import ScrapedPage, ScrapeSummary
from star_craft.app.ports.input.scraper_use_case import ScraperUseCase
from star_craft.app.ports.output.crawl_result_sink_port import CrawlResultSinkPort
from star_craft.app.ports.output.html_fetcher_port import HtmlFetcherPort

logger = logging.getLogger(__name__)


class ScraperInteractor(ScraperUseCase):
    """크롤러가 수집한 URL(crawled.jsonl)을 방문해 제목·본문을 추출 → scraped.jsonl."""

    def __init__(
        self,
        fetcher: HtmlFetcherPort,
        sink: CrawlResultSinkPort,
    ) -> None:
        self._fetcher = fetcher
        self._sink = sink

    async def scrape(self) -> ScrapeSummary:
        targets = await self._sink.load_crawled()
        logger.info("[scraper] 시작 | 대상 %d건", len(targets))

        pages: list[ScrapedPage] = []
        for item in targets:
            html = await self._fetcher.fetch(item.url)
            if html is None:
                continue

            soup = BeautifulSoup(html, "html.parser")
            # 본문 텍스트에서 스크립트·스타일 제거
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()

            title = soup.title.get_text(strip=True) if soup.title else item.title
            content = soup.get_text(" ", strip=True)
            pages.append(ScrapedPage(url=item.url, title=title, content=content))

        path = await self._sink.save_scraped(pages)
        logger.info("[scraper] 완료 | 추출 %d건 → %s", len(pages), path)
        return ScrapeSummary(scraped_count=len(pages), output_path=path)
