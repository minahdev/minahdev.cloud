from __future__ import annotations

import logging
import re

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from moneyball.app.ports.input.player_sql_use_case import PlayerSqlUseCase, UnsafeSqlError

logger = logging.getLogger(__name__)

# 조회 허용 테이블 (그 외 pg_catalog·information_schema 등 차단)
_ALLOWED_TABLES = {"player", "team", "stadium", "schedule"}
_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|"
    r"merge|copy|call|do|comment|vacuum|analyze)\b",
    re.IGNORECASE,
)
_TABLE_REF = re.compile(r"\b(?:from|join)\s+([a-zA-Z_][\w.]*)\b(?!\s*\()", re.IGNORECASE)
_FENCE = re.compile(r"```(?:sql)?|```", re.IGNORECASE)
_MAX_ROWS = 50


class PlayerSqlRepository(PlayerSqlUseCase):
    """Qwen이 생성한 SELECT를 가드레일 통과 후에만 실행한다."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def _sanitize(sql: str) -> str:
        s = _FENCE.sub("", sql).strip().rstrip(";").strip()
        if ";" in s:
            raise UnsafeSqlError("다중 SQL 문은 허용되지 않습니다.")
        if not re.match(r"^\s*select\b", s, re.IGNORECASE):
            raise UnsafeSqlError("SELECT 문만 허용됩니다.")
        if _FORBIDDEN.search(s):
            raise UnsafeSqlError("허용되지 않는 키워드가 포함됐습니다.")
        for ref in _TABLE_REF.findall(s):
            if ref.split(".")[-1].lower() not in _ALLOWED_TABLES:
                raise UnsafeSqlError(f"허용되지 않은 테이블: {ref}")
        if not re.search(r"\blimit\b", s, re.IGNORECASE):
            s = f"{s} LIMIT {_MAX_ROWS}"
        return s

    async def run_select(self, sql: str) -> list[dict[str, object]]:
        safe = self._sanitize(sql)
        logger.info("[player_sql] 실행 | %s", safe)
        result = await self._session.execute(text(safe))
        rows = result.mappings().all()
        return [dict(row) for row in rows[:_MAX_ROWS]]
