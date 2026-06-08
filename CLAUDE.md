# Pace Monorepo — LLM 인수인계 지침

Claude·Cursor 등 **코딩 보조 LLM**이 이 저장소에서 작업을 이어받을 때 따를 **행동 원칙 + 아키텍처 + 구현 규칙**이다.

- **일반 행동 원칙:** [Andrej Karpathy 관찰](https://x.com/karpathy/status/2015883857489522876) 기반 네 원칙 (본문 §1)
- **프로젝트 구조·패턴:** 클린 아키텍처, 헥사고날, SOLID, FastAPI 관례 (본문 §2~§8)
- **Cursor 하네스:** `AGENTS.md`, `.cursorrules`, `CURSOR.md`와 **병합**하여 해석한다. 충돌 시 **사용자 요청 → `docs/` 규칙 → 본 문서** 순.

**트레이드오프:** 속도보다 신중함·검증 가능성. 사소한 편집은 맥락에 따라 완화해도 된다.

---

## 0. 코딩 전 필수 워크플로

구현·수정 **전에** 반드시:

1. **관련 코드**를 읽는다 (추측 금지).
2. **`docs/README.md`** 에서 작업 영역 문서를 확인한다.
3. 아래 표에 맞는 문서를 읽은 뒤 구현한다.

| 작업 경로 | 읽을 문서 |
|-----------|-----------|
| `backend/` 전반 | `docs/DevOps/Backend/BACKEND_RULES.md` (있을 때) |
| `backend/apps/titanic/` | `docs/타이타닉개발/james_fastapi_init.md` + 본 문서 §5 |
| DB·ERD | `docs/DevOps/Backend/PACE_FULL_ERD.md` |
| `frontend/` | `docs/DevOps/Frontend/REACT_RULES.md` (있을 때) |

---

## 1. LLM 행동 원칙 (네 원칙)

### 1.1 Think Before Coding (구현 전 사고)

- 가정은 명시한다. 불확실하면 질문한다.
- 해석이 여러 가지면 조용히 하나를 고르지 말고 후보를 나열한다.
- 더 단순한 방법이 있으면 말한다. 타당하면 사용자 요청을 수정·반박한다.
- 불명확하면 멈추고, 무엇이 혼란스러운지 이름 붙여 질문한다.

### 1.2 Simplicity First (단순성 우선)

- 요청받지 않은 기능·설정·추상화는 넣지 않는다.
- 일회성 코드를 위한 추상화, “나중을 위해” 유연성은 만들지 않는다.
- 사실상 불가능한 경로를 위한 방어 코드를 쌓지 않는다.
- 200줄로 쓸 수 있는 것을 50줄로 줄일 수 있으면 다시 쓴다.

### 1.3 Surgical Changes (정밀한 수정)

- 요청과 무관한 파일·줄·포맷·주석 “정리”를 하지 않는다.
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

- “작동만 하게” 수준의 느슨한 완료 정의로 마무리하지 않는다.

---

## 2. Monorepo 개요

```
cloud.minahdev/
├── backend/                 # FastAPI 단일 진입점 (main.py)
│   ├── apps/
│   │   ├── secom/    # secom 도메인 (회원·스케줄 접근) — 헥사고날
│   │   ├── inbody/        # Pace 콘텐츠 (커뮤니티·공지·훈련일지 등)
│   │   └── titanic/       # 타이타닉 학습/실습 — 헥사고날 (표준 참조)
│   ├── core/
│   │   ├── matrix/oracle_database.py   # DB SSOT (get_db, engine, create_all)
│   │   └── database.py                 # shim (oracle_database 재export)
│   └── main.py            # 앱 조립·secom API 라우트 다수
├── frontend/              # Next.js
└── docs/                  # ERD·스택별 규칙
```

| 앱 패키지 | 역할 | DB 테이블 예 |
|-----------|------|--------------|
| **secom** | 회원가입·로그인·마이페이지·스케줄 입장(코드/권한) | `secom_users`, `user_information`, `schedule_*` |
| **inbody** | 오늘의 이야기, 훈련일지, 레슨, 커뮤니티, 공지 | `today_stories`, `community_*`, `notices` … |
| **titanic** | CSV 업로드·승객 도메인 학습용 | `titanic_person`, `titanic_booking` |

**중요:** Python 패키지 `backend/apps/secom/`과 DB 테이블 `secom_users` 등이 같은 **secom** 도메인을 가리킨다.

---

## 3. 클린 아키텍처 + 헥사고날

### 3.1 의존 방향 (안쪽으로만)

```
[Inbound Adapter]  →  [Application]  →  [Outbound Port]
     HTTP/Router         Use Case           Repository ABC
     Pydantic Schema     Interactor              ↑
     CSV Parser          Command/DTO             │
                                                   │
                              [Outbound Adapter] ──┘
                                   PG Repository
                                   ORM Model
```

- **도메인·유스케이스**는 FastAPI·SQLAlchemy·HTTP에 **의존하지 않는다** (이상적 목표).
- **어댑터**만 프레임워크·DB를 안다.
- **의존성 조립(Composition Root)** 은 `dependencies/` 또는 `main.py` / `deps.py`에서 한다.

### 3.2 레이어 역할 (titanic · secom 기준)

| 레이어 | 경로 패턴 | 책임 |
|--------|-----------|------|
| **Inbound API** | `adapter/inbound/api/v1/*_router.py` | HTTP만: 파라미터 수신, `Depends`, 응답 모델. **비즈니스 로직 금지** |
| **Inbound 보조** | `adapter/inbound/api/schemas/`, `james_csv_parser.py` | Pydantic 검증, CSV 파싱 등 **무상태** 변환 |
| **Input Port** | `app/ports/input/*_use_case.py` | `ABC` + `@abstractmethod` — 유스케이스 계약 |
| **Application** | `app/use_cases/*_interactor.py` | 오케스트레이션, Command/DTO 조립, 로깅 |
| **Output Port** | `app/ports/output/*_repository.py` | 저장소 계약 (ABC) |
| **Outbound PG** | `adapter/outbound/pg/*_pg_repository.py` | Port 구현, SQLAlchemy 세션 사용 |
| **Outbound ORM** | `adapter/outbound/orm/*_orm.py` | 테이블 매핑 (`__tablename__`) |
| **DTO / Command** | `app/dtos/` | 유스케이스·레포 사이 데이터 (ORM과 분리) |
| **DI Factory** | `dependencies/*.py` | `get_db` → Repository → Interactor 조립 |

### 3.3 라우터는 얇게 (Thin Controller)

**좋은 예** (`james_director_router.py`):

- `UploadFile` 읽기 → `james_csv_parser`로 파싱 → `JamesDirectorUseCase`에 위임
- 구현체(`JamesDirectorPgRepository`)를 import하지 않음
- `Depends(get_james_director_use_case)` 로 **포트 타입**만 주입

**나쁜 예:**

- 라우터에서 `session.execute`, bcrypt, CSV 루프, commit
- Interactor 대신 Repository를 직접 호출

### 3.4 Inbound vs Outbound 어댑터 분리

| 종류 | 예 |
|------|-----|
| Inbound | FastAPI router, Pydantic `*Schema`, `james_csv_parser` |
| Outbound | `*_pg_repository.py`, `*_orm.py`, 외부 API 클라이언트 |

파싱·검증은 **라우터 밖** (`james_csv_parser.py`)으로 빼서 라우터를 stateless하게 유지한다.

---

## 4. SOLID (프로젝트 적용)

### 4.1 SRP — 단일 책임

| 클래스 | 책임 하나 |
|--------|-----------|
| `JamesDirectorRouter` | HTTP 입출력 |
| `JamesDirectorInteractor` | CSV 레코드 → Command 변환 + 저장 오케스트레이션 |
| `JamesDirectorPgRepository` | Postgres upsert/delete |
| `james_csv_parser` | 바이트/텍스트 → `TitanicRecordSchema` 리스트 |
| `UserService` (secom) | 회원·로그인·프로필 유스케이스 |
| `CommunityController` (inbody) | HTTP 예외 매핑 + Service 위임 |

**한 파일에 “라우트 + SQL + 비즈니스 규칙”을 섞지 않는다.**

### 4.2 OCP — 개방·폐쇄

- 새 저장소(PG → 다른 DB)는 `*Repository` Port를 구현하는 **새 어댑터** 추가.
- Interactor·Router는 Port 타입에만 의존하므로 수정 최소화.

### 4.3 LSP — 리스코프 치환

- `JamesDirectorInteractor`는 `JamesDirectorUseCase`를 완전히 대체 가능해야 한다.
- Mock/Stub Repository도 Port 계약을 지키면 Interactor 테스트·교체 가능.

### 4.4 ISP — 인터페이스 분리

- Use Case Port는 **해당 액터의 메서드만** (`upload_titanic_file`, `introduce_myself` 등).
- 거대한 `UserRepository` 하나에 모든 메서드를 넣기보다, 도메인별 Port 분리를 **새 코드**에서 우선한다 (레거시 `UserRepository`는 점진적 개선).

### 4.5 DIP — 의존성 역전 (가장 중요)

**규칙:**

1. 고수준(Interactor)은 **추상(Port)** 에만 의존.
2. 저수준(PG Repository)이 Port를 **구현**.
3. 조립은 `dependencies/` 팩토리에서만.

```python
# dependencies/james_director.py — Composition Root
def get_james_director_use_case(
    db: AsyncSession = Depends(get_db),
) -> JamesDirectorUseCase:
    repository: JamesDirectorRepository = JamesDirectorPgRepository(session=db)
    return JamesDirectorInteractor(repository=repository)
```

```python
# router — UseCase Port만 앎
async def upload_titanic_file(
    file: UploadFile = File(...),
    james: JamesDirectorUseCase = Depends(get_james_director_use_case),
):
    return await james.upload_titanic_file(...)
```

**금지:** Router → `JamesDirectorPgRepository` 직접 import.

---

## 5. 디자인 패턴 (코드베이스에서 쓰는 것)

| 패턴 | 위치 | 용도 |
|------|------|------|
| **Repository** | `app/ports/output/*`, `adapter/outbound/pg/*` | 영속성 추상화 |
| **Use Case / Interactor** | `app/use_cases/*_interactor.py` | 애플리케이션 서비스 |
| **DTO / Command** | `app/dtos/*_dto.py` (`PersonCommand`, `BookingCommand`) | 레이어 간 전달 객체 |
| **Adapter** | `adapter/inbound/*`, `adapter/outbound/*` | 외부 세계 ↔ 앱 경계 |
| **Factory (DI)** | `dependencies/*.py`, `inbody/deps.py` | 객체 그래프 조립 |
| **Facade** | `UserService`, `ScheduleAccessService` | 여러 Repository 조율 (secom) |
| **Controller** | `inbody/controllers/*` | HTTP ↔ Service, `HTTPException` 변환 |

**titanic 캐릭터 네이밍:** 각 승객/도메인 객체가 별도 Use Case·Router·Repository를 가진다 (James, Walter, Rose, Smith …). **새 기능 추가 시 동일 패턴 복제**가 학습 목적에 맞다.

---

## 6. FastAPI 관례

### 6.1 진입점

- **단일 앱:** `backend/main.py` — `lifespan`에서 `create_database_tables`, `include_router(inbody_router)`, `include_router(titanic_router)`.
- **titanic 집계:** `titanic/adapter/inbound/api/__init__.py` → `titanic_router`에 v1 라우터들 `include_router`.

### 6.2 라우트 prefix

| 모듈 | prefix 예 |
|------|-----------|
| titanic James | `/titanic/james` |
| titanic Walter | `/titanic/walter` |
| inbody | `inbody/router.py` 내 `/community/...`, `/notices` … |
| secom | **`main.py`에 직접** `/signup`, `/login`, `/mypage`, `/schedule/...` |

> `secom/adapter/inbound/api/v1/login_router.py` 등은 **stub·미연결** 상태일 수 있음. secom API는 `main.py`가 실제 진입점.

### 6.3 의존성 주입

| 제공자 | 위치 |
|--------|------|
| `get_db` | `core.matrix.oracle_database` (SSOT), `core.database` shim |
| `inject_keymaker` | `apps/deps.py` |
| 도메인별 Use Case | `titanic/dependencies/*.py` |
| inbody Controller | `inbody/deps.py` |

```python
# 표준 DB DI
from core.matrix.oracle_database import get_db
# 또는 호환 shim
from core.database import get_db
```

### 6.4 스키마 vs DTO

| 종류 | 위치 | 용도 |
|------|------|------|
| **Pydantic Schema** | `adapter/inbound/api/schemas/` | HTTP 요청·응답, OpenAPI |
| **Command/DTO** | `app/dtos/` | 유스케이스·레포 내부 (프레임워크 무관) |

Interactor는 가능하면 **DTO/Command**를 쓰고, Schema는 라우터 경계에서 변환한다.

### 6.5 Windows / Neon

- `main.py` · `oracle_database.py`: Windows에서 `WindowsSelectorEventLoopPolicy` (psycopg async).
- Neon: `pool_pre_ping=True`, `pool_recycle=1800`, URL에 `sslmode=require` 자동 보강.
- `DATABASE_URL` 없으면 `get_db` → HTTP 503.

---

## 7. 데이터베이스 · ERD 규칙

**SSOT:** `docs/DevOps/Backend/PACE_FULL_ERD.md`

### 7.1 FK 허브

- 대부분의 사용자 데이터는 **`secom_users.id` (int PK)** 에 FK.
- 로그인 문자열은 **`secom_users.user_id` (varchar UK)**.

### 7.2 id vs user_id (혼동 주의)

| 컬럼 | 의미 |
|------|------|
| `secom_users.id` | DB 내부 정수 PK — **inbody FK가 가리키는 값** |
| `secom_users.user_id` | 로그인 ID 문자열 |
| `schedule_access_grants.user_id` | 로그인 **문자열** (DB FK 없음, 앱 로직 연결) |
| `schedule_invite_codes.created_by_user_id` | 코치 로그인 문자열 |

### 7.3 앱 ↔ 테이블 매핑

| 테이블 | 앱 | 비고 |
|--------|-----|------|
| `secom_users`, `user_information`, `schedule_*` | secom | |
| `community_posts`, `community_comments`, `community_post_cheers` | inbody | 댓글 = `community_comments` |
| `today_stories`, `train_daily_logs`, `lessons`, `notices` | inbody | |
| `titanic_person`, `titanic_booking` | titanic | `passenger_id` int PK/FK |

### 7.4 ORM 등록

새 테이블 추가 시 `core/matrix/oracle_database.py`의 `_import_orm_models()`에 import 추가해야 `create_all`에 반영된다.

### 7.5 James CSV 저장 패턴

- `titanic_person`: `passenger_id` (int) PK
- `titanic_booking`: `passenger_id` FK → person
- PG: `insert ... on conflict do update` (upsert), booking은 해당 passenger delete 후 upsert

---

## 8. 앱별 아키텍처 성숙도

| 앱 | 패턴 | 비고 |
|----|------|------|
| **titanic** | 헥사고날 **표준** — Port / Interactor / DI / thin router | 새 백엔드 기능의 **참조 구현** |
| **secom** | 헥사고날 골격 + `UserService` Facade, API는 `main.py` | `ports/` 일부 stub |
| **inbody** | Router → Controller → Service → Repository (전통 3계층) | `secom.UserRepository`로 사용자 조회 |

**새 secom 기능:** 가능하면 titanic식 Port+Interactor+`dependencies/`로 점진 이전.  
**새 inbody 기능:** 기존 Controller/Service/Repository 스타일 유지.  
**새 titanic 캐릭터:** James/Walter 파일 세트 복제 후 이름·도메인만 변경.

---

## 9. 프론트엔드 연동 메모

- API 베이스 URL은 환경에 맞게 설정 (로컬 백엔드 `main.py` 포트 확인).
- titanic Walter: 백엔드는 `GET /titanic/walter/myself` (자기소개 로그). 전체 승객 목록 API는 **별도 구현 전**일 수 있음 — 프론트가 없는 경로를 호출하지 않도록 확인.
- Next.js dev 서버는 `page.tsx` 변경 후 재시작이 필요할 수 있음.

---

## 10. 금지·주의 사항

- `.env`, 비밀키를 규칙 파일·커밋에 넣지 않는다.
- `get_db`를 임의 위치에 중복 정의하지 않는다 — **oracle_database SSOT**.
- 라우터에 SQL·트랜잭션 로직을 넣지 않는다.
- 요청 범위 밖 리팩터링·포맷 전체 수정·관련 없는 앱 수정 금지.
- `docs`에 없는 규칙을 **추측으로 invent** 하지 않는다.
- git commit / push는 **사용자가 명시적으로 요청할 때만**.

---

## 11. 새 기능 체크리스트 (titanic 스타일)

1. [ ] `app/ports/input/*_use_case.py` — ABC 정의
2. [ ] `app/ports/output/*_repository.py` — ABC 정의
3. [ ] `app/dtos/*_dto.py` — Command/Response
4. [ ] `app/use_cases/*_interactor.py` — Port 구현, Repository 생성자 주입
5. [ ] `adapter/outbound/orm/` — 테이블 모델 (필요 시)
6. [ ] `adapter/outbound/pg/*_pg_repository.py` — Repository Port 구현
7. [ ] `adapter/inbound/api/schemas/` — Pydantic
8. [ ] `adapter/inbound/api/v1/*_router.py` — thin router
9. [ ] `dependencies/*.py` — DIP 팩토리
10. [ ] `adapter/inbound/api/__init__.py` — router 등록
11. [ ] `oracle_database._import_orm_models()` — ORM import
12. [ ] 수동 검증: `uvicorn` / `python main.py` → `/docs`에서 엔드포인트 확인

---

## 12. 문서 맵

| 파일 | 역할 |
|------|------|
| **본 파일 `CLAUDE.md`** | 행동 원칙 + 아키텍처 인수인계 (LLM 본문) |
| `AGENTS.md` | Cursor 에이전트 하네스 요약 |
| `.cursorrules` | monorepo 짧은 끈 + docs 필수 |
| `CURSOR.md` | Cursor 도구·워크플로 |
| `docs/DevOps/Backend/PACE_FULL_ERD.md` | Neon 전체 ERD |
| `docs/타이타닉개발/james_fastapi_init.md` | 타이타닉 초기화 참고 (일부 레거시 경로 — 실제는 `main.py` + hexagonal) |

---

## 13. 검증 루프 (작업 마무리)

1. **성공 기준**을 문장으로 고정한다.
2. **최소 diff**로 구현한다.
3. 린트·타입 — **변경한 파일만** 확인.
4. 백엔드: 서버 기동, 해당 `/docs` 엔드포인트 호출.
5. 프론트: 해당 화면 수동 확인 절차를 적어 둔다.
6. 통과할 때까지 2–5만 반복. 넓은 리팩터링은 하지 않는다.

---

## Top-Level Architectural Rules

### 1. Architecture Principles
This project implements PKS (Personal Knowledge System) via Wiki + LLM,
as part of Karpathy's Harness Engineering architecture.

All code must strictly comply with:
- **SOLID** principles
- **Hexagonal Architecture** (Ports & Adapters)
- **Clean Architecture** (Dependency Rule: outer → inner, never reversed)
- **Domain-Driven Design (DDD)**

### 2. Import Path Rules

#### Apps layer (minahai internal modules)
- Omit both the `minahai` prefix and the `apps` segment from all import paths.
- Path starts directly from the module name inside the apps layer.

  ✅ Correct:   `from core.domain.entity import SomeEntity`
  ❌ Incorrect: `from minahai.apps.core.domain.entity import SomeEntity`

#### Core layer
- All core layer imports must begin with `minahai.core.`

  ✅ Correct:   `from minahai.core.domain.entity import SomeEntity`
  ❌ Incorrect: `from core.domain.entity import SomeEntity`

### 3. Communication Style
- Be concise. No unnecessary explanations or filler phrases.
- Use informal/direct tone (반말 수준의 간결한 영어).
- Minimize token usage in every response.

### 4. Enforcement
These rules are non-negotiable and must be applied consistently across:
- All domain models, services, use cases
- All adapters (inbound / outbound)
- All infrastructure implementations
- All test files

Any deviation must be explicitly justified and approved before merging.

---
