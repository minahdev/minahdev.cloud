import { Send } from "lucide-react"

export default function TelegramPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col pb-16 pt-28 md:pt-32">
      <div className="container mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-6">
        <header className="mb-6 shrink-0 text-center md:text-left">
          <p className="text-sm font-medium text-primary">Comm Agent</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            텔레그램
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            텔레그램 메시지 발송 기능이 곧 추가됩니다.
          </p>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border bg-secondary/20 px-6 py-16 text-center">
          <Send className="mb-3 size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">준비 중입니다.</p>
        </div>
      </div>
    </div>
  )
}
