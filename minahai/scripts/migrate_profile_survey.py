"""user_information 에 설문 확장 컬럼 추가 (여러 번 돌려도 안전).

  python scripts/migrate_profile_survey.py

- favorite_exercises : 복수 선택 운동 코드 CSV
- health_flags       : 민감 건강 특이사항 (field_crypto 로 암호화되어 저장됨)
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from core.matrix.database_manager import get_async_session_factory  # noqa: E402

DDL = [
    "ALTER TABLE user_information ADD COLUMN IF NOT EXISTS favorite_exercises text",
    "ALTER TABLE user_information ADD COLUMN IF NOT EXISTS health_flags text",
]


async def main() -> None:
    factory = get_async_session_factory()
    if factory is None:
        raise SystemExit("DATABASE_URL 이 없습니다.")
    async with factory() as session:
        for stmt in DDL:
            await session.execute(text(stmt))
            print(f"  OK  {stmt}")
        await session.commit()
        rows = await session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='user_information' ORDER BY ordinal_position"
            )
        )
        print("\nuser_information 컬럼:", ", ".join(r[0] for r in rows))


if __name__ == "__main__":
    asyncio.run(main())
