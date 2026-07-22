"""auth 게이트 토큰 검증 — RS256 발급/검증 acceptance 테스트 (self-contained 키쌍).

Redis가 필요한 refresh 재사용→세션폐기 테스트는 통합 테스트(docker)로 별도 확인.
실행: `cd minahai && pytest apps/auth/tests/test_security.py`
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

_ROOT = Path(__file__).resolve().parents[3]  # minahai/
for p in (str(_ROOT), str(_ROOT / "apps")):
    if p not in sys.path:
        sys.path.insert(0, p)

AUD = "minahdev-api"


@pytest.fixture(autouse=True)
def _keys(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ).decode()
    pub = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    monkeypatch.setenv("JWT_PRIVATE_KEY", priv)
    monkeypatch.setenv("JWT_PUBLIC_KEY", pub)
    monkeypatch.setenv("SERVICE_AUD", AUD)


def _sec():
    from core.matrix import security  # 키는 호출 시점 read → import 시 키 불필요

    return security


def test_valid_roundtrip():
    s = _sec()
    tok = s.create_access_token("google_1", ["admin"], aud=AUD)
    p = s.verify_token(tok, aud=AUD)
    assert p.sub == "google_1" and p.roles == ["admin"] and p.jti


def test_aud_mismatch_rejected():
    s = _sec()
    tok = s.create_access_token("u", ["user"], aud=AUD)
    with pytest.raises(jwt.InvalidAudienceError):
        s.verify_token(tok, aud="other-api")


def test_expired_rejected():
    s = _sec()
    tok = s.create_access_token("u", ["user"], aud=AUD, expires_min=-1)
    with pytest.raises(jwt.ExpiredSignatureError):
        s.verify_token(tok, aud=AUD)


def test_tampered_rejected():
    s = _sec()
    tok = s.create_access_token("u", ["user"], aud=AUD)
    tampered = tok[:-3] + ("abc" if tok[-3:] != "abc" else "xyz")
    with pytest.raises(jwt.PyJWTError):
        s.verify_token(tampered, aud=AUD)


def test_hs256_algorithm_rejected():
    s = _sec()
    forged = jwt.encode(
        {"sub": "attacker", "roles": ["admin"], "aud": AUD,
         "exp": int(time.time()) + 999, "iat": int(time.time()), "jti": "x"},
        "any-hmac-secret",
        algorithm="HS256",
    )
    with pytest.raises(jwt.InvalidAlgorithmError):
        s.verify_token(forged, aud=AUD)


def test_alg_none_rejected():
    s = _sec()
    tok = jwt.encode(
        {"sub": "a", "roles": [], "aud": AUD,
         "exp": int(time.time()) + 999, "iat": int(time.time()), "jti": "x"},
        key="",
        algorithm="none",
    )
    with pytest.raises(jwt.PyJWTError):
        s.verify_token(tok, aud=AUD)


def test_refresh_typ_and_access_rejected_as_refresh():
    s = _sec()
    rt, jti, exp = s.create_refresh_token("google_1")
    claims = s.verify_refresh_token(rt)
    assert claims["typ"] == "refresh" and claims["jti"] == jti and exp > int(time.time())
    acc = s.create_access_token("u", ["user"], aud=AUD)
    with pytest.raises(jwt.InvalidTokenError):
        s.verify_refresh_token(acc)


def test_jwks_has_kid_and_rsa():
    s = _sec()
    jwk = s.public_jwk()
    assert jwk.get("kty") == "RSA" and jwk.get("kid") and jwk.get("alg") == "RS256"


def test_password_hash_roundtrip():
    s = _sec()
    h = s.hash_password("pw123")
    assert s.verify_password("pw123", h) and not s.verify_password("wrong", h)
