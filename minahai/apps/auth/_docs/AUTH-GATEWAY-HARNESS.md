# AUTH GATEWAY HARNESS (minahdev.cloud 구조 반영판)

> 강사님 레퍼런스(ragtailor.com·영화명 앱·dreamscape 네트워크 등)를 이 저장소 구조로 리매핑한 버전.
> 아키텍처·의도(RS256 비대칭 키 + 인증 전용 컨테이너 분리)는 동일하게 유지한다.

### 리매핑 표 (강사 → 이 프로젝트)

| 강사 기준 | 이 프로젝트 |
|-----------|-------------|
| `api.ragtailor.com` | `api.minahdev.cloud` (OAUTH_CALLBACK_BASE) |
| `auth.ragtailor.com` | `auth.minahdev.cloud` (신규) |
| 프론트 | `https://minahdev.cloud` (Vercel, FRONTEND_URL) |
| 영화명 앱들 | 실제 앱: `admin`·`comm_agent`·`dumb_and_dumber`·`inbody`·`moneyball`·`spam_filter`·`star_craft`·`titanic`·`users`·`weather` |
| 네트워크 `dreamscape` | compose 기본 네트워크(별도 이름 없음 — 서비스명으로 통신) |
| 터널 `odyssey` | cloudflared 컨테이너 `cf-tunnel` (터널명은 `<터널명>` placeholder) |
| Redis `totem` | `redis` 서비스 / 컨테이너 `minah_redis` (`REDIS_URL`) |
| `core/security.py` | `core/matrix/security.py` |
| `core/dependencies.py` | `core/matrix/dependencies.py` |
| `core.dependencies` (import) | `core.matrix.dependencies` (bare `core.matrix`, `minahai.` 접두어 X) |
| `auth_main.py`(루트) | `minahai/auth_main.py` (`main.py` 옆) |
| `login_gate.py` | 별도 파일 없음 → `main.py` 인라인 게이트(`_AuthMiddleware`·`_LOGIN_HTML`·`/login`) |
| `docker-compose.yml` | `docker-compose.yaml` (레포 루트), backend 서비스 `build: ./minahai` |
| `apps.auth` import | bare `auth` (main.py가 `apps/`를 sys.path에 추가 → `from auth.router import ...`) |

> ⚠️ **이미 있는 인증과의 관계**: 이 저장소는 Phase 1~5에서 **HMAC 대칭키 세션 쿠키**(`apps/users/auth/`의 `tokens.py`·`current_user.py` + Next `lib/session.ts`, `SESSION_SECRET` 공유) 방식 인증을 구현해 두었다. 본 하네스는 그와 **다른 설계**(RS256 비대칭 + JWKS + 인증 전용 컨테이너)다. 두 방식은 공존하거나 후자가 전자를 대체하게 되며, 어느 쪽으로 통합할지는 착수 전 사용자에게 확인한다.

---

## 0. 컨텍스트

- 현재 `minahai/main.py` 하나로 `api.minahdev.cloud`에 배포 중. `minahai/apps/` 하위 앱들이 비즈니스 라우터(헥사고날).
- 목표: 같은 코드베이스에서 엔트리포인트를 분리해 `auth.minahdev.cloud`(인증 전용)와 `api.minahdev.cloud`(비즈니스)를 **별도 컨테이너**로 운영.
- 네트워크: compose 기본 네트워크(서비스명으로 통신), 진입은 cloudflared 터널만. 호스트 포트 미노출(신규 서비스 기준 — 아래 규칙 참고).
- 키 체계: RS256 비대칭. 개인키는 auth 컨테이너에만 존재.

---

## 1. 절대 규칙 (위반 시 작업 중단 후 보고)

- `minahai/apps/` 하위 **기존 앱 코드는 한 줄도 수정하지 않는다** (users·inbody·titanic·star_craft·moneyball·admin·comm_agent·spam_filter·dumb_and_dumber·weather).
- **새로 추가하는** auth·backend 분리 서비스에 `docker-compose.yaml`의 `ports:` 매핑을 추가하지 않는다.
  - ⚠️ 이 프로젝트 특이사항: 현 compose는 backend(`8000:8000`)·redis·adminer 등에 이미 `ports`가 열려 있다(기존). 이 규칙은 **신규 분리 서비스**에 적용한다. 기존 포트 노출 제거 여부는 별도 판단(사용자 확인).
- JWT 검증부의 허용 알고리즘은 `algorithms=["RS256"]` 리터럴로 하드코딩한다. 환경변수·설정으로 빼지 않는다.
- 개인키(`JWT_PRIVATE_KEY`)를 읽는 코드는 **발급 함수에만** 존재해야 한다. 검증 경로에서 개인키 참조 발견 시 즉시 수정.
- 비밀키·개인키를 저장소에 커밋하지 않는다. `minahai/.env.*`는 `.gitignore`에 추가.
- 기존 앱들이 `auth`를 import하는 코드를 작성하지 않는다. 백엔드가 쓸 수 있는 것은 `core.matrix.dependencies`뿐.

---

## 2. 작업 목록

### 2.1 `minahai/apps/auth/` 신규 생성

```
minahai/apps/auth/
├── __init__.py
├── router.py      # POST /login, POST /logout, POST /refresh, GET /callback/{provider}, GET /.well-known/jwks.json
├── services.py    # OAuth Provider 연동(Google, Kakao, Naver), 토큰 발급 오케스트레이션
├── schemas.py     # TokenResponse, LoginRequest, RefreshRequest 등 Pydantic 스키마
└── rbac.py        # Role(str, Enum), Permission 정의, role→permission 매핑 테이블
```
- `router.py`의 엔드포인트는 위 5개로 시작. 회원가입 등은 이번 범위 밖.
- `/.well-known/jwks.json`은 공개키를 JWK 형식(kid 포함)으로 반환. 백엔드/외부 검증자가 사용.
- 리프레시 토큰: Redis(`REDIS_URL`, 서비스 `redis`) 저장, 로테이션 방식. 재사용 감지 시 해당 사용자 세션 전체 폐기.
- Role 값은 이 프로젝트 기준 `user`(=회원)·`coach`·`admin`으로 맞춘다(기존 RBAC와 일치).

### 2.2 `core/matrix/security.py` 신규 (강사판 `core/security.py`)

```python
# 발급부 — auth 컨테이너 전용 (JWT_PRIVATE_KEY 필요)
def create_access_token(sub: str, roles: list[str], aud: str, expires_min: int = 10) -> str: ...
def create_refresh_token(sub: str) -> str: ...

# 검증부 — 모든 컨테이너 공용 (JWT_PUBLIC_KEY만 필요)
def verify_token(token: str, aud: str) -> TokenPayload: ...
    # jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"], audience=aud)

# 쿠키 설정 — auth 발급 시 사용
COOKIE_KWARGS = dict(
    domain=".minahdev.cloud", secure=True, httponly=True, samesite="lax",
)

# 해싱 — auth 전용
def hash_password(raw: str) -> str: ...      # bcrypt (기존 코드가 bcrypt 사용 중)
def verify_password(raw: str, hashed: str) -> bool: ...
```
- 발급 함수는 모듈 로드 시점이 아니라 **호출 시점**에 `JWT_PRIVATE_KEY`를 읽는다. 백엔드 컨테이너에서 모듈 import만으로 키 부재 에러가 나면 안 된다.
- access token 클레임: `sub`, `roles`, `aud`, `exp`, `iat`, `jti`, `kid`(헤더).
- `aud`는 이 프로젝트 단일 백엔드 기준 `minahdev-api` (강사 예시는 멀티 서비스라 여러 aud였음). 교차 사용 불가.

### 2.3 `core/matrix/dependencies.py` 신규 (강사판 `core/dependencies.py`)

```python
async def get_current_user(request: Request) -> TokenPayload: ...
    # 쿠키 또는 Authorization 헤더에서 토큰 추출 → verify_token(aud=settings.SERVICE_AUD)

class RoleChecker:
    def __init__(self, *allowed: Role): ...
    def __call__(self, user: TokenPayload = Depends(get_current_user)): ...
        # roles 클레임 검사, 미충족 시 403
```
- Redis 블랙리스트 조회(`jti` 기준)를 `get_current_user`에 포함 — 즉시 차단 계정 처리용.
- ⚠️ 기존 `apps/users/auth/current_user.py`에도 `get_current_user`(HMAC 헤더 기반)가 있다. 이름 충돌·역할 분담을 착수 전에 정리(둘 중 무엇을 SSOT로 둘지 확인).

### 2.4 `minahai/auth_main.py` 신규 생성 (`main.py` 옆)

- 기존 `main.py` 인라인 게이트(`_AuthMiddleware`·`_LOGIN_HTML`·`/login`·`/logout`)는 **삭제하지 말고 그대로 둔다**. 신규 파일 작성 후, 동작 검증 완료 시점에 별도 커밋으로 인라인 게이트 제거 여부를 사용자에게 확인받는다.

```python
from fastapi import FastAPI
from auth.router import router as auth_router   # apps/가 sys.path에 있어 bare import

app = FastAPI(
    title="Minahdev Auth",
    docs_url=None, redoc_url=None, openapi_url=None,  # 실서비스: 문서 비노출
)
app.include_router(auth_router, prefix="/auth")

@app.get("/healthz")
async def healthz(): return {"ok": True}
```

### 2.5 `minahai/main.py` 확인 (수정 최소화)

- 기존 앱 라우터 include 구성 유지. `auth` include가 없는지 **확인만** 한다.
- 보호가 필요한 라우터에 `dependencies=[Depends(RoleChecker(Role.USER))]` 적용은 이번 범위에서 **예시 1개 앱에만** 적용해 패턴을 보인다 (대상 앱은 사용자에게 질문).

### 2.6 `docker-compose.yaml` 서비스 추가 (레포 루트)

```yaml
  auth:
    container_name: minah_auth
    build:
      context: ./minahai
    command: uvicorn auth_main:app --host 0.0.0.0 --port 9000
    env_file:
      - ./minahai/.env.auth        # JWT_PRIVATE_KEY, OAuth client secrets
    restart: unless-stopped
```
- 기존 backend 서비스의 `env_file`을 `./minahai/.env.backend`로 분리 (`JWT_PUBLIC_KEY`만 포함).
- 두 서비스 모두 신규 `ports:` 없음 유지(§1 규칙).
- 네트워크는 compose 기본 네트워크를 그대로 사용 → cloudflared(`cf-tunnel`)·backend·auth가 서비스명으로 통신.

### 2.7 키 생성 스크립트 `minahai/scripts/generate_jwt_keys.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
openssl genrsa -out jwt_private.pem 2048
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
echo "jwt_private.pem → minahai/.env.auth 의 JWT_PRIVATE_KEY 로"
echo "jwt_public.pem  → minahai/.env.backend 의 JWT_PUBLIC_KEY 로"
```
- PEM 파일은 `.gitignore`에 추가. 멀티라인 환경변수 주입 방식(예: base64 인코딩 후 디코드)을 config에서 처리.

### 2.8 cloudflared ingress (코드 저장소 밖, 지시만 출력)

```yaml
ingress:
  - hostname: auth.minahdev.cloud
    service: http://auth:9000
  - hostname: api.minahdev.cloud
    service: http://backend:8000
  - service: http_status:404
```

```bash
cloudflared tunnel route dns <터널명> auth.minahdev.cloud
```
- 실제 프로덕션 터널명은 저장소에 없음(러닝 컨테이너 `cf-tunnel`, Cloudflare 대시보드 관리) → `<터널명>` 확인 필요.
- 이 항목은 코드 변경이 아니므로 작업 완료 보고서에 "수동 적용 필요" 섹션으로 출력한다.

### 2.9 `minahai/.importlinter` contract 추가

> 기존 파일 스타일(`root_package = minahai`, 모듈은 `apps.<name>` 표기)에 맞춘다.

```ini
[importlinter:contract:auth-isolation]
name = apps.auth is only imported by auth_main
type = forbidden
source_modules =
    apps.admin
    apps.comm_agent
    apps.dumb_and_dumber
    apps.inbody
    apps.moneyball
    apps.spam_filter
    apps.star_craft
    apps.titanic
    apps.users
    apps.weather
forbidden_modules =
    apps.auth
```
- 실제 앱 목록은 `minahai/apps/` 를 읽어 반영함(위가 현재 기준). 기존 `.importlinter`가 참조하는 `apps.secom`은 stale(현재는 `apps.users`) — 정리 시 함께 확인.

---

## 3. 완료 기준 (Acceptance Criteria)

- [x] `uvicorn auth_main:app` 단독 기동 성공, `/healthz` 200. — `minah_auth` 컨테이너 기동, `{"ok":true}` 확인.
- [x] `uvicorn main:app` 기동 시 `JWT_PRIVATE_KEY` 없이 정상 동작 (import 에러 없음). — `security.py` 키 lazy read, 검증됨.
- [x] auth에서 발급한 토큰을 `verify_token`이 공개키만으로 검증 통과. — PyJWT 실검증 통과.
- [x] `aud`가 다른 토큰은 검증 실패하는 테스트 존재. — `test_aud_mismatch_rejected`.
- [x] 만료·서명변조·`alg=none`·`HS256` 강제 토큰 각각 거부 테스트 존재. — `test_security.py` 통과.
- [x] 리프레시 토큰 재사용 시 세션 전체 폐기. — 실 Redis + `POST /auth/refresh` E2E 통과(§3.6).
- [x] `lint-imports` 통과. — `cd minahai && PYTHONPATH=apps lint-imports` → **5 kept, 0 broken**(§3.6).
- [~] pytest 전체 통과. — 수집되는 테스트 **40개 전부 통과**(auth 9 포함). titanic 테스트 3개는
  기존 순환 import로 **수집 자체가 실패**(본 작업과 무관, §3.6).

---

## 3.5 실행 상태 (2026-07-22 — 구조 §2.1~2.9 구현 완료)

**생성/수정 파일**
- 신규: `apps/auth/{__init__,rbac,schemas,services,router}.py`, `apps/auth/tests/test_security.py`, `core/matrix/{security,token_store,dependencies}.py`, `auth_main.py`, `scripts/generate_jwt_keys.sh`, `.env.auth.example`.
- 수정: `requirements.txt`(+PyJWT[crypto]), `.importlinter`(+auth-isolation), 루트 `.gitignore`(+.env.auth/.env.backend/*.pem), `docker-compose.yaml`(+auth 서비스), 루트 `AUTH-GATEWAY-HARNESS.md`.
- **main.py 무변경** — RS256 게이트는 `auth_main`로 분리, main엔 미포함(§2.5 RoleChecker 예시는 컷오버 후로 보류).

**검증됨(로컬 PyJWT)**: 발급→검증, aud불일치·만료·변조·HS256·alg=none 거부, refresh typ, JWKS(kid+RSA), bcrypt, 키 없이 lazy import. `pytest apps/auth/tests` 9 passed. 전 백엔드 파일 py_compile 통과.

**이 프로젝트 적용상 조정(강사판과 다른 점)**
- env 분리: backend를 `.env.backend`로 통째 대체하면 DB/Redis/OAuth 다 빠져 깨짐 → **공유 `.env`에 공개키·kid·aud '추가'**, `.env.auth`엔 개인키만. backend 서비스 `env_file` 무변경.
- 토큰 블랙리스트 원시함수는 core-purity 위해 `core/matrix/token_store.py`로 분리(services는 이를 재사용).
- `RoleChecker`는 `Role`을 import하지 않음(core→apps 금지) — str Enum 값으로 전달받음.
- OAuth 개시(`GET /login/{provider}`)를 콜백과 함께 둠(문서 5개는 "시작점", 개시 없으면 플로우 불성립).

**남은 런타임 작업**: env 채우기(키생성 `scripts/generate_jwt_keys.sh`) → `docker compose up -d --build auth backend`(승인) → `/healthz`·JWKS·로그인·refresh 재사용 폐기 E2E → cloudflared ingress(§2.8, 수동) → `lint-imports` 실행.

---

## 3.6 런타임 검증 완료 (2026-07-22)

**키·env**: `scripts/generate_jwt_keys.sh .` → `minahai/jwt_{private,public}.pem`(키쌍 매칭 확인).
`.env.auth`(perm 600) = `JWT_PRIVATE_KEY`만. 공유 `.env`에 `JWT_PUBLIC_KEY`·`JWT_KID=minahdev-auth-1`·
`SERVICE_AUD=minahdev-api`·`AUTH_CALLBACK_BASE` 추가(원본은 `.env.bak-*` 백업). 셋 다 gitignore 확인.

**기동**: `docker compose build auth` → `up -d auth`. `minah_auth` Up, 에러 로그 없음.

**검증 통과**
- `GET /healthz` → 200 `{"ok":true}`
- `GET /auth/.well-known/jwks.json` → `kty=RSA use=sig alg=RS256 kid=minahdev-auth-1`
- `GET /docs` → 404 (실서비스 문서 비노출 의도대로)
- refresh E2E(실 Redis): 1차 로테이션 200·새 토큰 발급 → 구 refresh 재사용 401 → **`auth:rt:{sub}:*` 키 0개(전 세션 폐기)** → 폐기 후 최신 refresh도 401
- logout: 무토큰 401 / 유효 access 200 / 블랙리스트된 access 재사용 401

**공개 URL 검증 완료(터널 경유, 풀스택 기동 후)**
- `https://auth.minahdev.cloud/healthz` → **200** `{"ok":true}`
- `https://auth.minahdev.cloud/auth/.well-known/jwks.json` → 공개키 노출(내부 응답과 modulus 동일 = 같은 키)
- `/auth/refresh`·`/auth/logout` 토큰 없이 → 401
- `/auth/login/google` → 302 accounts.google.com, `redirect_uri=https://auth.minahdev.cloud/auth/callback/google`
  ⚠️ 이 값이 provider 콘솔에 등록돼 있어야 콜백이 성립(기존 `api.` 기준만 등록돼 있으면 추가 필요)
- `/docs` → 404 (문서 비노출 유지)
- `https://api.minahdev.cloud/` → 401 = `main.py` 인라인 Basic 게이트 정상 동작(별개 계층)

**cloudflared — §2.8 대체(실측)**: 이 프로젝트 터널은 `TUNNEL_TOKEN` **대시보드 관리형**이라 로컬
`config.yml`이 없고 `cloudflared tunnel route dns`도 쓰지 않는다. 기존 3개 룰은 전부
`http://172.17.0.1:<호스트포트>`(호스트 게이트웨이)로 나감 — cf-tunnel이 compose 네트워크 밖(`bridge`)이었기 때문.
→ `docker network connect minahdevcloud_default cf-tunnel` 로 해결(bridge 연결 유지, 기존 경로 무영향, 검증됨).
남은 건 대시보드 **"+ 경로 추가"** → `auth.minahdev.cloud` → HTTP `auth:9000`. §1 ports 금지 규칙 유지됨.

**pytest 전체 회귀**(컨테이너 `/app`, `pytest -q`): 수집된 **40개 전부 통과**.
단 titanic 테스트 3개는 수집 단계에서 ImportError — `adapter/inbound/api/__init__.py`가 v1 라우터 전체를
import하고, 그 라우터가 `dependencies/*_provider.py`를 거쳐 다시 use_case를 import하는 **순환 구조**
(+ `titanic.domain.value_objects`에 `PassengerId` 없음). 셋 다 working tree 무변경 = **기존 문제**.
`--ignore` 대상: `tests/app/use_cases/`, `tests/adapter/outbound/mappers/test_passenger_jack_trainer_mapper.py`.

**`.importlinter` 수정 — 실행: `cd minahai && PYTHONPATH=apps lint-imports` → 726파일·2004의존, 5 kept / 0 broken.**

원래 파일은 `root_package = minahai` + contract는 `apps.*` 참조라 `Module 'apps.comm_agent' does not exist`로
**전 contract가 실행 자체를 못 했다**(exit 1). `apps.secom`도 stale(현재 `apps.users`). 고친 내용:

| 항목 | 변경 | 이유 |
|------|------|------|
| `root_packages` | `apps`/`minahai` → **bare 앱명 11개 + `core`** | 런타임 import가 bare(`from users...`)라 `apps.` 접두사로는 앱 간 의존이 **하나도 그래프에 안 잡힘**(78 vs 2004 dependencies) |
| 전 contract 모듈명 | `apps.X` → `X`, `apps.secom` → `users` | 위와 동일 + stale 정리 |
| CONTRACT 2 | `ignore_imports`에 `core.matrix.database_manager -> {users,inbody,titanic}.**` | `_import_orm_models()`의 앱 ORM/DTO import는 **설계**(minahai/CLAUDE.md §4) |
| CONTRACT 1 | 같은 ignore 3줄 추가 | inbody→titanic이 위 ORM 허브 **경유 간접 경로**로만 잡혔음 |
| CONTRACT 3·4 | `allow_indirect_imports = True` | 두 계약 주석이 원래 "**직접** 참조 금지". 4번은 router→`dependencies/*_provider`→PgRepository, 즉 **Composition Root 패턴**(CLAUDE.md 권장)이 간접으로 걸린 것 |
| CONTRACT 5 | 완화 없음 | 격리가 목적이라 간접까지 금지 유지 |

**비어있는 계약 아님을 확인**: 일부러 깨지는 sanity 계약(`users -/-> core`, `auth -/-> users`) 2개가
정상적으로 BROKEN → 그래프에 앱 간 의존·`auth` 모듈이 실제로 잡혀 있음. 즉 auth-isolation KEPT는 유효한 결과.

---

## 4. 진행 방식

1. 착수 전 `minahai/apps/`, `minahai/core/matrix/`, `minahai/main.py`(인라인 게이트), 그리고 **기존 HMAC 세션 인증**(`apps/users/auth/`, Next `lib/session.ts`) 현재 상태를 읽고 요약 보고 후 시작.
2. 커밋 단위: 2.1 → 2.2 → 2.3 → (2.4+2.5) → (2.6+2.7) → 2.9 순으로 기능별 분리 커밋.
3. 기존 `apps/users/auth/tokens.py`의 HMAC 발급/검증(대칭키 세션)은 삭제하지 말고, RS256 게이트와의 통합 방향을 보고 — 마이그레이션 판단은 사용자 몫.
4. 불명확한 지점(기존 `secom_users` 스키마·`role` 컬럼, Redis 키 네임스페이스, OAuth provider 우선순위, HMAC↔RS256 통합 방향)은 추측하지 말고 질문한다.
