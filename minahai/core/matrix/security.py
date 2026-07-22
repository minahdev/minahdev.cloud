"""RS256 JWT 발급·검증 — 인증 게이트(auth)와 백엔드 공용.

- 발급부(`create_*`): auth 컨테이너 전용. `JWT_PRIVATE_KEY`를 **호출 시점**에 읽는다
  (모듈 import만으로 키 부재 에러가 나면 안 됨 → 백엔드 컨테이너는 공개키만 있어도 import 가능).
- 검증부(`verify_token`): 모든 컨테이너 공용. `JWT_PUBLIC_KEY`만 필요.
- 알고리즘은 RS256 리터럴 하드코딩(규칙). 비대칭이라 백엔드는 검증만 가능·발급 불가.
"""

from __future__ import annotations

import json
import os
import time
import uuid

import bcrypt
import jwt
from jwt.algorithms import RSAAlgorithm
from pydantic import BaseModel

_ALGORITHM = "RS256"  # ⚠️ 리터럴 하드코딩 — 환경변수/설정으로 빼지 않는다.
_KID = os.getenv("JWT_KID", "minahdev-auth-1")  # 키 회전 시 변경

# 쿠키 이름 (auth 발급 → 브라우저)
ACCESS_COOKIE = "pace_access"
REFRESH_COOKIE = "pace_refresh"

# auth 발급 시 사용하는 쿠키 옵션 (서브도메인 공유: auth.·api.minahdev.cloud)
COOKIE_KWARGS = dict(
    domain=".minahdev.cloud",
    secure=True,
    httponly=True,
    samesite="lax",
)

ACCESS_TTL_MIN = 10
REFRESH_TTL_DAYS = 14


class TokenPayload(BaseModel):
    """검증된 access token 클레임."""

    sub: str
    roles: list[str] = []
    aud: str
    exp: int
    iat: int
    jti: str


def _normalize_pem(raw: str) -> str:
    # 멀티라인 env 주입 대응: `\n` 리터럴을 실제 개행으로.
    return raw.replace("\\n", "\n")


def _private_key() -> str:
    key = os.getenv("JWT_PRIVATE_KEY")
    if not key:
        raise RuntimeError("JWT_PRIVATE_KEY 미설정 — 토큰 발급은 auth 컨테이너에서만 가능합니다.")
    return _normalize_pem(key)


def _public_key() -> str:
    key = os.getenv("JWT_PUBLIC_KEY")
    if not key:
        raise RuntimeError("JWT_PUBLIC_KEY 미설정.")
    return _normalize_pem(key)


# ── 발급 (auth 전용) ──────────────────────────────────────────────

def create_access_token(sub: str, roles: list[str], aud: str, expires_min: int = ACCESS_TTL_MIN) -> str:
    now = int(time.time())
    claims = {
        "sub": sub,
        "roles": roles,
        "aud": aud,
        "iat": now,
        "exp": now + expires_min * 60,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(claims, _private_key(), algorithm=_ALGORITHM, headers={"kid": _KID})


def create_refresh_token(sub: str) -> tuple[str, str, int]:
    """(token, jti, exp) 반환. refresh는 Redis에 jti로 저장·로테이션한다."""
    now = int(time.time())
    jti = uuid.uuid4().hex
    exp = now + REFRESH_TTL_DAYS * 24 * 3600
    claims = {"sub": sub, "typ": "refresh", "iat": now, "exp": exp, "jti": jti}
    token = jwt.encode(claims, _private_key(), algorithm=_ALGORITHM, headers={"kid": _KID})
    return token, jti, exp


# ── 검증 (공용) ──────────────────────────────────────────────────

def verify_token(token: str, aud: str) -> TokenPayload:
    """access token 검증. 서명·만료·aud 불일치·alg 위조 시 jwt 예외 발생."""
    claims = jwt.decode(token, _public_key(), algorithms=[_ALGORITHM], audience=aud)
    return TokenPayload(**claims)


def verify_refresh_token(token: str) -> dict:
    """refresh token 검증(aud 없음). typ=refresh 확인."""
    claims = jwt.decode(token, _public_key(), algorithms=[_ALGORITHM], options={"verify_aud": False})
    if claims.get("typ") != "refresh":
        raise jwt.InvalidTokenError("refresh 토큰이 아닙니다.")
    return claims


def public_jwk() -> dict:
    """공개키 → JWK(kid 포함). `/.well-known/jwks.json` 응답용."""
    key_obj = RSAAlgorithm(RSAAlgorithm.SHA256).prepare_key(_public_key())
    jwk = json.loads(RSAAlgorithm.to_jwk(key_obj))
    jwk.update({"kid": _KID, "use": "sig", "alg": _ALGORITHM})
    return jwk


# ── 비밀번호 해싱 (auth 전용) ─────────────────────────────────────

def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False
