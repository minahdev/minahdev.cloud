# 온보딩 설문 + 마이페이지 개선 — 인수인계

작성 2026-07-22. 갱신 2026-07-23 — **백엔드·프론트 구현 완료 / 브라우저 수동 테스트만 남음**.

---

## 확정된 결정 (사용자 승인)

| 항목 | 결정 |
|---|---|
| 연락처 | **선택 입력 유지** (필수 아님, 건너뛰기 가능) |
| 마이페이지 수정 | **전체 수정 가능** — 건강 특이사항 포함 모든 항목 |
| 민감정보 저장 | **앱 레벨 AES-256-GCM**, 단 **지금은 키 없이 평문으로 시작** |
| 스키마 | **기존 `user_information` 에 컬럼 추가** |

### 키를 지금 만들지 않는 이유
학원 PC라 나중에 장비를 옮겨야 함. `PROFILE_ENC_KEY` 는 잃으면 **복구 불가**한 유일한 비밀
(JWT 키·터널 토큰·OAuth 시크릿은 전부 재발급 가능). 현재 건강정보 **0건**이라 지금 켤 이득이 없다.
→ 운영 서버 이전 후 키 생성 + `rotate_profile_key.py --to <키>` 로 기존 평문을 일괄 암호화.

---

## 1. 완료된 것 (백엔드)

### 신규
- **`core/matrix/field_crypto.py`** — AES-256-GCM. 저장값에 `enc:v1:` 접두사를 붙여
  평문·암호문이 한 컬럼에 섞여 있어도 읽힌다. 키 없으면 평문 저장.
  복호화 실패 시 예외 대신 **빈 문자열** 반환(앱이 죽지 않음).
- **`scripts/migrate_profile_survey.py`** — `ADD COLUMN IF NOT EXISTS` 2개. 멱등.
- **`scripts/rotate_profile_key.py`** — 키 도입/교체/해제. `--new-key`로 키만 발급,
  `--to <키>`로 전 행 재암호화, `--to ""`로 평문 복귀, `--from`으로 읽기 키 지정.

### 수정
- `apps/users/app/dtos/user_information_dto.py` — `favorite_exercises`(text, CSV),
  `health_flags`(text, 암호화) 컬럼 추가
- `apps/users/app/labels.py` — `HEALTH_FLAG_LABELS` + `health_flag_to_label()`
  (`none`/`diabetes`/`pregnant`/`medication`/`smoking`/`drinking`)
- `apps/users/adapter/inbound/api/schemas/mypage_schema.py`
  - `phone` 필수 해제 (`min_length=1` 제거, 기본값 `""`)
  - `nickname`, `favoriteExercises: list[str]`, `healthFlags: list[str]` 추가
  - 응답에 `healthFlagLabels`, `healthUnreadable`(복호화 실패 표시) 추가
- `apps/users/adapter/outbound/pg/user_pg_information_repository.py`
  - 저장 시 암호화 / 조회 시 복호화
  - **닉네임 SSOT는 `secom_users.nickname`** — 새 컬럼 안 만들고 여기에 동기화
  - `favorite_exercise`(기존 단일 컬럼)에 복수선택 첫 항목을 계속 채워 하위호환 유지
  - `health_flags`에 `none`이 오면 나머지를 버림(배타 선택)

### 검증됨
- 전 파일 `py_compile` 통과
- `field_crypto` 왕복: 키없음→평문 / 키있음→`enc:v1:` / 평문 passthrough / 키틀림→`''`
- 컨테이너에 `cryptography 49.0.0` 존재 (PyJWT[crypto]가 끌어옴, **requirements 추가 불필요**)

### 2026-07-23 추가 완료
- **마이그레이션 실행됨** — `favorite_exercises`, `health_flags` 컬럼 확인
- **backend·auth 컨테이너 재빌드·재생성 완료**
- 포트 시그니처 문제 없었음 (`MyPageInteractor`는 스키마를 그대로 통과시킴 — 수정 불필요)
- **API 왕복 검증 완료** (임시 계정 `__survey_test` 생성 → 검증 → 삭제)
  - PUT/GET 새 필드 왕복 OK, `nickname`이 `secom_users.nickname`에 동기화됨
  - `healthFlags: ["none","smoking"]` → `["none"]` 로 배타 처리됨
  - `phone` 미입력 저장 OK (DB에 NULL)
  - `health_flags`는 키가 없어 **평문 저장** 확인 (`diabetes,medication`)

---

## 2. 프론트 (2026-07-23 완료)

### 2.1 `lib/mypage-profile.ts`
- `favoriteExercise: FavoriteExercise` → `favoriteExercises: FavoriteExercise[]`
- `nickname`, `healthFlags: HealthFlag[]`, `healthUnreadable` 추가
- `HEALTH_FLAG_OPTIONS` 상수 (백엔드 `HEALTH_FLAG_LABELS`와 코드 일치시킬 것)
- `saveMyPageProfileToApi` 페이로드에 새 필드 반영

### 2.2 `components/wheel-picker.tsx` (신규)
년/월/일 3열 드래그 스크롤. `scroll-snap-type: y mandatory` + 스크롤 위치로 중앙값 계산.
외부 라이브러리 없이. 범위 1920~올해. **월 길이에 따라 일수 자동 조정**(2월 29일 등).

### 2.3 `components/mypage-onboarding.tsx` (대폭 수정)
- **자동 진행 전부 제거** — `autoAdvance` 필드와 `onPick` 안의 `advance()` 호출 삭제.
  선택해도 안 넘어가고 `[다음]` 눌러야 함
- 필수 미입력 시 `[다음]` **비활성** + 안내 문구
- **"한 번에 입력하기" 링크 제거** (`onUseFullForm` prop 및 `mypage-form.tsx`의
  `skipWizard` state까지 같이 제거)
- 단계 재구성 (11단계):
  ```
  1 이름   2 닉네임★신규   3 성별   4 생년월일★휠피커
  5 연락처★선택(건너뛰기)  6 키   7 몸무게
  8 자주 하는 운동★복수선택  9 운동 경력  10 주간 목표
  11 Pace가 알아야 할 점★신규
  ```
- 11단계: 체크 복수선택 + `기타` 자유입력 + `해당 없음`(배타).
  아무것도 안 고르면 진행 차단 — "해당 없으면 '해당 없음'을 선택해 주세요"

### 2.4 `components/mypage-form.tsx`
- 조회 화면에 닉네임·복수 운동·건강 특이사항 표시
- 수정 폼에 동일 항목 추가 (연락처 선택 처리 포함)
- 건강 특이사항은 접힘 기본 + "민감정보라 본인만 볼 수 있어요"
- `healthUnreadable`이면 "읽을 수 없음" 표시

---

### 예정에 없던 연쇄 수정
`MyPageProfile.favoriteExercise` → `favoriteExercises` 로 바뀌면서 소비자 2곳이 깨져 같이 고침.
- `lib/pace-today-workout-prompt.ts` — 프롬프트는 전체 목록, 규칙 기반 fallback은 **첫 종목** 기준
- `components/today-workout-recommendation.tsx` — 헤더 라벨을 복수 표기로

`healthFlags`는 Gemini 프롬프트에 **넣지 않았다** (민감정보 외부 전송이라 별도 판단 필요).

---

## 3. 재개 순서 — 전부 완료 (2026-07-23)

```
1. python scripts/migrate_profile_survey.py      ✅ 컬럼 2개 확인
2. 프론트 2.1~2.4 구현                            ✅ npx tsc --noEmit 내 파일 에러 0
3. docker compose up -d --build backend auth      ✅ PUT·GET 왕복 확인
4. DB 직접 조회                                    ✅ health_flags 평문 저장 확인
```

추가로, 이 작업과 무관하게 남아 있던 `app/settings/my-posts/page.tsx` 타입 에러 2건도 정리했다.
`toggleCommunityCheer`가 인자 1개로 바뀐 것과 `CommunityCommentsDialog`에 `loggedInId`·`onCommentAdded`가
필수로 추가된 것을 이 페이지만 못 따라간 상태였다(`app/community/page.tsx` 사용법에 맞춤).
→ **현재 `npx tsc --noEmit` 에러 0, `next build` 성공.**

## 4. 테스트 시나리오 — 브라우저에서 직접 확인 필요 (남은 일)

프로필이 없는 계정으로 `/mypage` 진입 → 설문 마법사가 뜬다.

- (a) 이름 → 닉네임 순서로 입력되는지
- (b) 생년월일이 휠 피커로 선택되는지
- (c) 선택해도 자동 진행 안 되고 `[다음]` 눌러야 넘어가는지
- (d) 운동 문항이 복수 선택되는지
- (e) 건강 특이사항 체크 + 직접입력 되는지
- (f) 온보딩 응답이 마이페이지에 그대로 보이는지
- (g) 연락처 미입력해도 진행·저장되는지

## 5. 미결

- **코치/관리자 조회 API 없음.** 현재 `/mypage/profile`은 신원 기반으로 **본인만** 접근 가능
  (클라이언트 userId 무시). 요구사항의 "본인과 담당 코치/관리자만"에서 코치 부분은 미구현.
  더 엄격한 쪽이라 보안 문제는 아니지만, 코치가 봐야 한다면 별도 작업 필요.
- 암호화 컬럼은 SQL 검색·집계 불가 (키 도입 후). "당뇨 회원 수" 같은 통계는 못 냄.
