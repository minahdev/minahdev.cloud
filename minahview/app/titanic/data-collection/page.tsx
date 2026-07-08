import { TitanicCsvUpload } from "@/components/titanic-csv-upload"

export default function TitanicDataCollectionPage() {
  return (
    <div className="px-6 pt-24 pb-14 md:pt-28 md:pb-16">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Lesson
          </p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">데이터 수집</h1>
          <p className="mt-2 text-muted-foreground">
            타이타닉 생존자 데이터를 업로드해 EDA/모델 학습 단계로 이어갑니다.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <TitanicCsvUpload />
        </div>
      </div>
    </div>
  )
}

