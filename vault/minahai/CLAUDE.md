# minahai — Star Topology & Harness Engineering 규칙

전역 행동 원칙은 [루트 CLAUDE.md](../CLAUDE.md), 백엔드 상세 규칙은 [minahai/_docs/CLAUDE.md](_docs/CLAUDE.md) 참고.

---

## 1. 아키텍처 전환: 모듈러 모놀리식 + 스타 토폴로지

minahai는 **모듈러 모놀리식(Modular Monolith)** 구조다.  
기존 선형 클린 아키텍처(계층 간 단방향 의존) 위에, **비선형 스타 토폴로지(Star Topology)** 레이어가 추가된다.

### 구조 정의

```
                    ┌─────────────┐
                    │  star_craft │  ← HUB (중앙 허브)
                    │  (Hub)      │    컨텍스트 라우팅, 전역 인덱스,
                    └──────┬──────┘    온톨로지 상위 개념 관리
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
       ┌───────┐       ┌───────┐       ┌─────────┐
       │ users │       │inbody │       │ titanic │  ← SPOKES (스포크)
       └───────┘       └───────┘       └─────────┘
```

| 역할 | 앱 | 설명 |
|------|-----|------|
| **Hub** | `star_craft` | 지식 교차점, 컨텍스트 라우팅, 전역 상태/인덱스 |
| **Spoke** | `users` | 회원·스케줄 도메인 |
| **Spoke** | `inbody` | 커뮤니티·훈련일지·공지 도메인 |
| **Spoke** | `titanic` | 학습용 승객 도메인 |

---

## 2. 스타 토폴로지 의존성 규칙

### 허용

```
star_craft → users      (Hub → Spoke: 허용)
star_craft → inbody     (Hub → Spoke: 허용)
star_craft → titanic    (Hub → Spoke: 허용)
spoke      → minahai.core.*  (공통 코어: 허용)
```

### 금지

```
users   → inbody    ❌  (Spoke → Spoke 직통: 금지)
users   → titanic   ❌
inbody  → users     ❌  (기존 예외 있음 — 이전 대상)
inbody  → titanic   ❌
titanic → users     ❌
titanic → inbody    ❌
```

**스포크 간 직접 import는 순환 참조(Circular Dependency)를 유발하고 토폴로지를 파괴한다.**  
스포크가 다른 스포크의 데이터가 필요하면 반드시 `star_craft`를 경유한다.

> **기존 예외**: `inbody`가 `users.UserRepository`를 직접 참조하는 코드가 현재 존재함.  
> star_craft 도입 후 `star_craft`의 UserContext로 이전 대상. 당장 건드리지 않음.

### Import 규칙 요약

```python
# ✅ Hub가 Spoke를 참조
from users.app.ports.input.user_use_case import UserUseCase  # in star_craft

# ✅ Spoke가 Core를 참조
from minahai.core.matrix.oracle_database import get_db  # in any spoke

# ❌ Spoke가 Spoke를 직접 참조
from users.adapter.outbound.pg.user_repository import UserPgRepository  # in inbody — 금지
```

---

## 3. Harness Engineering 적용 원칙

안드레이 카파시의 **하네스 엔지니어링(Harness Engineering)** 개념을 이 토폴로지에 적용한다.  
코드와 지식 구조의 무결성을 자동화 도구로 촘촘히 검증한다.

### 하네스 도구 목록

| 도구 | 파일 | 대상 |
|------|------|------|
| MD 린터 | `/.markdownlint.json` | `_docs/` MD 파일 프론트매터·링크 구조 |
| MD 포매터 | `/.prettierrc` | MD 파일 일관성 |
| Python 의존성 린터 | `/minahai/.importlinter` | Spoke→Spoke 직통 참조 금지 강제 |
| 토폴로지 검증기 | `/scripts/validate_harness.py` | MD 온톨로지 노드 구조 검사 |

### 실행 방법

```bash
# MD 린트
npx markdownlint-cli "**/_docs/**/*.md"

# Python 의존성 검사 (minahai/ 에서)
pip install import-linter && lint-imports

# 토폴로지 유효성 검증
python scripts/validate_harness.py
```

---

## 4. star_craft Hub 개발 원칙

- Hub는 각 Spoke의 **Port(ABC)** 만 알고, 구현체(`*PgRepository`)는 알지 않는다.
- Hub의 역할: 컨텍스트 라우팅, Spoke 간 데이터 중계, 전역 인덱스/상태 관리.
- Hub 자체는 클린 아키텍처(헥사고날) 레이어를 동일하게 따른다 — titanic 참조 구현 기준.
- Hub에 도메인 비즈니스 로직을 넣지 않는다. 오케스트레이션만.
