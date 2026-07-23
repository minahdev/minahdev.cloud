"""민감 건강정보 암호화 키 도입·교체·해제.

컴퓨터를 옮기거나 키를 바꿀 때 쓴다. 모든 행을 **옛 키로 읽어 새 키로 다시 저장**한다.

  # 새 키 하나 뽑기 (아직 아무것도 바꾸지 않음)
  python scripts/rotate_profile_key.py --new-key

  # 평문 → 암호화 (처음 키 도입). PROFILE_ENC_KEY 를 .env 에 넣은 뒤 실행
  python scripts/rotate_profile_key.py --to "$PROFILE_ENC_KEY"

  # 키 교체: 지금 .env 의 키로 읽어서 새 키로 다시 저장
  python scripts/rotate_profile_key.py --to <새키_base64>

  # 암호화 해제 (평문으로 되돌리기)
  python scripts/rotate_profile_key.py --to ""

`--from` 을 주면 .env 대신 그 키로 복호화한다(키를 막 바꾼 뒤 되돌릴 때).
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from core.matrix import field_crypto  # noqa: E402
from core.matrix.database_manager import get_async_session_factory  # noqa: E402

FIELDS = ("health_flags", "health_note")


def _with_key(key: str, fn, *args):
    """PROFILE_ENC_KEY 를 잠시 바꿔 호출 — 읽기/쓰기 키가 다르므로 필요."""
    prev = os.environ.get("PROFILE_ENC_KEY", "")
    os.environ["PROFILE_ENC_KEY"] = key
    try:
        return fn(*args)
    finally:
        os.environ["PROFILE_ENC_KEY"] = prev


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--new-key", action="store_true", help="새 키만 출력하고 종료")
    ap.add_argument("--to", help="이 키로 다시 암호화. 빈 문자열이면 평문으로 해제")
    ap.add_argument("--from", dest="from_key", help="복호화에 쓸 키 (기본: 현재 .env 값)")
    args = ap.parse_args()

    if args.new_key:
        print(field_crypto.generate_key())
        print("\n이 값을 minahai/.env 의 PROFILE_ENC_KEY 에 넣고,")
        print("  python scripts/rotate_profile_key.py --to <위 값>")
        print("을 실행하면 기존 데이터가 암호화됩니다. ⚠️ 키를 잃으면 복구 불가.")
        return

    if args.to is None:
        raise SystemExit("--to 또는 --new-key 가 필요합니다. (--help 참고)")
    factory = get_async_session_factory()
    if factory is None:
        raise SystemExit("DATABASE_URL 이 없습니다.")

    old_key = args.from_key if args.from_key is not None else os.getenv("PROFILE_ENC_KEY", "")
    new_key = args.to
    print(f"복호화 키: {'설정됨' if old_key else '없음(평문으로 간주)'}")
    print(f"재암호화 키: {'설정됨' if new_key else '없음(평문으로 저장)'}\n")

    changed = 0
    async with factory() as conn:
        rows = (
            await conn.execute(text(f"SELECT id, {', '.join(FIELDS)} FROM user_information"))
        ).fetchall()
        for row in rows:
            row_id = row[0]
            updates: dict[str, str | None] = {}
            for i, field in enumerate(FIELDS, start=1):
                stored = row[i]
                if stored is None:
                    continue
                plain = _with_key(old_key, field_crypto.decrypt_field, stored)
                if field_crypto.is_encrypted(stored) and not plain:
                    print(f"  ⚠️ id={row_id} {field}: 복호화 실패 — 건너뜀 (키 확인 필요)")
                    continue
                updates[field] = _with_key(new_key, field_crypto.encrypt_field, plain)
            if updates:
                sets = ", ".join(f"{k} = :{k}" for k in updates)
                await conn.execute(
                    text(f"UPDATE user_information SET {sets} WHERE id = :id"),
                    {**updates, "id": row_id},
                )
                changed += 1
        await conn.commit()

    print(f"\n{len(rows)}행 중 {changed}행 갱신 완료.")
    if new_key:
        print("⚠️ PROFILE_ENC_KEY 를 잃으면 이 데이터는 영구히 읽을 수 없습니다. 백업하세요.")


if __name__ == "__main__":
    asyncio.run(main())
