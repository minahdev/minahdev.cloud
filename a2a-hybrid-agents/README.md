# a2a-hybrid-agents

Hybrid A2A/MCP multi-agent portfolio. Two on-prem GPU LLM agents
(**EXAONE 3.5 2.4B**, **Qwen2.5 1.5B** via Ollama) talk to a **no-AI AWS
orchestrator** over **A2A**, expose tools over **MCP**, share memory in a
**Kùzu** graph DB, and stream to a **Vercel** frontend. Personal, non-commercial.

```
[Vercel (Next.js)] --SSE--> [AWS orchestrator (no AI)] --A2A--> [on-prem agents]
                                                                   EXAONE <-A2A-> Qwen
                                                                   Kùzu graph = shared memory
```

## Hard constraints (do not violate)

- GPU: GTX 1650 **4GB** → both models Q4, co-resident. **Qwen must stay 1.5B.**
- No `torch`/`transformers`. Ollama (llama.cpp + CUDA) does inference.
- AWS orchestrator has **no** `ollama`/`kuzu` — proven by the `orchestrator` extra.

## Layout

- `src/shared` — config, A2A schemas, MCP tool specs, A2A client (base deps only).
- `src/onprem` — Ollama client, Kùzu graph store, EXAONE + Qwen agents (`agent` extra).
- `src/cloud` — orchestrator, A2A router + SSE, **no LLM code** (`orchestrator` extra).

## Install & run (uv)

```bash
# On-prem (this laptop)
uv sync --extra agent
uv run onprem-exaone      # :8001
uv run onprem-qwen        # :8002

# AWS (no ollama/kuzu installed)
uv sync --extra orchestrator
uv run cloud-orchestrator # :8000
```

Round trip: `POST :8000/chat {"message": "...", "agent": "exaone"}` →
EXAONE drafts → delegates to Qwen over A2A → both legs logged to Kùzu →
result streamed back as SSE.

## Dev

```bash
uv sync --extra agent --extra orchestrator   # dev group installs automatically
uv run ruff check .
uv run mypy
uv run pytest
```

## Runtime prerequisites (you install these)

```bash
ollama pull exaone3.5:2.4b
ollama pull qwen2.5:1.5b
# cloudflared tunnel per deploy/cloudflared/config.yml
```

## Notes / hardening path

- A2A and MCP here are a small, self-contained HTTP+Pydantic subset so the
  skeleton runs today. The `a2a-sdk` (import name `a2a`) and `mcp` SDKs are
  declared as deps — swap the `shared/a2a_*` and `shared/mcp_tools` layers for
  the official SDK types when hardening. Pin latest with `uv add` and verify
  import paths first (these SDKs move fast).
- Kùzu is single-writer: only the EXAONE agent opens the shared DB and logs the
  whole round trip; Qwen uses a `NullGraph`.
- **EXAONE 3.5 license is non-commercial research** — fine for a personal
  portfolio; revisit before any commercial use.
