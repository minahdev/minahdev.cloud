from __future__ import annotations

import logging

import httpx

from star_craft.app.ports.output.html_fetcher_port import HtmlFetcherPort

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_HEADERS = {"User-Agent": "minahai-crawler/1.0"}


class HttpxHtmlFetcherAdapter(HtmlFetcherPort):
    """httpx로 URL의 HTML을 가져온다. 비 HTML·타임아웃·HTTP 에러면 None."""

    async def fetch(self, url: str) -> str | None:
        try:
            async with httpx.AsyncClient(
                timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                if "html" not in resp.headers.get("content-type", "").lower():
                    return None
                return resp.text
        except httpx.HTTPError as e:
            logger.warning("[fetcher] 실패 | %s | %s", url, e)
            return None
