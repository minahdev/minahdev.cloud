# BOOTSTRAP — 하이브리드 A2A/MCP 멀티에이전트 (포트폴리오)

> **이 문서의 용도**: Claude Code에게 하네스로 넘기는 프로젝트 부트스트랩 브리프입니다.
> "이 문서를 읽고 아래 리포 구조와 `pyproject.toml`을 그대로 생성한 뒤, 각 유닛의 최소 실행 스켈레톤을 채워라" 라고 지시하세요.
> 아키텍처 제약(특히 **4GB VRAM / 16GB RAM**)은 협상 대상이 아니라 **하드 제약**입니다. 절대 위반하지 마세요.

---

## 0. 한 줄 요약

온프렘 노트북(헤드리스 Ubuntu)의 **GPU LLM 에이전트 2개(EXAONE 3.5 2.4B, Qwen2.5 1.5B)** 가
**AWS의 AI 없는 오케스트레이터** 와 **A2A/MCP** 로 통신하고, **Kùzu 그래프 DB** 를 공유 메모리로 쓰며,
결과를 **Vercel 프론트** 로 스트리밍하는 하이브리드 멀티에이전트 시스템. **개인 포트폴리오용(비상업).**

---

## 1. 아키텍처

```
[Vercel 프론트(Next.js)]
        │  HTTPS (SSE 스트리밍)
        ▼
[AWS 오케스트레이터]  ── AI 없음. t3.micro/프리티어. A2A 라우팅 + MCP 클라이언트
        │
        ▼  Cloudflare Tunnel (온프렘 NAT 통과)
[온프렘 Ubuntu = 이 노트북, 헤드리스]
   ├─ MCP 서버(툴/컨텍스트 노출)
   ├─ Kùzu 임베디드 그래프 DB   ← A2A 공유 메모리 / 메시지 로그
   ├─ EXAONE 3.5 2.4B  에이전트 (Ollama, GPU)
   └─ Qwen2.5 1.5B    에이전트 (Ollama, GPU)
```

- **A2A**(Agent2Agent) = 에이전트 간 태스크 위임 프로토콜. **MCP**(Model Context Protocol) = 툴/컨텍스트 노출.
  둘은 별개 규격이며 **혼합해서** 쓴다: 각 에이전트를 A2A로 서로 호출하고, 각자 자신의 능력을 MCP 서버로 노출한다.
- 그래프 DB는 "누가 누구에게 무슨 태스크를 넘겼고 결과가 뭐였나"를 노드/엣지로 기록 → A2A 대화 히스토리 = 지식 그래프.

---

## 2. 하드웨어 제약 (하드 제약 — 위반 금지)

| 자원 | 실측 | 규칙 |
|---|---|---|
| GPU | GTX 1650 **4GB** (텐서코어 없음) | 두 모델 Q4 동시 상주 상한. Qwen은 반드시 **1.5B**. 3B 금지 |
| RAM | 16GB (헤드리스 시 여유 충분, Windows 동시 구동 시 부족) | Neo4j 금지 → **Kùzu(임베디드)** 사용 |
| CPU | Ryzen 7 3750H (4C/8T) | CPU 추론은 폴백일 뿐, 기본은 GPU |

**따라서:**
- LLM 런타임은 **Ollama**(llama.cpp+CUDA). `torch`/`transformers` **미설치** — 4GB VRAM에 무겁고 불필요.
- 모델은 Q4 양자화 태그 사용. EXAONE 2.4B(~1.6GB) + Qwen 1.5B(~1.0GB) + KV ≈ 3.2GB → 4GB에 상주 가능.
- AWS 유닛에는 GPU/DB 의존성(`ollama`, `kuzu`) 절대 넣지 말 것 → `orchestrator` extra로 분리됨.

---

## 3. 생성할 리포 구조

```
a2a-hybrid-agents/
├─ pyproject.toml              # ← 아래 4장 그대로
├─ README.md
├─ .env.example               # 포트/모델명/터널 URL
├─ src/
│  ├─ shared/                 # 세 유닛 공통 (경량, 무거운 dep 없음)
│  │  ├─ __init__.py
│  │  ├─ config.py            # pydantic-settings 설정
│  │  ├─ a2a_schemas.py       # A2A 메시지 / AgentCard 스키마
│  │  └─ mcp_tools.py         # 공통 MCP 툴 시그니처
│  ├─ onprem/                 # 온프렘 전용 (agent extra)
│  │  ├─ __init__.py
│  │  ├─ llm/ollama_client.py # 모델 스왑 / keep_alive 래퍼
│  │  ├─ graph_store.py       # Kùzu 커넥션 + 메시지 로그 스키마
│  │  └─ agents/
│  │     ├─ exaone/server.py  # main() — EXAONE 에이전트 (FastAPI+A2A+MCP)
│  │     └─ qwen/server.py    # main() — Qwen 에이전트
│  └─ cloud/                  # AWS 전용 (orchestrator extra, AI 없음)
│     └─ orchestrator/server.py  # main() — A2A 라우터
├─ web/                       # Vercel(Next.js) — pyproject 범위 밖, 스캐폴드만
├─ deploy/
│  ├─ cloudflared/config.yml  # 터널 설정 템플릿
│  └─ aws/Dockerfile          # 오케스트레이터 컨테이너
└─ tests/
```

> `cloud`가 `onprem`을 import하지 않으므로, AWS에는 `.[orchestrator]`만 설치하면 `ollama`/`kuzu` 없이 동작한다.
> (같은 wheel에 `onprem` 코드가 함께 실려도 import되지 않으면 무해 — 포트폴리오 규모에선 이 단순화가 적절.)

---

## 4. pyproject.toml (그대로 생성)

```toml
[project]
name = "a2a-hybrid-agents"
version = "0.1.0"
description = "Hybrid multi-agent portfolio: on-prem GPU agents (EXAONE 3.5 2.4B, Qwen2.5 1.5B) talk to a no-AI AWS orchestrator over A2A/MCP, sharing memory in a Kuzu graph DB, streaming to a Vercel frontend."
readme = "README.md"
requires-python = ">=3.11"
license = "MIT"
authors = [{ name = "Your Name", email = "you@example.com" }]
keywords = ["a2a", "mcp", "multi-agent", "llm", "graph-database", "ollama"]

# 공통 코어 — 세 유닛 모두 사용하는 최소 집합 (무거운 dep 없음)
dependencies = [
  "pydantic>=2.7",
  "pydantic-settings>=2.3",
  "httpx>=0.27",
  "structlog>=24.1",
]

[project.optional-dependencies]
# 온프렘 Ubuntu(이 노트북, 헤드리스) — GPU LLM 에이전트.
# torch 미포함: Ollama(llama.cpp+CUDA)가 GPU 추론 담당 → 4GB VRAM에 최적.
agent = [
  "fastapi>=0.111",
  "uvicorn[standard]>=0.30",
  "ollama>=0.3",       # 로컬 LLM 런타임 클라이언트 (모델 스왑 / keep_alive)
  "mcp>=1.2",          # Model Context Protocol SDK (툴/컨텍스트 노출)
  "a2a-sdk>=0.2",      # Agent2Agent 프로토콜 SDK (import 이름: a2a)
  "kuzu>=0.6",         # 임베디드 그래프 DB (공유 메모리 / 메시지 로그)
]

# AWS 오케스트레이터 — AI 없음. 라우팅/조율만. GPU·DB 의존성 없음(가벼움).
orchestrator = [
  "fastapi>=0.111",
  "uvicorn[standard]>=0.30",
  "mcp>=1.2",
  "a2a-sdk>=0.2",
]

# uv 기본 개발 그룹 (uv sync 시 자동 설치)
[dependency-groups]
dev = [
  "ruff>=0.6",
  "mypy>=1.11",
  "pytest>=8.3",
  "pytest-asyncio>=0.24",
  "anyio>=4.4",
]

[project.scripts]
onprem-exaone      = "onprem.agents.exaone.server:main"
onprem-qwen        = "onprem.agents.qwen.server:main"
cloud-orchestrator = "cloud.orchestrator.server:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/shared", "src/onprem", "src/cloud"]

[tool.ruff]
line-length = 100
target-version = "py311"
src = ["src"]

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "ASYNC", "SIM"]

[tool.mypy]
python_version = "3.11"
strict = true
mypy_path = "src"
packages = ["shared", "onprem", "cloud"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

## 5. 런타임 전제 (문서화만, 설치는 사용자 담당)

```bash
# 1) Ollama 설치 후 모델 받기 (온프렘)
ollama pull exaone3.5:2.4b
ollama pull qwen2.5:1.5b

# 2) Cloudflare Tunnel (온프렘 NAT 통과 — AWS/Vercel이 온프렘을 호출 가능하게)
#    cloudflared 설치 후 deploy/cloudflared/config.yml 로 터널 기동

# 3) Python 툴체인: uv 사용
```

`.env.example` 에 넣을 키:
`ONPREM_TUNNEL_URL`, `EXAONE_MODEL=exaone3.5:2.4b`, `QWEN_MODEL=qwen2.5:1.5b`,
`OLLAMA_HOST=http://localhost:11434`, `KUZU_DB_PATH=./data/graph`, `EXAONE_PORT`, `QWEN_PORT`, `ORCH_PORT`.

---

## 6. 설치·실행

```bash
# 온프렘 (이 노트북)
uv sync --extra agent
uv run onprem-exaone      # EXAONE 에이전트
uv run onprem-qwen        # Qwen 에이전트

# AWS (AI 없음 — ollama/kuzu 안 깔림)
uv sync --extra orchestrator
uv run cloud-orchestrator
```

---

## 7. Claude Code 작업 체크리스트

- [ ] 3장 리포 구조 + 4장 `pyproject.toml` 생성
- [ ] `shared/config.py`: pydantic-settings로 위 env 로드
- [ ] `shared/a2a_schemas.py`: A2A 메시지/AgentCard 최소 스키마
- [ ] `onprem/llm/ollama_client.py`: 요청 시 모델 로드·응답, `keep_alive`로 순차 스왑 (동시 상주 실패 시 폴백)
- [ ] `onprem/graph_store.py`: Kùzu에 `(Agent)-[:SENT]->(Task)-[:PRODUCED]->(Result)` 스키마 + 기록 헬퍼
- [ ] 각 `server.py`에 `main()` 엔트리포인트 (FastAPI + A2A 라우트 + MCP 서버 마운트)
- [ ] `cloud/orchestrator/server.py`: 프론트 요청 → 적절한 온프렘 에이전트로 A2A 위임 → SSE로 결과 스트리밍. **LLM 호출 코드 없음**
- [ ] `tests/`: A2A 메시지 왕복 스모크 테스트(에이전트는 목킹)
- [ ] `ruff check`, `mypy`, `pytest` 통과

## 8. 검증 기준 (완료 정의)

1. `uv sync --extra orchestrator` 결과에 `ollama`/`kuzu`가 **없어야** 함 (AWS 경량성 증명).
2. 두 에이전트 + 오케스트레이터가 로컬에서 동시에 뜨고, 오케스트레이터→EXAONE→(A2A)→Qwen 왕복 1건이 Kùzu에 기록됨.
3. `nvidia-smi` VRAM 사용량이 4GB를 넘지 않음.

---

## ⚠️ Claude Code가 반드시 확인할 것 (버전은 변동적)

- `a2a-sdk`, `mcp`, `kuzu`, `ollama` 는 릴리스가 빠릅니다. 위 하한 버전은 **플로어일 뿐** — `uv add <pkg>` 로 현재 최신을 잠그고 실제 import 경로/API를 확인하세요.
- `a2a-sdk` 의 import 이름은 `a2a` 입니다(패키지명과 다름).
- `license = "MIT"` SPDX 문자열이 빌드 백엔드에서 에러 나면 `license = { text = "MIT" }` 로 교체.
- **EXAONE 3.5 라이선스는 비상업 연구용** — 개인 포트폴리오(비상업)라 적합. 상업화 시 재검토.