# React 코딩 규칙 (Pace Frontend)

## useState 사용

- **useState는 많이 쓰지 않는다.** 필드마다 `useState`를 두지 않는다.
- 폼 입력값은 가능하면 **비제어(uncontrolled) + `FormData`** 로 처리한다.
- 꼭 필요한 UI 상태(`submitting`, `error` 등)만 **하나의 객체**로 묶어 `useState` 한 번만 쓴다.

## 폼 제출 패턴 (권장)

```tsx
type FormUiState = {
  submitting: boolean
  error: string | null
}

const [state, setState] = useState<FormUiState>({
  submitting: false,
  error: null,
})

const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  setState((prev) => ({ ...prev, error: null, submitting: true }))

  const formData = new FormData(e.currentTarget)
  const entries = Object.fromEntries(formData.entries())
  const formProps = {
    userId: String(entries.userId ?? "").trim(),
    password: String(entries.password ?? ""),
    email: String(entries.email ?? "").trim(),
    nickname: String(entries.nickname ?? "").trim(),
  }

  // fetch …
  // 실패 시: setState((prev) => ({ ...prev, submitting: false, error: "…" }))
}
```

- `<input>`에는 `name`만 맞추고, `value` / `onChange`로 필드 state를 두지 않는다.
- 제출 시점에만 `FormData`로 값을 읽는다.

## 알림·피드백 (alert 금지)

- **`window.alert()` / `alert()` 를 사용하지 않는다.** 특히 회원가입·로그인·마이페이지 등 **입력값(아이디, 비밀번호, 이메일 등)을 문자열로 넣어 보여 주는 alert** 는 금지한다. (스크린샷·화면 공유·기록에 남기 쉽고 UX도 나쁨)
- 성공·실패 메시지는 **폼 아래 인라인 텍스트**(`role="alert"`인 `<p className="text-destructive">` 등) 또는 **페이지 이동**(`router.push`)으로 처리한다.
- 모달이 필요하면 shadcn `AlertDialog` 등 **디자인 시스템 컴포넌트**를 쓰되, 민감한 입력값 전체를 본문에 반복하지 않는다.

```tsx
// ❌ 입력값·계정 정보 노출
alert(`가입 완료\n아이디: ${userId}\n비밀번호: ${password}`)

// ✅ 인라인 메시지 또는 라우팅만
setState((prev) => ({ ...prev, error: json.error ?? "회원가입에 실패했습니다." }))
router.push("/mypage")
```

## 피해야 할 패턴

```tsx
// ❌ 필드마다 useState
const [userId, setUserId] = useState("")
const [password, setPassword] = useState("")
const [submitting, setSubmitting] = useState(false)
const [error, setError] = useState<string | null>(null)

// ❌ 폼 필드까지 state 객체에 넣고 매 입력마다 setState (필요 없으면 FormData 사용)
const [state, setState] = useState({ userId: "", password: "", submitting: false, error: null })
// + onChange로 매번 업데이트

// ❌ alert로 폼 결과·개인정보 표시
alert(`로그인 성공\n아이디: ${userId}`)
```
