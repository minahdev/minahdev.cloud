export default function PrivacyPage() {
  return (
    <div className="pt-24 pb-16 md:pt-28">
      <div className="container mx-auto max-w-lg px-4">
        <h1 className="mb-6 text-2xl font-bold text-foreground">개인정보 처리방침</h1>
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <p className="mb-2 font-semibold text-foreground">제1조 (수집하는 개인정보 항목)</p>
            <p>서비스는 회원가입 시 아이디, 이메일, 닉네임을 수집하며, 서비스 이용 과정에서 신체 정보(키, 몸무게, 생년월일, 성별), 훈련 기록, 식단 정보를 추가로 수집합니다.</p>
          </section>
          <section>
            <p className="mb-2 font-semibold text-foreground">제2조 (개인정보의 수집 및 이용 목적)</p>
            <p>수집된 정보는 맞춤형 운동 추천, 훈련 분석, 서비스 개선 및 공지 발송에 활용됩니다. 수집 목적 외의 용도로 사용하지 않으며, 제3자에게 제공하지 않습니다.</p>
          </section>
          <section>
            <p className="mb-2 font-semibold text-foreground">제3조 (개인정보의 보유 및 이용 기간)</p>
            <p>회원 탈퇴 시 수집된 개인정보는 즉시 삭제됩니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 정보는 해당 기간 동안 보관 후 삭제합니다.</p>
          </section>
          <section>
            <p className="mb-2 font-semibold text-foreground">제4조 (개인정보의 파기)</p>
            <p>개인정보는 보유 기간 종료 또는 처리 목적 달성 시 복구할 수 없는 방법으로 즉시 파기합니다. 전자 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용합니다.</p>
          </section>
          <section>
            <p className="mb-2 font-semibold text-foreground">제5조 (이용자의 권리)</p>
            <p>회원은 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있으며, 개인정보 처리에 대한 동의를 철회할 수 있습니다. 이와 관련된 문의는 서비스 내 문의 기능을 통해 요청할 수 있습니다.</p>
          </section>
          <p className="pt-2 text-xs text-muted-foreground/60">시행일: 2026년 1월 1일</p>
        </div>
      </div>
    </div>
  )
}
