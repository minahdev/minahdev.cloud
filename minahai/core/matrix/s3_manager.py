"""S3 클라이언트 SSOT.

- 자격증명(IAM Access Key)은 Keymaker(secret_manager)가 관리한다.
- 리전·버킷은 .env 에서 읽는다 (AWS_DEFAULT_REGION / S3_BUCKET).
- 자격증명이 없으면 boto3 기본 체인(EC2 IAM Role, ~/.aws/credentials)으로 넘어간다.
- 클라이언트는 프로세스당 한 번만 생성(lru_cache 싱글톤).
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Any

import boto3

from core.matrix.secret_manager import get_keymaker  # import 시 .env 로드

logger = logging.getLogger(__name__)

_DEFAULT_REGION = "ap-northeast-2"  # 서울


def get_region() -> str:
    return (
        os.getenv("AWS_REGION")
        or os.getenv("AWS_DEFAULT_REGION")
        or _DEFAULT_REGION
    ).strip()


def get_bucket() -> str:
    """기본 버킷명. 없으면 RuntimeError."""
    bucket = (os.getenv("S3_BUCKET") or "").strip()
    if not bucket:
        raise RuntimeError(".env 에 S3_BUCKET 을 설정하세요.")
    return bucket


@lru_cache(maxsize=1)
def get_s3_client() -> Any:
    """앱 전역 단일 S3 클라이언트."""
    keymaker = get_keymaker()
    region = get_region()

    if keymaker.has_aws_credentials:
        access_key, secret_key = keymaker.get_aws_credentials()
        logger.info("[S3Manager] IAM Access Key 사용 | region=%s", region)
        return boto3.client(
            "s3",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )

    logger.info("[S3Manager] boto3 기본 자격증명 체인 사용 | region=%s", region)
    return boto3.client("s3", region_name=region)


def list_bucket_names() -> list[str]:
    """계정의 S3 버킷 이름 목록 (자격증명 확인용)."""
    response = get_s3_client().list_buckets()
    return [b["Name"] for b in response["Buckets"]]


if __name__ == "__main__":
    for name in list_bucket_names():
        print(name)
