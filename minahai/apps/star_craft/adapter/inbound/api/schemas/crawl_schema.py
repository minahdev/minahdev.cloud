from __future__ import annotations

from pydantic import BaseModel


class CrawlRequest(BaseModel):
    """프론트 입력: 크롤 대상 URL과 키워드(콤마 구분 문자열).

    값이 오면 백엔드가 Redis(crawl:website·crawl:keywords)에 저장한 뒤 크롤한다.
    비어 있으면 Redis에 이미 저장된 값을 사용한다.
    """

    site: str | None = None
    keywords: str | None = None
