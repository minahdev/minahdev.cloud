"""auth 라우터 요청/응답 Pydantic 스키마. (검증된 클레임 TokenPayload는 core.matrix.security)"""

from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    userId: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    # 쿠키(pace_refresh) 우선, 없으면 바디로도 허용.
    refreshToken: str | None = None


class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "Bearer"
    expiresIn: int  # access TTL(초)


class LogoutResponse(BaseModel):
    ok: bool = True
