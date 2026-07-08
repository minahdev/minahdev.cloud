# minahview — 프론트엔드 규칙

Next.js 프론트엔드 전용 규칙. 전역 행동 원칙은 [루트 CLAUDE.md](../../CLAUDE.md) 참고.

---

## 0. 프로젝트 개요

- **프레임워크:** Next.js 15 (App Router)
- **백엔드:** `minahai/` FastAPI — 로컬 `http://localhost:8000`
- **Docker:** `minahview/Dockerfile`, 포트 3000
- **스타일:** Tailwind CSS + shadcn/ui (`components.json`)

---

## 1. 디렉토리 구조

```
minahview/
├── app/                     # Next.js App Router 페이지
│   ├── layout.tsx           # 루트 레이아웃
│   ├── page.tsx             # 홈 (날씨 + 탭)
│   ├── login/               # 로그인
│   ├── signup/              # 회원가입
│   ├── mypage/              # 마이페이지·프로필
│   ├── schedule/            # 스케줄 접근·관리
│   ├── community/           # 커뮤니티 피드·상세
│   ├── notices/             # 공지사항
│   ├── train/               # 훈련일지
│   ├── calories/            # 식단·칼로리
│   ├── titanic/             # titanic 승객 목록 (학습용)
│   ├── pace-ai/             # Gemini AI 채팅
│   ├── weather/             # 날씨 상세
│   ├── analytics/           # 분석
│   ├── posture/             # 자세 교정
│   └── trend/               # 트렌드
├── components/              # 공통 UI 컴포넌트
├── hooks/                   # Custom React Hooks
├── lib/                     # 유틸리티 함수
└── public/                  # 정적 자산
```

---

## 2. API 연동 규칙

- API 베이스 URL은 환경변수로만: `NEXT_PUBLIC_API_URL`
- 호출 전 **반드시 `/docs`에서 엔드포인트 존재 확인** (없는 경로 호출 금지)
- Next.js dev 서버는 `page.tsx` 변경 후 재시작 필요할 수 있음

### 백엔드 주요 엔드포인트

| 기능 | 메서드 | 경로 |
|------|--------|------|
| 아이디 중복 확인 | GET | `/signup/check-userid?userId=` |
| 회원가입 | POST | `/signup` |
| 로그인 | POST | `/login` |
| 마이페이지 조회 | GET | `/mypage/profile?userId=` |
| 마이페이지 저장 | PUT | `/mypage/profile` |
| 스케줄 접근 상태 | GET | `/schedule/access/status` |
| 스케줄 접근 인증 | POST | `/schedule/access/verify` |
| 스케줄 초대코드 생성 | POST | `/schedule/invites` |
| 스케줄 초대코드 사용 | POST | `/schedule/invites/redeem` |
| 스케줄 멤버 조회 | GET | `/schedule/members?userId=` |
| 커뮤니티 피드 | GET/POST | `/community/posts` |
| 공지사항 | GET | `/notices` |
| 날씨 | GET | `/weather` |
| AI 채팅 | POST | `/chat` |
| titanic 승객 | GET | `/api/titanic/.../` |

---

## 3. 컴포넌트 규칙

- 페이지: `app/` 아래 App Router 관례 (`page.tsx`, `layout.tsx`)
- 공통 UI: `components/` — 아래 주요 컴포넌트 목록 참고
- `"use client"` 최소화 — 서버/클라이언트 경계 명확히
- 요청받지 않은 컴포넌트 추출·리팩터링 금지

### 주요 컴포넌트

| 파일 | 역할 |
|------|------|
| `header.tsx` | 전역 헤더 |
| `bottom-nav.tsx` | 모바일 하단 내비게이션 |
| `home-main-tabs.tsx` | 홈 탭 전환 |
| `require-auth.tsx` | 인증 보호 래퍼 |
| `community-feed-card.tsx` | 커뮤니티 피드 카드 |
| `community-compose-dialog.tsx` | 글쓰기 다이얼로그 |
| `community-comments-dialog.tsx` | 댓글 다이얼로그 |
| `community-post-media.tsx` | 미디어 첨부 |
| `current-weather.tsx` | 날씨 위젯 |
| `gemini-chat.tsx` | AI 채팅 UI |
| `mypage-form.tsx` | 마이페이지 폼 |
| `mypage-tabs.tsx` | 마이페이지 탭 |
| `schedule-access-settings.tsx` | 스케줄 접근 설정 |
| `passenger-list.tsx` | titanic 승객 목록 |
| `diet-meal-tracker.tsx` | 식단 추적 |
| `custom-food-form.tsx` | 음식 입력 폼 |
| `period-lines.tsx` | 기간 시각화 |

---

## 4. 환경변수

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_API_URL` | FastAPI 백엔드 URL (클라이언트 노출 가능) |

- `.env.local` — 로컬 개발용 (커밋 금지)
- Docker 실행 시 `minahview/.env.local` → `docker-compose.yaml`에서 로드

---

## 5. 인증·세션

- 로그인 후 `userId`, `role` 을 클라이언트 상태(또는 localStorage)에 저장
- `require-auth.tsx`로 보호된 페이지 감싸기
- 역할: `user` | `admin` | `coach`
- 백엔드 JWT 없음 — 세션은 클라이언트 상태 기반 (현재 구조)

---

## 6. 금지 사항

- 하드코딩 API URL (`http://localhost:8000/...`) — 환경변수로만
- 존재하지 않는 백엔드 엔드포인트 호출
- 요청 범위 밖 컴포넌트 리팩터링·추출
- git commit/push — 사용자 명시 요청 시에만


## 다크 모드

상세 규칙: [_docs/pace_darkmode_spec.md](_docs/pace_darkmode_spec.md)

- `next-themes` `ThemeProvider` — `attribute="class"`, `defaultTheme="dark"`
- `globals.css`에 `:root` / `.dark` CSS 변수 정의됨 (변경 금지)
- `<html>` 태그에 `suppressHydrationWarning` 필수
- 새 컴포넌트 색상은 CSS 변수(`bg-background`, `text-foreground` 등) 사용
