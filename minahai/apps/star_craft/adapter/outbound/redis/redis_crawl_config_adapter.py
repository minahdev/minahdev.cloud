from __future__ import annotations

from redis.asyncio import Redis

from star_craft.app.dtos.crawl_dto import CrawlConfig
from star_craft.app.ports.output.crawl_config_port import CrawlConfigPort

# Redis String 키
_KEY_WEBSITE = "crawl:website"
_KEY_KEYWORDS = "crawl:keywords"


class RedisCrawlConfigAdapter(CrawlConfigPort):
    """Redis String 키에서 크롤 대상·키워드를 읽는다.

        crawl:website  = seed URL          (예: "https://example.com")
        crawl:keywords = 콤마 구분 키워드   (예: "테란,저그,프로토스")

    client는 decode_responses=True 로 생성되어 str을 반환한다고 가정한다.
    """

    def __init__(self, client: Redis) -> None:
        self._client = client

    async def load(self) -> CrawlConfig:
        website = await self._client.get(_KEY_WEBSITE)
        if not website:
            raise ValueError(
                f"Redis에 '{_KEY_WEBSITE}' 가 없습니다. 크롤 대상 URL을 먼저 설정하세요."
            )

        raw_keywords = await self._client.get(_KEY_KEYWORDS) or ""
        keywords = [k.strip() for k in raw_keywords.split(",") if k.strip()]
        return CrawlConfig(website=website.strip(), keywords=keywords)
