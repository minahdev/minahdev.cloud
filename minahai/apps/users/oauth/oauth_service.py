"""OAuth 토큰 교환 + 프로필 조회 (httpx). 프레임워크 무관."""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from users.oauth.providers import ProviderConfig, client_id, client_secret


@dataclass(frozen=True)
class OAuthProfile:
    provider: str
    uid: str
    email: str
    nickname: str


async def exchange_code_for_token(cfg: ProviderConfig, code: str, redirect_uri: str) -> str:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id(cfg.name),
        "client_secret": client_secret(cfg.name),
        "redirect_uri": redirect_uri,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(cfg.token_url, data=data, headers={"Accept": "application/json"})
        resp.raise_for_status()
        token = resp.json().get("access_token")
    if not token:
        raise ValueError(f"{cfg.name}: access_token 없음")
    return str(token)


async def fetch_profile(cfg: ProviderConfig, access_token: str) -> OAuthProfile:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            cfg.userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        uid, email, nickname = cfg.parse(resp.json())
    if not uid:
        raise ValueError(f"{cfg.name}: 사용자 uid 없음")
    return OAuthProfile(provider=cfg.name, uid=uid, email=email, nickname=nickname)
