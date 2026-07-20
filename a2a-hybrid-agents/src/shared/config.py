"""Environment-backed settings (pydantic-settings).

Loads the keys documented in `.env.example`. All three units import this;
only the fields each unit needs are read at runtime.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Cloudflare tunnel base URL the cloud orchestrator uses to reach on-prem.
    onprem_tunnel_url: str = "http://localhost"

    # Ollama model tags (Q4). Qwen must stay 1.5B (4GB VRAM hard limit).
    exaone_model: str = "exaone3.5:2.4b"
    qwen_model: str = "qwen2.5:1.5b"
    ollama_host: str = "http://localhost:11434"

    # Kùzu embedded graph DB directory.
    kuzu_db_path: str = "./data/graph"

    # Ports.
    exaone_port: int = 8001
    qwen_port: int = 8002
    orch_port: int = 8000

    @property
    def exaone_local_url(self) -> str:
        return f"http://localhost:{self.exaone_port}"

    @property
    def qwen_local_url(self) -> str:
        return f"http://localhost:{self.qwen_port}"


@lru_cache
def get_settings() -> Settings:
    """Process-wide singleton so env is parsed once."""
    return Settings()
