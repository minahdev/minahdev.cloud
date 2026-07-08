export default function TermsPage() {
  return (
    <div className="pt-24 pb-16 md:pt-28">
      <div className="container mx-auto max-w-lg px-4">
        <h1 className="mb-6 text-2xl font-bold text-foreground">서비스 이용약관</h1>
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <p className="mb-2 font-semibold text-foreground">제1조 (목적)</p>
            <p>본 약관은 Pace(이하 "서비스")가 제공하는 헬스케어 기록 및 AI 추천 서비스의 이용 조건과 절차, 회원과 서비스 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
          </section>
          <section>
            <p className="mb-2 font-semibold text-foreground">제2조 (서비스 이용)</p>
            <p>회원은 본 서비스를 통해 훈련 기록, 식단 관리, 커뮤니티 활동 등을 이용할 수 있으며, 타인의 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.</p>
          </section>
          <section>
            <p className="mb-2 font-semibold text-foreground">제3조 (개인정보 보호)</p>
            <p>서비스는 회원의 개인정보를 관련 법령에 따라 보호하며, 수집된 정보는 서비스 제공 목적 이외에 사용하지 않습니다.</p>
          </section>
          <section>
            <p className="mb-2 font-semibold text-foreground">제4조 (면책 조항)</p>
            <p>서비스가 제공하는 AI 운동 추천 및 건강 정보는 참고용이며, 의료적 진단이나 처방을 대체하지 않습니다. 이용에 따른 결과에 대해 서비스는 책임을 지지 않습니다.</p>
          </section>
          <p className="pt-2 text-xs text-muted-foreground/60">시행일: 2026년 1월 1일</p>
        </div>
      </div>
    </div>
  )
}
