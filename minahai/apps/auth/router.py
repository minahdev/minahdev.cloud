"""auth 게이트 라우터 — POST /login·/logout·/refresh, GET /callback/{provider}, GET /.well-known/jwks.json.

OAuth 개시(GET /login/{provider})는 위 /callback과 짝을 이루는 진입점으로 함께 둔다.
발급된 토큰은 서브도메인 공유 쿠키(.minahdev.cloud)로 심어 backend(api.)가 access를 검증한다.
"""

from __future__ import annotations

import logging
import os
import secrets
from urllib.parse import urlencode

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.matrix.database_manager import get_db
from core.matrix.dependencies import get_current_user
from core.matrix.security import (
    ACCESS_COOKIE,
    ACCESS_TTL_MIN,
    COOKIE_KWARGS,
    REFRESH_COOKIE,
    REFRESH_TTL_DAYS,
    TokenPayload,
    public_jwk,
)
from auth import services
from auth.schemas import LoginRequest, LogoutResponse, RefreshRequest, TokenResponse
from users.oauth.oauth_service import exchange_code_for_token, fetch_profile
from users.oauth.providers import client_id, get_provider

logger = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])

_STATE_COOKIE = "_oauth_state"


def _frontend_base() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _callback_url(request: Request, provider: str) -> str:
    # 이 게이트의 콜백 URL. provider 콘솔에 등록된 redirect_uri와 일치해야 함.
    base = os.getenv("AUTH_CALLBACK_BASE", "").rstrip("/") or str(request.base_url).rstrip("/")
    return f"{base}/auth/callback/{provider}"


def _set_token_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(ACCESS_COOKIE, access, max_age=ACCESS_TTL_MIN * 60, **COOKIE_KWARGS)
    response.set_cookie(
        REFRESH_COOKIE, refresh, max_age=REFRESH_TTL_DAYS * 24 * 3600, path="/auth", **COOKIE_KWARGS
    )


# ── 비밀번호 로그인 ───────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        access, refresh, expires = await services.login_with_password(db, req.userId.strip(), req.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)) from e
    _set_token_cookies(response, access, refresh)
    return TokenResponse(accessToken=access, refreshToken=refresh, expiresIn=expires)


# ── 로그아웃 ─────────────────────────────────────────────────────

@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request, response: Response, user: TokenPayload = Depends(get_current_user)
) -> LogoutResponse:
    await services.logout(request.cookies.get(REFRESH_COOKIE), user.jti, user.exp)
    response.delete_cookie(ACCESS_COOKIE, domain=".minahdev.cloud")
    response.delete_cookie(REFRESH_COOKIE, domain=".minahdev.cloud", path="/auth")
    return LogoutResponse()


# ── 리프레시(로테이션) ────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    req: RefreshRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    token = req.refreshToken or request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="리프레시 토큰이 없습니다.")
    try:
        access, refresh_t, expires = await services.rotate_refresh(db, token)
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)) from e
    _set_token_cookies(response, access, refresh_t)
    return TokenResponse(accessToken=access, refreshToken=refresh_t, expiresIn=expires)


# ── OAuth 개시 + 콜백 ─────────────────────────────────────────────

@router.get("/login/{provider}", include_in_schema=False)
async def oauth_login(provider: str, request: Request) -> RedirectResponse:
    cfg = get_provider(provider)
    if cfg is None or not client_id(provider):
        return RedirectResponse(f"{_frontend_base()}/login?error=provider_not_configured", status_code=302)
    state = secrets.token_urlsafe(24)
    params = {
        "response_type": "code",
        "client_id": client_id(provider),
        "redirect_uri": _callback_url(request, provider),
        "state": state,
    }
    if cfg.scope:
        params["scope"] = cfg.scope
    resp = RedirectResponse(f"{cfg.authorize_url}?{urlencode(params)}", status_code=302)
    resp.set_cookie(_STATE_COOKIE, state, max_age=600, httponly=True, samesite="lax")
    return resp


@router.get("/callback/{provider}", include_in_schema=False)
async def oauth_callback(
    provider: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    def _fail(reason: str) -> RedirectResponse:
        return RedirectResponse(f"{_frontend_base()}/login?error={reason}", status_code=302)

    if error:
        return _fail("provider_denied")
    cfg = get_provider(provider)
    if cfg is None:
        return _fail("unknown_provider")
    cookie_state = request.cookies.get(_STATE_COOKIE, "")
    if not code or not state or not cookie_state or not secrets.compare_digest(state, cookie_state):
        return _fail("invalid_state")

    try:
        token = await exchange_code_for_token(cfg, code, _callback_url(request, provider))
        profile = await fetch_profile(cfg, token)
        access, refresh_t, _ = await services.login_with_oauth(db, profile)
    except Exception as exc:  # noqa: BLE001 - 외부 호출 실패는 로그인 실패로 통일
        logger.warning("[auth-gate] %s 콜백 실패: %s", provider, exc)
        return _fail("oauth_failed")

    resp = RedirectResponse(f"{_frontend_base()}/mypage", status_code=302)
    _set_token_cookies(resp, access, refresh_t)
    resp.delete_cookie(_STATE_COOKIE)
    resp.headers["Referrer-Policy"] = "no-referrer"
    return resp


# ── JWKS (외부 검증자용 공개키) ───────────────────────────────────

@router.get("/.well-known/jwks.json")
async def jwks() -> dict:
    return {"keys": [public_jwk()]}
