from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class CrawlConfig:
    """Redis에서 읽어온 크롤 대상 설정."""

    website: str  # seed URL
    keywords: list[str] = field(default_factory=list)  # 매칭 키워드


@dataclass(frozen=True)
class CrawledUrl:
    """크롤러가 수집한 URL 1건 (키워드 매칭)."""

    url: str
    title: str = ""
    matched: str = ""  # 매칭된 키워드 (없으면 빈 문자열)


@dataclass(frozen=True)
class ScrapedPage:
    """스크래퍼가 추출한 페이지 1건."""

    url: str
    title: str = ""
    content: str = ""


@dataclass(frozen=True)
class CrawlSummary:
    """크롤링 실행 결과 요약 (API 응답)."""

    website: str
    keywords: list[str]
    crawled_count: int
    output_path: str


@dataclass(frozen=True)
class ScrapeSummary:
    """스크래핑 실행 결과 요약 (API 응답)."""

    scraped_count: int
    output_path: str
