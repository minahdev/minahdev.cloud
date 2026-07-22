"""검증된 현재 사용자 — `X-Pace-Identity` 헤더에서만 신원을 도출한다.

클라이언트가 보낸 body/query의 userId·role은 절대 신뢰하지 않는다.
role은 이 의존성에서 이메일→allowlist / DB로 매 요청 재계산한다.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.matrix.database_manager import get_db
from users.adapter.outbound.pg.signup_pg_repository import SignupPgRepository
from users.auth.admin_allowlist import resolve_role
from users.auth.tokens import verify_identity

IDENTITY_HEADER = "X-Pace-Identity"


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    email: str
    role: str

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_coach(self) -> bool:
        return self.role == "coach"


def _claims(request: Request) -> dict | None:
    token = request.headers.get(IDENTITY_HEADER, "")
    return verify_identity(token) if token else None


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> CurrentUser:
    claims = _claims(request)
    if not claims or not claims.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다.")

    user_id = str(claims["sub"])
    row = await SignupPgRepository(session=db).find_by_user_id(user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다.")

    email = claims.get("email") or row.email
    role = resolve_role(email, row.role, email_verified=bool(claims.get("ev", False)))
    return CurrentUser(user_id=user_id, email=email or "", role=role)


async def get_current_user_optional(
    request: Request, db: AsyncSession = Depends(get_db)
) -> CurrentUser | None:
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 전용입니다.")
    return user


def require_coach_or_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role not in ("coach", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="코치 또는 관리자 전용입니다.")
    return user


def require_member(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """로그인만 요구(회원·코치·관리자 모두 허용)."""
    return user
