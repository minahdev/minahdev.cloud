"""공용 인증 의존성 — 모든 컨테이너에서 사용 (core 레이어, 앱 import 금지).

- `get_current_user`: 쿠키(pace_access) 또는 Authorization Bearer에서 토큰 추출 →
  `verify_token(aud=SERVICE_AUD)` → Redis 블랙리스트(jti) 확인.
- `RoleChecker`: roles 클레임 검사, 미충족 시 403.

RoleChecker는 `Role`(apps.auth.rbac)을 **import하지 않는다**(core→apps 금지). Role은
str Enum이라 값으로 그대로 전달 가능 — 호출부(main.py 등)에서 `RoleChecker(Role.USER)`.
"""

from __future__ import annotations

import os

import jwt
from fastapi import Depends, HTTPException, Request, status

from core.matrix.security import ACCESS_COOKIE, TokenPayload, verify_token
from core.matrix.token_store import is_access_blacklisted

_SERVICE_AUD = os.getenv("SERVICE_AUD", "minahdev-api")


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip() or None
    return request.cookies.get(ACCESS_COOKIE) or None


async def get_current_user(request: Request) -> TokenPayload:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증이 필요합니다.")
    try:
        payload = verify_token(token, aud=_SERVICE_AUD)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다.")
    if await is_access_blacklisted(payload.jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="폐기된 세션입니다.")
    return payload


class RoleChecker:
    """`dependencies=[Depends(RoleChecker(Role.COACH, Role.ADMIN))]` 형태로 사용."""

    def __init__(self, *allowed: str) -> None:
        # Role(str, Enum) 멤버는 .value가 실제 문자열("user" 등). 순수 str도 그대로 허용.
        self._allowed = {getattr(r, "value", r) for r in allowed}

    def __call__(self, user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        if self._allowed and not (self._allowed & set(user.roles)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다.")
        return user
