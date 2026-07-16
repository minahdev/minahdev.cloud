from __future__ import annotations

import logging
from urllib.parse import urldefrag, urljoin, urlparse

from bs4 import BeautifulSoup

from star_craft.app.dtos.crawl_dto import CrawledUrl, CrawlSummary
from star_craft.app.ports.input.crawler_use_case import CrawlerUseCase
from star_craft.app.ports.output.crawl_config_port import CrawlConfigPort
from star_craft.app.ports.output.crawl_result_sink_port import CrawlResultSinkPort
from star_craft.app.ports.output.html_fetcher_port import HtmlFetcherPort

logger = logging.getLogger(__name__)

_MAX_PAGES = 50  # 방문 상한 (무한 크롤 방지)


class CrawlerInteractor(CrawlerUseCase):
    """seed 사이트에서 같은 도메인 링크를 BFS로 따라가며 키워드 매칭 URL을 수집한다.

    Redis(사이트·키워드) → BFS 크롤 → crawled.jsonl
    프레임워크(httpx·Redis·파일)는 어댑터로 격리하고, 여기선 수집 로직만 담당.
    """

    def __init__(
        self,
        config: CrawlConfigPort,
        fetcher: HtmlFetcherPort,
        sink: CrawlResultSinkPort,
    ) -> None:
        self._config = config
        self._fetcher = fetcher
        self._sink = sink

    async def crawl(
        self, website: str | None = None, keywords: list[str] | None = None
    ) -> CrawlSummary:
        # 사용자 입력이 오면 먼저 Redis에 저장(스펙: 입력값을 Redis에 저장) 후 사용
        if website:
            await self._config.save(website, keywords or [])
        cfg = await self._config.load()
        keywords = [k.lower() for k in cfg.keywords if k.strip()]
        logger.info("[crawler] 시작 | site=%s | keywords=%s", cfg.website, keywords)

        seed = cfg.website
        domain = urlparse(seed).netloc
        seen: set[str] = set()
        queue: list[str] = [seed]
        collected: list[CrawledUrl] = []

        while queue and len(seen) < _MAX_PAGES:
            url, _ = urldefrag(queue.pop(0))
            if url in seen:
                continue
            seen.add(url)

            html = await self._fetcher.fetch(url)
            if html is None:
                continue

            soup = BeautifulSoup(html, "html.parser")
            title = soup.title.get_text(strip=True) if soup.title else ""
            text = soup.get_text(" ", strip=True).lower()

            # 키워드 매칭 시 수집 (키워드가 없으면 방문한 모든 페이지 수집)
            matched = next(
                (k for k in keywords if k in text or k in title.lower()), ""
            )
            if not keywords or matched:
                collected.append(CrawledUrl(url=url, title=title, matched=matched))

            # 같은 도메인 링크만 큐에 추가
            for a in soup.find_all("a", href=True):
                nxt, _ = urldefrag(urljoin(url, a["href"]))
                if urlparse(nxt).netloc == domain and nxt not in seen:
                    queue.append(nxt)

        path = await self._sink.save_crawled(collected)
        logger.info("[crawler] 완료 | 방문 %d · 수집 %d건 → %s", len(seen), len(collected), path)
        return CrawlSummary(
            website=cfg.website,
            keywords=cfg.keywords,
            crawled_count=len(collected),
            output_path=path,
        )
