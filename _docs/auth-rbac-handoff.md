# 로그인·역할(RBAC)·관리자·스케줄 매칭 — 작업 인수인계

> 큰 기능(소셜로그인 게이트 + member/coach/admin RBAC + 코치-회원 매칭 + UI)을 6단계로 나눠 진행 중.
> **Phase 1~5(보안 코어 + 세션 전파 + UI·역할전환) 완료**, Phase 6(테스트) 남음. 다음에 이 문서부터 읽고 이어서.
> ⛔ **아직 런타임 스모크 미완** — 백엔드 도커 재빌드(사용자 승인) + 프론트 빌드/배포 필요 (§5). SESSION_SECRET·ADMIN_EMAILS env 미설정 (§4).

작업 브랜치: `ming` (변경 커밋 안 함 — 사용자 요청 시에만).

---

## 0. 확정된 결정 (변경 금지)

| 항목 | 결정 |
|------|------|
| **보안 범위** | 풀 검증 — 서명 세션 쿠키 + Next 미들웨어 + BFF + FastAPI 3중 검증 |
| **매칭** | 일회용 코드 + 링크 둘 다 → redeem 시 그 코치의 담당 회원으로 링크 |
| **역할 전환** | 가드 있는 전환 (마이페이지 허용 + 코치 하향 시 담당 회원 정리 강제) |
| **역할 값** | DB `role`: `user`(=회원) / `coach` / `admin`. UI는 user↔"회원" 매핑 |
| **admin 판정** | 오직 `ADMIN_EMAILS` allowlist + **검증된 소셜 이메일**로만. 자가승격 불가 |

---

## 1. 아키텍처 (핵심 흐름)

브라우저는 Next 오리진하고만 통신(기존 BFF 구조). 그 위에 **하나의 서명 토큰**을 얹는다:

```
로그인(OAuth/비번) → 서명 세션 쿠키(httpOnly, SESSION_SECRET 서명)
  토큰 payload = {sub: user_id, email, ev: 검증여부, role, exp}
  ├ Next 미들웨어  : 쿠키 검증 → 라우트 보호 + /admin은 role=admin만
  ├ BFF(app/api/*) : 쿠키 검증 → 그 토큰을 X-Pace-Identity 헤더로 백엔드에 전달 (body userId 무시)
  └ FastAPI        : X-Pace-Identity 검증 → 이메일→allowlist/DB로 role **재계산** → 인가
```

- **role은 절대 클라이언트(localStorage/body) 신뢰 안 함.** 매 요청 서버 재계산.
- 같은 서명 토큰이 = 세션 쿠키 = 신원 헤더. 비밀키 `SESSION_SECRET`을 Next↔FastAPI 공유.
- admin은 `ev=true`(소셜 검증)이고 이메일이 allowlist일 때만. 비번 로그인(`ev=false`)은 admin 불가.

---

## 2. ✅ 완료 — Phase 1~5 (보안 코어 + 세션 전파 + UI·역할전환)

### Phase 1~3 — 새로 만든 파일
- `minahai/apps/users/auth/__init__.py`
- `minahai/apps/users/auth/tokens.py` — HMAC-SHA256 서명 토큰 `sign_identity`/`verify_identity` (stdlib, `SESSION_SECRET`)
- `minahai/apps/users/auth/admin_allowlist.py` — `admin_emails`/`is_admin_email`/`resolve_role(email, db_role, email_verified)`
- `minahai/apps/users/auth/current_user.py` — `CurrentUser` + `get_current_user`(X-Pace-Identity 헤더) + `require_admin`/`require_coach_or_admin`/`require_member`/`get_current_user_optional`
- `minahai/apps/users/app/dtos/coach_member_dto.py` — ORM `schedule_coach_members` (member_user_id UK, coach_user_id, linked_at)
- `minahai/scripts/migrate_admin_allowlist.py` — 기존 데이터 정리 (요구사항 4)

### 수정한 파일
- `apps/users/app/dtos/role_dto.py` — `COACH = "coach"` 추가
- `apps/users/oauth/oauth_router.py` — 콜백에서 `resolve_role(profile.email, db_role, email_verified=True)`로 role 결정
- `main.py`:
  - import: `resolve_role`, `CurrentUser`, `get_current_user`
  - `GET /auth/me` 추가 (검증 신원 → {userId,email,role}) — **UI role의 SSOT**
  - `SignupRequest.role: Literal["user","coach"]` (admin 제거) + signup 핸들러 role 강등
  - `POST /login`: `resolve_role(email, role, email_verified=False)` — 비번 로그인은 admin 불가, 저장된 admin 강등
- `apps/users/app/ports/output/schedule_access_repository.py` — `link_coach_member`, `list_members_for_coach` abstractmethod 추가
- `apps/users/adapter/outbound/pg/schedule_pg_access_repository.py` — 위 2개 구현 (upsert 링크 / 코치별 목록 join)
- `apps/users/app/use_cases/schedule_access_interactor.py`:
  - `redeem_invite_code` → 성공 시 `invite.created_by_user_id` 코치로 링크
  - `verify_and_grant` → 암호 설정 코치(`row.updated_by_user_id`)로 링크
  - `list_admitted_members_for_coach` → admin=전체 / coach=담당만 분기
- `core/matrix/database_manager.py` — `_import_orm_models()`에 `coach_member_dto` 등록

### Phase 4 — 세션 전파 (백엔드 identity 전환 + Next 쿠키/미들웨어/BFF) — 백엔드+Next 함께 배포 필수

**백엔드 수정**
- `apps/users/auth/tokens.py` — `SESSION_TTL_SECONDS = 7일` 상수 추가.
- `apps/users/oauth/oauth_router.py` — 콜백이 `sign_identity({sub,email,ev:True,role})` 서명 토큰을 `{FRONTEND_URL}/api/auth/oauth?token=…` 로 302 (기존 `/login/callback?userId&role` 대체).
- `main.py` — 8개 엔드포인트 body/query `userId` 제거 → 신원 기반:
  - `GET/PUT /mypage/profile` → `get_current_user` (PUT은 `req.userId = current_user.user_id`로 본인 고정).
  - `GET /schedule/access/admitted`, `POST /schedule/access/verify`, `POST /schedule/invites/redeem` → `get_current_user`.
  - `POST /schedule/invites`, `PUT /schedule/access/password`, `GET /schedule/members` → `require_coach_or_admin`.
  - 관련 request 모델에서 `userId` 필드 삭제(`ScheduleAccessVerify/Password`, `Redeem`), `ScheduleInviteCreateRequest` 제거(바디 없음).

**Next(minahview) 새 파일**
- `lib/session.ts` — Web Crypto HMAC-SHA256 `signIdentity`/`verifyIdentity` (tokens.py와 **교차 호환 검증됨**). `SESSION_COOKIE="pace_session"`, `sessionCookieOptions()`, `SESSION_TTL_SECONDS`.
- `app/api/auth/oauth/route.ts` — token 검증 후 httpOnly `pace_session` 쿠키 굳히고 `/mypage`로 (Referrer-Policy: no-referrer).
- `app/api/auth/me/route.ts` — 쿠키→백엔드 `/auth/me` 프록시 (**UI role SSOT**).
- `app/api/auth/logout/route.ts` — 쿠키 삭제.
- `components/session-hydrator.tsx` — 앱 로드 시 `/api/auth/me`→localStorage 캐시 1회 동기화 (layout에 삽입).
- `middleware.ts` — matcher `/mypage·/schedule·/settings·/admin`. 쿠키 검증 실패→`/login`, `/admin`은 `role=admin`만.

**Next 수정**
- `lib/backend.ts` — `identityHeaders()`(쿠키→X-Pace-Identity) + `backendFetchAuthed()`.
- `app/api/login/route.ts` — 로그인 성공 시 `signIdentity({sub,ev:false,role})` 쿠키 발급.
- `lib/auth-session.ts` — `hydrateSessionFromServer()`(중복요청 dedupe) 추가, `clearLoggedInUserId()`가 `/api/auth/logout` 호출.
- `components/require-auth.tsx` — 로컬 캐시 비어도 쿠키 확인(hydrate) 후 판정 → OAuth 직후 오탐 리다이렉트 방지.
- BFF 7개(`mypage/profile`, `schedule/access/{admitted,verify,password}`, `schedule/invites`, `schedule/invites/redeem`, `schedule/members`) → `backendFetchAuthed`로 신원 헤더 전달 + userId 요구 제거.

### Phase 5 — 프론트 UI + 역할 전환 백엔드

**백엔드 (헥사고날, 라우터에 SQL 없음)**
- `PUT /mypage/role` (main.py) — 신원 기반 역할 전환. `RoleChangeRequest{role: user|coach}`. admin은 allowlist로만 결정 → 여기서 못 바꿈(응답 role은 `is_admin ? admin : req.role`).
- use case `ScheduleAccessUseCase.change_role` — 코치→회원 하향 시 `count_members_for_coach>0`이면 400("담당 회원 N명 먼저 정리"). 동일 role은 no-op.
- repo 추가: `UserRepository.update_role`(+PG impl), `ScheduleAccessRepository.count_members_for_coach`(+PG impl).

**Next(minahview)**
- `app/api/mypage/role/route.ts` — 백엔드 `/mypage/role` 프록시 + 성공 시 **세션 쿠키 baked role 재발급**(sub·email·ev 유지).
- `lib/auth-session.ts` — `changeMyRole()` (PUT 후 `hydrateSessionFromServer()`로 캐시 갱신).
- `app/signup/page.tsx` — **관리자 탭 삭제**(회원/코치만, grid-cols-2), `SignupRole="user"|"coach"`.
- `components/mypage-form.tsx` — 상단에 **역할 스위처 카드**(회원/코치 토글, admin은 읽기전용 뱃지). role은 `AUTH_SESSION_EVENT`로 리액티브 → `coachView` 반영.
- `components/header.tsx` — 서비스관리 섹션에 role=admin일 때만 "관리자"(→/admin) 노출.
- `app/admin/page.tsx` — `setAuthorized(true)` 스텁·게이팅 제거 → 미들웨어+백엔드 API가 인가 담당(데이터만 로드).
- `components/bottom-nav.tsx` — **중앙 돌출 홈 버튼**(→`/`). 분석 탭은 빼고 `[훈련][스케줄] 홈 [커뮤니티][Pace AI]` (분석은 헤더 '내 활동'에서 접근).

### 검증 상태
- ✅ 전 파일 `py_compile` 통과, 프론트 `tsc --noEmit` 내 파일 클린(기존 `my-posts/page.tsx` 에러 2건은 무관·기존).
- ✅ 순수 로직 테스트 통과: 토큰 round-trip/위변조탐지/만료/시크릿격리, allowlist·resolve_role.
- ✅ **JS↔Python 토큰 교차 호환 검증**: Next서명→백엔드검증, 백엔드서명→Next검증, 위변조·잘못된시크릿 거부 (비ASCII 시크릿·UTF-8 이메일 포함).
- ⛔ **런타임 HTTP 스모크 미완** — 백엔드 소스 빌드(마운트 없음) **재빌드 필요** (§5) + 프론트 빌드/배포. env(§4) 선행.

---

## 3. ⬜ 남은 작업

### Phase 4 — 세션 전파 → ✅ **완료** (§2 참조). 남은 후속만:
- (후속) inbody 엔드포인트(community/train/notices 등)도 아직 body userId 신뢰 → 신원 전환 검토. notices 쓰기=admin 등 role 게이트. **미들웨어 matcher에 아직 미포함**.
- `app/login/callback/` + `callback-client.tsx` — OAuth가 이제 `/api/auth/oauth`로 가므로 **데드 경로**. 삭제 보류(언급만).
- 클라이언트 lib(`mypage-profile.ts`, `pace-schedule-access.ts`)는 여전히 userId 인자를 넘기지만 BFF/백엔드가 **무시**(정상 동작). Phase 5에서 정리 가능.

### Phase 5 — 프론트 UI + 역할 전환 → ✅ **완료** (§2 참조). 남은 후속만:
- 코치→회원 하향은 담당 회원 있으면 **차단만** 함(강제 정리·release UI 없음). 필요 시 코치용 회원 해제 UI + `release_coach_members` 추가.
- 마이페이지 프로필 lib(`mypage-profile.ts`)는 여전히 userId 인자 전달(BFF가 무시). 정리 선택.

### Phase 6 — 테스트 시나리오 (a)~(g)
(a) 네이버/카카오/구글 로그인 · (b) 비로그인 보호기능 차단 · (c) 가입/마이페이지 역할 필수+admin 없음 ·
(d) 내 이메일→admin, 설정 관리자메뉴+/admin 접근 · (e) 회원/코치→관리자메뉴 숨김+/admin 차단 ·
(f) API role=admin 위조 거부 · (g) 하단 중앙 홈 버튼.

---

## 4. 필요한 환경변수 (.env ↔ Vercel 짝 맞추기 — [[backend-auth-gate]])
- `SESSION_SECRET` — **Next와 FastAPI 동일값** (FastAPI 게이트도 이미 사용 중이니 그 값 재사용). 세션쿠키=신원헤더 서명키.
- `ADMIN_EMAILS=minmom7898@gmail.com` — FastAPI(권위). 미들웨어 /admin 재확인용으로 Next에도 선택적.

- 기존 유지: `GOOGLE/KAKAO/NAVER_CLIENT_ID·SECRET`, `FRONTEND_URL`, `OAUTH_CALLBACK_BASE`, `BACKEND_URL`, `BACKEND_USERNAME/PASSWORD`, `API_USERNAME/API_PASSWORD`.
- 변경 후 **백엔드 컨테이너 재생성 필수** ([[backend-auth-gate]]).

---

## 5. 런타임 검증 절차 (Phase 4 배포 시 1회)
> 백엔드 컨테이너는 **소스 빌드(마운트 없음)** → 코드 변경 반영하려면 이미지 재빌드해야 함.
> 재빌드 = 컨테이너 재생성 → **docker 규칙상 사용자 승인 필요** (`minahai/_docs/docker-rules.md`).
> ⚠️ 백엔드 엔드포인트가 이제 신원 필수 → **백엔드+프론트 함께 배포**(§0 SESSION_SECRET 양쪽 동일값 먼저).

1. env 설정: 백엔드 `.env`에 `SESSION_SECRET`, `ADMIN_EMAILS=minmom7898@gmail.com` / Vercel(minahview)에 **동일 `SESSION_SECRET`**.
2. `docker compose up -d --build backend` (승인 후) — `schedule_coach_members` 테이블 자동 생성됨(create_database_tables).
3. 마이그레이션: `docker exec -e ADMIN_EMAILS=minmom7898@gmail.com minah_backend python scripts/migrate_admin_allowlist.py`
4. 프론트: `minahview` 재빌드/배포 (미들웨어·BFF 반영).
5. 백엔드 스모크: 서명 토큰(`X-Pace-Identity`)으로 `GET /auth/me`→200+role, 토큰 없으면 401. `POST /signup` role=admin → 422.
6. E2E 스모크: 구글 로그인→`/api/auth/oauth`가 `pace_session` 쿠키 발급→`/mypage` 진입. 로그아웃 후 `/mypage` 직접 접근→`/login` 리다이렉트(미들웨어). 비-admin으로 `/admin`→`/` 리다이렉트.
> **로컬 dev 주의**: SESSION_SECRET 미설정이면 Next·FastAPI 둘 다 `"changeme"` 기본값이라 로컬은 그대로 동작(양쪽 일치). 프로덕션은 반드시 동일 실비밀값 설정.

---

## 6. 함정 / 주의
- **백엔드 소스 마운트 없음** → 매 백엔드 변경마다 이미지 재빌드 필요. 반복 검증 힘들면 compose에 dev 바인드마운트 추가 검토(→ docker 규칙상 승인).
- **kakao/naver는 이메일 scope 없음** → admin은 **구글 로그인만** 신뢰. 내 이메일이 gmail이라 OK.
- **import 경로**: 실제 동작 코드 관례 = `from core.matrix.database_manager import ...`, `from users....`(bare). (minahai/_docs/CLAUDE.md의 `minahai.core.matrix.oracle_database`는 실제 파일명과 불일치 — 따르지 말 것.)
- **프론트가 쓰는 실엔드포인트는 main.py 인라인**. `users/adapter/inbound/api/v1/*_router.py`들은 미등록 레거시 — 건드리지 말 것.
- 현재 매칭은 password 경로도 링크하지만, 주 경로는 초대코드/링크. `set_password`의 `clear_grants`는 grant만 지우고 링크는 유지(관계는 보존).
