"""BFF↔백엔드 신원 토큰 — HMAC-SHA256 서명 (프레임워크 무관, stdlib만).

Next BFF가 검증된 세션에서 신원(sub·email·ev)을 서명해 `X-Pace-Identity` 헤더로
전달하고, FastAPI가 여기서 검증한다. 비밀키는 `SESSION_SECRET`(Next와 동일값).
main.py의 게이트 쿠키와 같은 HMAC 패턴을 따른다.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any


# 세션 쿠키·신원 토큰 수명 (Next 쿠키 maxAge와 동일하게 유지).
SESSION_TTL_SECONDS = 60 * 60 * 24 * 7  # 7일


def _secret() -> bytes:
    return os.getenv("SESSION_SECRET", "changeme").encode()


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64d(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def sign_identity(payload: dict[str, Any], ttl_seconds: int = 3600) -> str:
    """payload에 exp를 붙여 `body_b64.sig_hex` 형태로 서명한다."""
    body = dict(payload)
    body["exp"] = int(time.time()) + ttl_seconds
    raw = json.dumps(body, separators=(",", ":"), ensure_ascii=False).encode()
    b64 = _b64e(raw)
    sig = hmac.new(_secret(), b64.encode(), hashlib.sha256).hexdigest()
    return f"{b64}.{sig}"


def verify_identity(token: str) -> dict[str, Any] | None:
    """서명·만료 검증 후 payload를 반환. 실패 시 None (조용히 거부)."""
    try:
        b64, sig = token.rsplit(".", 1)
    except ValueError:
        return None
    expected = hmac.new(_secret(), b64.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        body = json.loads(_b64d(b64))
    except Exception:
        return None
    if not isinstance(body, dict):
        return None
    exp = body.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        return None
    return body
