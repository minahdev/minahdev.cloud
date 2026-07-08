# Pace Monorepo — LLM 인수인계 지침

Claude·Cursor 등 **코딩 보조 LLM**이 이 저장소에서 작업을 이어받을 때 따를 **행동 원칙 + 아키텍처 + 구현 규칙**이다.

**충돌 우선순위:** 사용자 요청 → `docs/` 규칙 → 본 문서  
**트레이드오프:** 속도보다 신중함·검증 가능성.

---

## 문서 맵

| 영역 | 규칙 파일 | 문서 디렉터리 |
|------|-----------|---------------|
| **공통** | 본 파일 | `_docs/` |
| **백엔드** (FastAPI · 헥사고날 · DB · secom · inbody · titanic) | [minahai/CLAUDE.md](minahai/CLAUDE.md) | `minahai/_docs/` |
| **프론트엔드** (Next.js · API 연동) | [minahview/CLAUDE.md](minahview/CLAUDE.md) | `minahview/_docs/` |
| **Flutter** | — | `minahflutter/_docs/` |
| ERD | `docs/DevOps/Backend/PACE_FULL_ERD.md` | — |
| Cursor 하네스 | `AGENTS.md`, `.cursorrules`, `CURSOR.md` | — |

---

## 0. 코딩 전 필수 워크플로

구현·수정 **전에** 반드시:

1. **관련 코드**를 읽는다 (추측 금지).
2. 작업 영역에 맞는 CLAUDE.md를 읽는다 (위 문서 맵 참고).
3. `docs/README.md`에서 추가 문서를 확인한다.

| 작업 경로 | 읽을 문서 |
|-----------|-----------|
| `minahai/` 전반 (titanic 포함) | [minahai/CLAUDE.md](minahai/CLAUDE.md) |
| DB·ERD | `docs/DevOps/Backend/PACE_FULL_ERD.md` |
| `minahview/` | [minahview/CLAUDE.md](minahview/CLAUDE.md) |

---

## 1. LLM 행동 원칙 (네 원칙)

### 1.1 Think Before Coding (구현 전 사고)

- 가정은 명시한다. 불확실하면 질문한다.
- 해석이 여러 가지면 조용히 하나를 고르지 말고 후보를 나열한다.
- 더 단순한 방법이 있으면 말한다. 타당하면 사용자 요청을 수정·반박한다.
- 불명확하면 멈추고, 무엇이 혼란스러운지 이름 붙여 질문한다.

### 1.2 Simplicity First (단순성 우선)

- 요청받지 않은 기능·설정·추상화는 넣지 않는다.
- 일회성 코드를 위한 추상화, "나중을 위해" 유연성은 만들지 않는다.
- 사실상 불가능한 경로를 위한 방어 코드를 쌓지 않는다.
- 200줄로 쓸 수 있는 것을 50줄로 줄일 수 있으면 다시 쓴다.

### 1.3 Surgical Changes (정밀한 수정)

- 요청과 무관한 파일·줄·포맷·주석 "정리"를 하지 않는다.
- 망가지지 않은 코드는 리팩터링하지 않는다. **기존 스타일을 유지**한다.
- 원래부터 있던 데드 코드는 요청 없이 삭제하지 않는다 (언급만).
- **본인 변경**으로 불필요해진 import·변수·함수만 제거한다.
- **검증:** diff의 모든 변경은 사용자 요청과 직접 연결되어야 한다.

### 1.4 Goal-Driven Execution (목표 중심 실행)

- 코딩 전 **검증 가능한 성공 기준**을 정한다.
- 다단계 작업이면 `단계 → 검증` 형태로 짧은 계획을 쓴다.

```text
1. [단계] → 검증: [확인 사항]
2. [단계] → 검증: [확인 사항]
```

- "작동만 하게" 수준의 느슨한 완료 정의로 마무리하지 않는다.

---

## 2. Monorepo 개요

```
cloud.minahdev/
├── CLAUDE.md                # ← 지금 이 파일 (최상단)
├── _docs/                   # 공통 문서 (Obsidian 설정, 프로젝트 전반 참조)
├── minahai/                 # FastAPI 백엔드 — 단일 진입점 (main.py)
│   ├── CLAUDE.md            # 백엔드 규칙
│   ├── _docs/               # 백엔드 전용 문서 (ERD, API 설계 등)
│   ├── apps/
│   │   ├── secom/           # 회원·스케줄 — 헥사고날
│   │   ├── inbody/          # 커뮤니티·훈련일지·공지 등
│   │   └── titanic/         # 타이타닉 학습용 — 헥사고날 표준 참조
│   └── core/
│       └── matrix/oracle_database.py   # DB SSOT
├── minahview/               # Next.js 프론트엔드
│   ├── CLAUDE.md            # 프론트엔드 규칙
│   └── _docs/               # 프론트엔드 전용 문서 (화면 설계, API 연동 등)
├── minahflutter/            # Flutter 앱
│   └── _docs/               # Flutter 전용 문서
└── docs/                    # ERD·스택별 규칙
```

| 앱 패키지 | 역할 | DB 테이블 예 |
|-----------|------|--------------|
| **secom** | 회원가입·로그인·마이페이지·스케줄 입장 | `secom_users`, `schedule_*` |
| **inbody** | 오늘의 이야기·훈련일지·레슨·커뮤니티·공지 | `today_stories`, `community_*`, `notices` |
| **titanic** | CSV 업로드·승객 도메인 학습용 | `titanic_person`, `titanic_booking` |

앱이 늘어날 때는 `minahai/apps/` 아래에 **titanic과 동일한 헥사고날 패턴**으로 추가한다.

---

## 3. Import Path 규칙 (전역)

#### Apps layer (minahai 내부 모듈)
- `minahai` 접두사와 `apps` 세그먼트를 **모두 생략**한다.

  ✅ `from titanic.app.ports.input.foo_use_case import FooUseCase`  
  ❌ `from minahai.apps.titanic.app.ports.input.foo_use_case import FooUseCase`

#### Core layer
- `minahai.core.` 로 시작한다.

  ✅ `from minahai.core.matrix.oracle_database import get_db`  
  ❌ `from core.matrix.oracle_database import get_db`

---

## 4. 금지·주의 사항

- `.env`, 비밀키를 규칙 파일·커밋에 넣지 않는다.
- `get_db`를 임의 위치에 중복 정의하지 않는다 — **oracle_database SSOT**.
- 라우터에 SQL·트랜잭션 로직을 넣지 않는다.
- 요청 범위 밖 리팩터링·포맷 전체 수정·관련 없는 앱 수정 금지.
- `docs`에 없는 규칙을 **추측으로 invent** 하지 않는다.
- git commit / push는 **사용자가 명시적으로 요청할 때만**.

---

## 5. 검증 루프 (작업 마무리)

1. **성공 기준**을 문장으로 고정한다.
2. **최소 diff**로 구현한다.
3. 린트·타입 — **변경한 파일만** 확인.
4. 백엔드: 서버 기동 → 해당 `/docs` 엔드포인트 호출.
5. 프론트: 해당 화면 수동 확인 절차를 적어 둔다.
6. 통과할 때까지 2–5만 반복. 넓은 리팩터링은 하지 않는다.

---

## 6. Communication Style

- Be concise. No unnecessary explanations or filler phrases.
- Use informal/direct tone (반말 수준의 간결한 영어).
- Minimize token usage in every response.
