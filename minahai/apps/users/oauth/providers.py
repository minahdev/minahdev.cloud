"""provider 레지스트리 — authorize/token/userinfo 엔드포인트 + userinfo 파서.

client_id/secret은 환경변수 `{PROVIDER}_CLIENT_ID` / `{PROVIDER}_CLIENT_SECRET`.
"""

from __future__ import annotations

import os
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    scope: str
    # userinfo JSON → (uid, email, nickname)
    parse: Callable[[dict[str, Any]], tuple[str, str, str]]


def _parse_google(d: dict[str, Any]) -> tuple[str, str, str]:
    return str(d.get("sub", "")), str(d.get("email", "")), str(d.get("name", ""))


def _parse_kakao(d: dict[str, Any]) -> tuple[str, str, str]:
    account = d.get("kakao_account") or {}
    profile = account.get("profile") or {}
    props = d.get("properties") or {}
    nickname = profile.get("nickname") or props.get("nickname") or ""
    return str(d.get("id", "")), str(account.get("email") or ""), str(nickname)


def _parse_naver(d: dict[str, Any]) -> tuple[str, str, str]:
    r = d.get("response") or {}
    nickname = r.get("nickname") or r.get("name") or ""
    return str(r.get("id", "")), str(r.get("email") or ""), str(nickname)


_REGISTRY: dict[str, ProviderConfig] = {
    "google": ProviderConfig(
        name="google",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        userinfo_url="https://openidconnect.googleapis.com/v1/userinfo",
        scope="openid email profile",
        parse=_parse_google,
    ),
    "kakao": ProviderConfig(
        name="kakao",
        authorize_url="https://kauth.kakao.com/oauth/authorize",
        token_url="https://kauth.kakao.com/oauth/token",
        userinfo_url="https://kapi.kakao.com/v2/user/me",
        scope="profile_nickname",
        parse=_parse_kakao,
    ),
    "naver": ProviderConfig(
        name="naver",
        authorize_url="https://nid.naver.com/oauth2.0/authorize",
        token_url="https://nid.naver.com/oauth2.0/token",
        userinfo_url="https://openapi.naver.com/v1/nid/me",
        scope="",
        parse=_parse_naver,
    ),
}


def get_provider(name: str) -> ProviderConfig | None:
    return _REGISTRY.get(name)


def client_id(name: str) -> str:
    return os.getenv(f"{name.upper()}_CLIENT_ID", "")


def client_secret(name: str) -> str:
    return os.getenv(f"{name.upper()}_CLIENT_SECRET", "")
