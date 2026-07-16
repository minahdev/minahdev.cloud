from __future__ import annotations

from abc import ABC, abstractmethod


class UnsafeSqlError(ValueError):
    """가드레일에 걸린 SQL (SELECT 아님·다중문·금지 키워드·비허용 테이블)."""


class PlayerSqlUseCase(ABC):
    """LLM이 생성한 SELECT를 검증·실행하고 결과 행을 돌려준다 (읽기 전용).

    가드레일(SELECT 전용·단일문·허용 테이블·LIMIT)은 구현체가 강제한다.
    위반 시 UnsafeSqlError 를 던진다.
    """

    @abstractmethod
    async def run_select(self, sql: str) -> list[dict[str, object]]:
        ...
