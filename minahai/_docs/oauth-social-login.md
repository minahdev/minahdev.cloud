# 소셜 로그인 (네이버 · 카카오 · 구글) 설정

프론트 로그인 화면의 소셜 버튼 → 백엔드 `/auth/{provider}/login` → provider 인증 →
`/auth/{provider}/callback` → `secom_users` upsert → 프론트 `/login/callback?userId&role` 로 복귀.

- 소셜 유저는 `secom_users.user_id = "{provider}_{uid}"`, `password_hash = "!oauth-no-password"`(비번 로그인 불가)로 저장. **마이그레이션 없음.**
- `_AuthMiddleware`(개발자 게이트)는 `/auth/*`를 통과시킨다.

---

## 1. 백엔드 환경변수 (`api.minahdev.cloud`)

| 키 | 예시 | 비고 |
|----|------|------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | … | Google Cloud Console → OAuth 2.0 클라이언트 |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | … | Kakao Developers → REST API 키 / 보안 client_secret |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | … | Naver Developers → 애플리케이션 |
| `FRONTEND_URL` | `https://minahdev.cloud` | 로그인 후 돌아갈 프론트 (기본 `http://localhost:3000`) |
| `OAUTH_CALLBACK_BASE` | `https://api.minahdev.cloud` | (선택) redirect_uri 베이스. 미설정 시 요청 URL에서 유추 |

> client_id가 없는 provider의 버튼을 누르면 `/login?error=provider_not_configured`로 되돌아온다(안전).

## 2. 프론트 환경변수 (`minahdev.cloud`)

| 키 | 예시 | 비고 |
|----|------|------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://api.minahdev.cloud` | 소셜 버튼이 가리키는 백엔드. **빌드타임 필요** (기본 `http://127.0.0.1:8000`) |

## 3. 각 provider 콘솔에 등록할 Redirect URI

`OAUTH_CALLBACK_BASE`(또는 실제 백엔드 URL) 기준:

```
https://api.minahdev.cloud/auth/google/callback
https://api.minahdev.cloud/auth/kakao/callback
https://api.minahdev.cloud/auth/naver/callback
```

로컬 개발용도 함께 등록:

```
http://localhost:8000/auth/google/callback
http://localhost:8000/auth/kakao/callback
http://localhost:8000/auth/naver/callback
```

- **Google**: scope `openid email profile` (기본 설정됨).
- **Kakao**: 동의항목에서 `account_email`, `profile_nickname` 활성화. client_secret 사용 안 하면 빈 값으로 둬도 됨.
- **Naver**: 네이버는 `state` 필수 — 이미 코드에서 처리(쿠키 대조).

## 4. 로컬 테스트

```bash
# 백엔드
uvicorn main:app --reload            # :8000
# 프론트
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npm run dev   # :3000
```

1. 우측 상단 **로그인** → `/login`
2. **네이버/카카오/구글** 버튼 → provider 로그인 → `/login/callback` → `/mypage`
3. uvicorn 로그에 `[oauth] 로그인 provider=… user_id=…` 확인.
