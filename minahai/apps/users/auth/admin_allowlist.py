"""admin 판정 — 오직 `ADMIN_EMAILS` allowlist로만. 자가승격 불가.

role은 서버에서 매 요청 재계산한다: 검증된 소셜 이메일이 allowlist면 admin,
아니면 DB role을 user/coach로 정규화(저장된 admin이라도 강등).
"""

from __future__ import annotations

import os


def admin_emails() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def is_admin_email(email: str | None) -> bool:
    if not email:
        return False
    return email.strip().lower() in admin_emails()


def resolve_role(email: str | None, db_role: str | None, *, email_verified: bool = False) -> str:
    """서버 권위 role. 검증된 allowlist 이메일만 admin. 그 외 admin 저장값은 user로 강등."""
    if email_verified and is_admin_email(email):
        return "admin"
    role = (db_role or "user").strip().lower()
    return "coach" if role == "coach" else "user"
