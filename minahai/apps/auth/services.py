"""토큰 발급 오케스트레이션 + Redis 리프레시 세션 스토어.

- 비밀번호/OAuth 로그인 → 사용자·role 확정 → RS256 access+refresh 발급.
- refresh는 Redis에 jti로 저장, 로테이션. **재사용 감지 시 해당 사용자 세션 전체 폐기**.
- role은 서버 권위(`resolve_role`, allowlist)로 결정 — 클라이언트 신뢰 안 함.

기존 자산 재사용(중복 방지): `users.oauth`(provider·토큰교환·프로필), 로그인/유저 repo,
`users.auth.admin_allowlist.resolve_role`. (auth→users 단방향 import는 허용, 역방향은 §1 금지.)
"""

from __future__ import annotations

import os
import time

import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from core.matrix.security import (
    ACCESS_TTL_MIN,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)
from core.matrix.token_store import blacklist_access, redis_client
from users.adapter.inbound.api.schemas.user_schema import LoginSchema
from users.adapter.outbound.pg.login_pg_repository import LoginPgRepository
from users.adapter.outbound.pg.signup_pg_repository import SignupPgRepository
from users.adapter.outbound.pg.user_pg_repository import UserPgRepository
from users.app.dtos.signup_dto import SignupCommand
from users.app.use_cases.login_interactor import LoginInteractor
from users.auth.admin_allowlist import resolve_role
from users.oauth.oauth_service import OAuthProfile

_SERVICE_AUD = os.getenv("SERVICE_AUD", "minahdev-api")
_OAUTH_PLACEHOLDER_HASH = "!oauth-no-password"


def _rt_key(sub: str, jti: str) -> str:
    return f"auth:rt:{sub}:{jti}"


# ── Redis refresh 세션 스토어 (블랙리스트 원시함수는 core.matrix.token_store) ──

async def _store_refresh(sub: str, jti: str, exp_epoch: int) -> None:
    ttl = max(1, exp_epoch - int(time.time()))
    await redis_client().set(_rt_key(sub, jti), "1", ex=ttl)


async def _consume_refresh(sub: str, jti: str) -> bool:
    """존재하면 삭제하고 True. 이미 없으면(=재사용) False."""
    deleted = await redis_client().delete(_rt_key(sub, jti))
    return deleted == 1


async def _revoke_all_refresh(sub: str) -> None:
    keys = [k async for k in redis_client().scan_iter(match=_rt_key(sub, "*"))]
    if keys:
        await redis_client().delete(*keys)


# ── 발급 ─────────────────────────────────────────────────────────

async def _issue_pair(sub: str, roles: list[str]) -> tuple[str, str, int]:
    access = create_access_token(sub, roles, aud=_SERVICE_AUD)
    refresh, jti, exp = create_refresh_token(sub)
    await _store_refresh(sub, jti, exp)
    return access, refresh, ACCESS_TTL_MIN * 60


async def login_with_password(db: AsyncSession, user_id: str, password: str) -> tuple[str, str, int]:
    """비밀번호 로그인 → 토큰쌍. 비번 로그인은 이메일 미검증 → admin 불가."""
    await LoginInteractor(repository=LoginPgRepository(session=db)).login_user(
        LoginSchema(userId=user_id, password=password)
    )
    row = await UserPgRepository(session=db).find_by_user_id(user_id)
    role = resolve_role(row.email if row else None, row.role if row else "user", email_verified=False)
    return await _issue_pair(user_id, [role])


async def login_with_oauth(db: AsyncSession, profile: OAuthProfile) -> tuple[str, str, int]:
    """소셜 로그인 → 사용자 upsert → 토큰쌍. 검증 이메일 → allowlist면 admin 가능."""
    user_id = f"{profile.provider}_{profile.uid}"
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
        db_role = "user"
    else:
        db_role = existing.role
    role = resolve_role(profile.email, db_role, email_verified=True)
    return await _issue_pair(user_id, [role])


async def rotate_refresh(db: AsyncSession, refresh_token: str) -> tuple[str, str, int]:
    """리프레시 로테이션. 재사용(이미 소비된 jti) 감지 시 세션 전체 폐기 후 거부."""
    claims = verify_refresh_token(refresh_token)  # 서명·만료 검증
    sub = str(claims["sub"])
    jti = str(claims["jti"])
    if not await _consume_refresh(sub, jti):
        # 이미 로테이션된 토큰 재사용 → 탈취 의심 → 전 세션 폐기
        await _revoke_all_refresh(sub)
        raise jwt.InvalidTokenError("리프레시 토큰 재사용 감지 — 세션이 폐기되었습니다.")
    # role 재계산(권위) — 그새 바뀌었을 수 있음
    row = await UserPgRepository(session=db).find_by_user_id(sub)
    role = resolve_role(row.email if row else None, row.role if row else "user", email_verified=False)
    return await _issue_pair(sub, [role])


async def logout(refresh_token: str | None, access_jti: str | None, access_exp: int | None) -> None:
    """refresh 폐기 + access jti 블랙리스트(즉시 차단)."""
    if refresh_token:
        try:
            claims = verify_refresh_token(refresh_token)
            await _consume_refresh(str(claims["sub"]), str(claims["jti"]))
        except jwt.InvalidTokenError:
            pass
    if access_jti and access_exp:
        await blacklist_access(access_jti, access_exp)
