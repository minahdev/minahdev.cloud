"""Ollama wrapper with model-swap awareness for the 4GB VRAM budget.

``ollama`` is imported lazily so the module (and anything importing it) loads
even in the base/dev env where the ``agent`` extra isn't installed.

Model residency: EXAONE 2.4B (~1.6GB) + Qwen 1.5B (~1.0GB) + KV ≈ 3.2GB fits
4GB, so the default ``keep_alive`` keeps both resident. If co-residence OOMs,
call with ``keep_alive="0s"`` to unload immediately after each generate and let
Ollama swap models sequentially (slower, but safe).
"""

from __future__ import annotations

from typing import Any

import structlog

log = structlog.get_logger(__name__)


class OllamaClient:
    def __init__(self, host: str) -> None:
        self._host = host
        self._client: Any | None = None

    def _ensure(self) -> Any:
        if self._client is None:
            try:
                import ollama
            except ImportError as exc:  # pragma: no cover - env guard
                raise RuntimeError(
                    "ollama not installed. Run `uv sync --extra agent`."
                ) from exc
            self._client = ollama.AsyncClient(host=self._host)
        return self._client

    async def generate(self, model: str, prompt: str, keep_alive: str = "5m") -> str:
        """Single-shot generation. ``keep_alive`` controls VRAM residency."""
        client = self._ensure()
        log.info("ollama.generate", model=model, keep_alive=keep_alive)
        resp: Any = await client.generate(model=model, prompt=prompt, keep_alive=keep_alive)
        return str(resp["response"])
