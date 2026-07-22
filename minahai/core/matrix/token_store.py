"""Redis 기반 토큰 리보케이션 스토어 — core 레이어(앱을 import하지 않음).

- access 블랙리스트: 즉시 차단 계정용. `verify_token` 통과해도 jti가 블랙리스트면 거부.
- Redis 클라이언트 싱글턴은 auth 서비스의 refresh 세션 스토어도 공유한다.
"""

from __future__ import annotations

import os
import time

import redis.asyncio as aioredis

_redis: aioredis.Redis | None = None


def redis_client() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=True
        )
    return _redis


def _bl_key(jti: str) -> str:
    return f"auth:bl:{jti}"


async def blacklist_access(jti: str, exp_epoch: int) -> None:
    ttl = max(1, exp_epoch - int(time.time()))
    await redis_client().set(_bl_key(jti), "1", ex=ttl)


async def is_access_blacklisted(jti: str) -> bool:
    return bool(await redis_client().exists(_bl_key(jti)))
