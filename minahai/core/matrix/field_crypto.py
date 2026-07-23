"""민감 필드 암호화 — 건강 특이사항 등 저장 전 AES-256-GCM.

키(`PROFILE_ENC_KEY`)가 **없으면 평문 그대로 저장**한다. 저장값에 `enc:v1:` 접두사를
붙여 구분하므로 평문·암호문이 한 컬럼에 섞여 있어도 읽을 수 있다.
→ 지금은 키 없이 쓰다가, 운영 서버로 옮긴 뒤 키를 넣고 `scripts/rotate_profile_key.py`로
   기존 평문을 한 번에 암호화하면 된다.

키를 잃으면 그 키로 암호화된 값은 **복구할 수 없다.** 대신 복호화 실패가 앱을 죽이지
않도록 `decrypt_field`는 예외를 삼키고 빈 문자열을 돌려준다(호출부가 "읽을 수 없음"으로 표시).
"""

from __future__ import annotations

import base64
import logging
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

_PREFIX = "enc:v1:"
_NONCE_BYTES = 12  # GCM 표준 nonce 길이


def _key() -> bytes | None:
    """`PROFILE_ENC_KEY`(base64 32바이트). 미설정이면 None → 평문 모드."""
    raw = os.getenv("PROFILE_ENC_KEY", "").strip()
    if not raw:
        return None
    try:
        key = base64.b64decode(raw)
    except Exception as exc:  # noqa: BLE001 - 설정 오류는 기동이 아니라 사용 시점에 알린다
        raise RuntimeError("PROFILE_ENC_KEY 가 base64 가 아닙니다.") from exc
    if len(key) != 32:
        raise RuntimeError(f"PROFILE_ENC_KEY 는 32바이트여야 합니다 (현재 {len(key)}바이트).")
    return key


def encryption_enabled() -> bool:
    return _key() is not None


def encrypt_field(plaintext: str | None) -> str | None:
    """키가 있으면 `enc:v1:...`로, 없으면 평문 그대로 반환."""
    if plaintext is None or plaintext == "":
        return None
    key = _key()
    if key is None:
        return plaintext
    nonce = os.urandom(_NONCE_BYTES)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return _PREFIX + base64.b64encode(nonce + ct).decode("ascii")


def decrypt_field(stored: str | None) -> str:
    """저장값 → 평문. 접두사가 없으면 평문으로 간주. 실패 시 빈 문자열."""
    if not stored:
        return ""
    if not stored.startswith(_PREFIX):
        return stored  # 암호화 도입 전에 저장된 평문
    key = _key()
    if key is None:
        logger.warning("[field_crypto] 암호문인데 PROFILE_ENC_KEY 가 없습니다 — 복호화 불가")
        return ""
    try:
        blob = base64.b64decode(stored[len(_PREFIX) :])
        return AESGCM(key).decrypt(blob[:_NONCE_BYTES], blob[_NONCE_BYTES:], None).decode("utf-8")
    except (InvalidTag, ValueError, IndexError) as exc:
        logger.warning("[field_crypto] 복호화 실패 (키 불일치·손상): %s", exc)
        return ""


def is_encrypted(stored: str | None) -> bool:
    return bool(stored) and stored.startswith(_PREFIX)


def generate_key() -> str:
    """새 키 생성 — `scripts/rotate_profile_key.py` 및 수동 발급용."""
    return base64.b64encode(os.urandom(32)).decode("ascii")
