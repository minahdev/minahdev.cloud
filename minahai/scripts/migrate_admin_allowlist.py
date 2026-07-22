"""기존 데이터 정리 — admin allowlist 일치화 (요구사항 4).

- allowlist(ADMIN_EMAILS)에 없는데 role='admin'으로 저장된 계정 → 'user'로 강등
- allowlist에 있는 이메일 계정 → 'admin'으로 보장

role은 인증 시 resolve_role로 매 요청 재계산되므로 이 스크립트는 DB 위생용(belt-and-suspenders).

실행:
    cd minahai
    ADMIN_EMAILS=minmom7898@gmail.com DATABASE_URL=... python scripts/migrate_admin_allowlist.py
또는 컨테이너 안에서:
    docker exec -e ADMIN_EMAILS=minmom7898@gmail.com minah_backend \
        python scripts/migrate_admin_allowlist.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_APPS_DIR = _BACKEND_DIR / "apps"
for _p in (_BACKEND_DIR, _APPS_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from sqlalchemy import func, select, update  # noqa: E402

from core.matrix.database_manager import get_async_session_factory  # noqa: E402
from users.app.dtos.user_dto import User  # noqa: E402
from users.auth.admin_allowlist import admin_emails  # noqa: E402


async def run() -> None:
    allow = admin_emails()
    if not allow:
        print("⚠️  ADMIN_EMAILS가 비어 있음 — 강등만 수행하고 승격은 건너뜀.")

    factory = get_async_session_factory()
    if factory is None:
        print("❌ DATABASE_URL 미설정 — 세션을 만들 수 없음.")
        raise SystemExit(1)

    async with factory() as session:
        # 1) allowlist에 없는 admin → user 강등 (이메일 소문자 비교)
        downgraded = 0
        rows = (await session.execute(select(User).where(User.role == "admin"))).scalars().all()
        for row in rows:
            if (row.email or "").strip().lower() not in allow:
                row.role = "user"
                downgraded += 1
                print(f"  ↓ 강등: {row.user_id} <{row.email}> admin → user")

        # 2) allowlist 이메일 → admin 보장
        promoted = 0
        for email in allow:
            result = await session.execute(
                update(User)
                .where(func.lower(User.email) == email, User.role != "admin")
                .values(role="admin")
            )
            if result.rowcount:
                promoted += result.rowcount
                print(f"  ↑ 승격: <{email}> → admin ({result.rowcount}건)")

        await session.commit()

    print(f"\n✅ 완료 — 강등 {downgraded}건, 승격 {promoted}건. allowlist={sorted(allow)}")


if __name__ == "__main__":
    asyncio.run(run())
