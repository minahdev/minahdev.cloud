from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import asdict
from pathlib import Path

from star_craft.app.dtos.crawl_dto import CrawledUrl, ScrapedPage
from star_craft.app.ports.output.crawl_result_sink_port import CrawlResultSinkPort


class JsonlResultSinkAdapter(CrawlResultSinkPort):
    """크롤/스크랩 결과를 JSONL(한 줄당 JSON 1건)로 저장·로드한다."""

    def __init__(self, crawled_path: Path, scraped_path: Path) -> None:
        self._crawled_path = crawled_path
        self._scraped_path = scraped_path

    @staticmethod
    def _write_jsonl(path: Path, records: Iterable[dict]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            for rec in records:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    async def save_crawled(self, records: Iterable[CrawledUrl]) -> str:
        self._write_jsonl(self._crawled_path, (asdict(r) for r in records))
        return str(self._crawled_path)

    async def load_crawled(self) -> list[CrawledUrl]:
        if not self._crawled_path.is_file():
            return []
        items: list[CrawledUrl] = []
        with self._crawled_path.open("r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    items.append(CrawledUrl(**json.loads(line)))
        return items

    async def save_scraped(self, records: Iterable[ScrapedPage]) -> str:
        self._write_jsonl(self._scraped_path, (asdict(r) for r in records))
        return str(self._scraped_path)
