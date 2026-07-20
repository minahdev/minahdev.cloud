# AWS orchestrator container — no AI (no ollama/kuzu). Fits t3.micro/free tier.
FROM python:3.11-slim

# uv for fast, reproducible installs.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src

# Only the orchestrator extra → ollama/kuzu are NOT installed.
RUN uv sync --extra orchestrator --no-dev

EXPOSE 8000
CMD ["uv", "run", "cloud-orchestrator"]
