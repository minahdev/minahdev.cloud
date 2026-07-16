from __future__ import annotations

import os

import httpx

from moneyball.app.ports.output.embedding_port import EmbeddingPort

_MODEL = "bge-m3"


def _embed_url() -> str:
    """백엔드는 OLLAMA_URL(=.../api/chat)로 Ollama에 접근한다. 같은 호스트의 /api/embed 사용."""
    base = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434/api/chat")
    root = base.rsplit("/api/", 1)[0]
    return f"{root}/api/embed"


class OllamaEmbeddingAdapter(EmbeddingPort):
    """Ollama bge-m3 임베딩 어댑터 (1024차원)."""

    async def embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(_embed_url(), json={"model": _MODEL, "input": text})
            resp.raise_for_status()
            return resp.json()["embeddings"][0]
