"""소셜 로그인 라우터 — /auth/{provider}/login·callback.

흐름: 버튼 → /auth/{provider}/login(302 provider) → provider → /auth/{provider}/callback
     → 토큰 교환 → 프로필 → secom_users upsert → 프론트 /login/callback?userId&role 로 302.

state는 CSRF 방지용 랜덤값을 쿠키에 저장하고 콜백에서 대조한다.
"""

from __future__ import annotations

import logging
import os
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.matrix.database_manager import get_db
from users.adapter.outbound.pg.signup_pg_repository import SignupPgRepository
from users.app.dtos.signup_dto import SignupCommand
from users.oauth.oauth_service import exchange_code_for_token, fetch_profile
from users.oauth.providers import client_id, get_provider

logger = logging.getLogger(__name__)

oauth_router = APIRouter(prefix="/auth", tags=["oauth"])

_STATE_COOKIE = "_oauth_state"
# bcrypt 해시가 아니라 비밀번호 로그인으로는 절대 통과 못 함.
_OAUTH_PLACEHOLDER_HASH = "!oauth-no-password"


def _frontend_base() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _callback_url(request: Request, provider: str) -> str:
    base = os.getenv("OAUTH_CALLBACK_BASE", "").rstrip("/") or str(request.base_url).rstrip("/")
    return f"{base}/auth/{provider}/callback"


def _error_redirect(reason: str) -> RedirectResponse:
    return RedirectResponse(f"{_frontend_base()}/login?error={reason}", status_code=302)


@oauth_router.get("/{provider}/login", include_in_schema=False)
async def oauth_login(provider: str, request: Request) -> RedirectResponse:
    cfg = get_provider(provider)
    if cfg is None:
        return _error_redirect("unknown_provider")
    if not client_id(provider):
        return _error_redirect("provider_not_configured")

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


@oauth_router.get("/{provider}/callback", include_in_schema=False)
async def oauth_callback(
    provider: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    if error:
        return _error_redirect("provider_denied")
    cfg = get_provider(provider)
    if cfg is None:
        return _error_redirect("unknown_provider")

    cookie_state = request.cookies.get(_STATE_COOKIE, "")
    if not code or not state or not cookie_state or not secrets.compare_digest(state, cookie_state):
        return _error_redirect("invalid_state")

    try:
        token = await exchange_code_for_token(cfg, code, _callback_url(request, provider))
        profile = await fetch_profile(cfg, token)
    except Exception as exc:  # noqa: BLE001 - 외부 호출 실패는 로그인 실패로 통일
        logger.warning("[oauth] %s 실패: %s", provider, exc)
        return _error_redirect("oauth_failed")

    user_id = f"{provider}_{profile.uid}"
    repo = SignupPgRepository(session=db)
    existing = await repo.find_by_user_id(user_id)
    if existing is None:
        await repo.save_user(
            SignupCommand(
                user_id=user_id,
                password_hash=_OAUTH_PLACEHOLDER_HASH,
                email=profile.email,
                nickname=profile.nickname or user_id,
                role="user",
            )
        )
        role = "user"
    else:
        role = existing.role

    logger.info("[oauth] 로그인 provider=%s user_id=%s", provider, user_id)
    params = urlencode({"userId": user_id, "role": role})
    resp = RedirectResponse(f"{_frontend_base()}/login/callback?{params}", status_code=302)
    resp.delete_cookie(_STATE_COOKIE)
    return resp
